/**
 * Custom Subtitle Handlers
 *
 * Injects user-supplied WebVTT tracks into the <video> element that lives inside
 * the player's cross-origin iframe. The renderer cannot reach that document, so
 * all DOM work happens here through WebFrameMain.executeJavaScript.
 */

const { ipcMain } = require('electron');
const { translateVTT } = require('../services/subtitleTranslator');
const { listSubtitles, downloadSubtitle, pickEnglishTrack, getVideoDownloads } = require('../services/vidvault');

// List video download links from VidVault
ipcMain.handle('subtitle:vidvaultVideoDownloads', async (_event, options) => {
    try {
        const downloads = await getVideoDownloads(options || {});
        return { success: true, downloads };
    } catch (error) {
        console.error('[VidVault] Video downloads fetch failed:', error);
        return { success: false, error: error.message || 'Failed to fetch video downloads from VidVault.' };
    }
});

const HAS_VIDEO = `(() => { try { return !!document.querySelector('video'); } catch (e) { return false; } })()`;

const LIST_TRACKS = `(() => {
    try {
        return Array.from(document.querySelectorAll('video track')).map(t => ({
            label: t.label || '',
            lang: t.srclang || '',
            src: t.src || '',
            custom: t.hasAttribute('data-cinestream'),
        }));
    } catch (e) {
        return [];
    }
})()`;

const RUNTIME = `
    if (!window.__cineSubs) {
        window.__cineSubs = { tracks: {}, activeId: null, watchdog: null };
    }
    const store = window.__cineSubs;
    const getVideo = () => document.querySelector('video');
    const enforce = () => {
        const video = getVideo();
        if (!video) return;
        const entry = store.activeId ? store.tracks[store.activeId] : null;
        if (entry && !video.contains(entry.el)) video.appendChild(entry.el);
        const list = video.textTracks;
        for (let i = 0; i < list.length; i++) {
            const t = list[i];
            const mine = entry && entry.el.track === t;
            if (mine && t.mode !== 'showing') t.mode = 'showing';
            else if (!mine && t.mode === 'showing') t.mode = 'disabled';
        }
    };
    if (!store.watchdog) {
        // The player's own caption UI resets track modes, so keep re-asserting ours.
        store.watchdog = setInterval(enforce, 700);
    }
`;

function injectScript(payload) {
    return `(() => {
        try {
            const P = ${JSON.stringify(payload)};
            ${RUNTIME}
            const video = getVideo();
            if (!video) return { ok: false, error: 'no-video' };

            const prev = store.tracks[P.id];
            if (prev) {
                try { prev.el.remove(); } catch (e) {}
                try { URL.revokeObjectURL(prev.url); } catch (e) {}
                delete store.tracks[P.id];
            }

            const url = URL.createObjectURL(new Blob([P.content], { type: 'text/vtt' }));
            const el = document.createElement('track');
            el.kind = 'subtitles';
            el.label = P.label;
            el.srclang = P.lang || 'und';
            el.src = url;
            el.setAttribute('data-cinestream', P.id);
            video.appendChild(el);
            store.tracks[P.id] = { el, url, label: P.label };

            if (P.activate) {
                store.activeId = P.id;
                el.addEventListener('load', enforce);
                enforce();
            }
            return { ok: true, id: P.id };
        } catch (e) {
            return { ok: false, error: String((e && e.message) || e) };
        }
    })()`;
}

function activateScript(id) {
    return `(() => {
        try {
            ${RUNTIME}
            store.activeId = ${JSON.stringify(id)} || null;
            enforce();
            return { ok: true };
        } catch (e) {
            return { ok: false, error: String((e && e.message) || e) };
        }
    })()`;
}

function removeScript(id) {
    return `(() => {
        try {
            const store = window.__cineSubs;
            if (!store) return { ok: true };
            const entry = store.tracks[${JSON.stringify(id)}];
            if (entry) {
                try { entry.el.remove(); } catch (e) {}
                try { URL.revokeObjectURL(entry.url); } catch (e) {}
                delete store.tracks[${JSON.stringify(id)}];
            }
            if (store.activeId === ${JSON.stringify(id)}) store.activeId = null;
            return { ok: true };
        } catch (e) {
            return { ok: false, error: String((e && e.message) || e) };
        }
    })()`;
}

/**
 * Walk every subframe looking for the one that owns the <video> element.
 * The player nests iframes, so the video is usually several levels deep.
 */
async function findPlayerFrame(sender) {
    let frames = [];
    try {
        frames = sender.mainFrame.framesInSubtree;
    } catch (e) {
        return null;
    }

    for (const frame of frames) {
        if (frame === sender.mainFrame) continue;
        try {
            const hasVideo = await frame.executeJavaScript(HAS_VIDEO, true);
            if (hasVideo) return frame;
        } catch (e) {
            // Frame was destroyed or is otherwise unreachable — keep looking.
        }
    }
    return null;
}

/** The iframe loads asynchronously, so poll for a short while before failing. */
async function waitForPlayerFrame(sender, attempts = 20, delayMs = 500) {
    for (let i = 0; i < attempts; i++) {
        const frame = await findPlayerFrame(sender);
        if (frame) return frame;
        await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    return null;
}

async function runInPlayer(sender, script, wait = false) {
    const frame = wait ? await waitForPlayerFrame(sender) : await findPlayerFrame(sender);
    if (!frame) {
        return { success: false, error: 'Player video not found. Start playback first, then try again.' };
    }
    try {
        const result = await frame.executeJavaScript(script, true);
        if (!result || !result.ok) {
            return { success: false, error: (result && result.error) || 'Injection failed' };
        }
        return { success: true, frameUrl: frame.url };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

/** Convert SRT (or already-VTT) text into WebVTT. */
function toWebVTT(text) {
    let out = String(text).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    if (/^WEBVTT/i.test(out.trim())) return out;
    out = out.replace(/(\d{2}:\d{2}:\d{2}),(\d{1,3})/g, '$1.$2');
    return `WEBVTT\n\n${out.trim()}\n`;
}

/**
 * Web Audio graph injected into the player frame:
 *   source → [EQ biquad filters] → gain (boost) → limiter → destination
 * The MediaElementSource can only be created once per <video>, so it is cached
 * on window.__cineAudio and reused across calls.
 */
function audioApplyScript(cfg) {
    return `(() => {
        try {
            const CFG = ${JSON.stringify(cfg)};
            const video = document.querySelector('video');
            if (!video) return { ok: false, error: 'Player audio not ready. Start playback first.' };

            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return { ok: false, error: 'Web Audio not supported here.' };

            if (!window.__cineAudio) window.__cineAudio = { ctx: null, source: null, video: null, nodes: [] };
            const A = window.__cineAudio;
            if (!A.ctx) A.ctx = new AC();
            if (A.ctx.state === 'suspended') { try { A.ctx.resume(); } catch (e) {} }

            if (A.video !== video || !A.source) {
                try {
                    A.source = A.ctx.createMediaElementSource(video);
                    A.video = video;
                } catch (e) {
                    if (!(A.source && A.video === video)) {
                        return { ok: false, error: 'Could not tap the player audio (' + ((e && e.message) || e) + ').' };
                    }
                }
            }

            try { A.source.disconnect(); } catch (e) {}
            (A.nodes || []).forEach(n => { try { n.disconnect(); } catch (e) {} });
            A.nodes = [];

            if (!CFG.enabled) {
                A.source.connect(A.ctx.destination);
                return { ok: true, enabled: false, state: A.ctx.state };
            }

            let node = A.source;
            const bands = CFG.bands || [];
            bands.forEach((b, i) => {
                const f = A.ctx.createBiquadFilter();
                f.type = i === 0 ? 'lowshelf' : (i === bands.length - 1 ? 'highshelf' : 'peaking');
                f.frequency.value = b.freq;
                f.Q.value = b.q || 1.1;
                f.gain.value = Math.max(-24, Math.min(24, b.gain || 0));
                node.connect(f);
                node = f;
                A.nodes.push(f);
            });

            const gain = A.ctx.createGain();
            gain.gain.value = Math.max(0, Math.min(6, CFG.gain || 1));
            node.connect(gain);
            node = gain;
            A.nodes.push(gain);

            // Limiter so heavy boost clips gracefully instead of tearing.
            const comp = A.ctx.createDynamicsCompressor();
            comp.threshold.value = -6;
            comp.knee.value = 6;
            comp.ratio.value = 20;
            comp.attack.value = 0.003;
            comp.release.value = 0.25;
            node.connect(comp);
            node = comp;
            A.nodes.push(comp);

            node.connect(A.ctx.destination);
            return { ok: true, enabled: true, gain: gain.gain.value, state: A.ctx.state };
        } catch (e) {
            return { ok: false, error: String((e && e.message) || e) };
        }
    })()`;
}

function audioResetScript() {
    return `(() => {
        try {
            const A = window.__cineAudio;
            if (!A || !A.ctx || !A.source) return { ok: true };
            try { A.source.disconnect(); } catch (e) {}
            (A.nodes || []).forEach(n => { try { n.disconnect(); } catch (e) {} });
            A.nodes = [];
            A.source.connect(A.ctx.destination);
            return { ok: true };
        } catch (e) {
            return { ok: false, error: String((e && e.message) || e) };
        }
    })()`;
}

function registerSubtitleHandlers() {
    ipcMain.handle('subtitle:inject', async (event, payload) => {
        if (!payload || !payload.id || !payload.content) {
            return { success: false, error: 'Missing subtitle data' };
        }
        return runInPlayer(event.sender, injectScript({
            id: String(payload.id),
            label: String(payload.label || 'Custom'),
            lang: String(payload.lang || 'und'),
            content: String(payload.content),
            activate: payload.activate !== false,
        }), true);
    });

    ipcMain.handle('subtitle:activate', async (event, id) => {
        return runInPlayer(event.sender, activateScript(id ? String(id) : null));
    });

    ipcMain.handle('subtitle:remove', async (event, id) => {
        return runInPlayer(event.sender, removeScript(String(id)));
    });

    ipcMain.handle('subtitle:playerReady', async (event) => {
        const frame = await findPlayerFrame(event.sender);
        return { success: !!frame };
    });

    ipcMain.handle('subtitle:listTracks', async (event) => {
        const frame = await findPlayerFrame(event.sender);
        if (!frame) return { success: false, error: 'Player not ready.' };
        try {
            const tracks = await frame.executeJavaScript(LIST_TRACKS, true);
            return { success: true, tracks: tracks || [] };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    // List subtitle tracks from VidVault for the current title.
    ipcMain.handle('subtitle:vidvaultList', async (_event, options) => {
        try {
            const tracks = await listSubtitles(options || {});
            return { success: true, tracks };
        } catch (error) {
            console.error('[Subtitles] VidVault list failed:', error);
            return { success: false, error: error.message || 'Failed to load subtitles from VidVault.' };
        }
    });

    // Download a VidVault track and inject it into the player.
    ipcMain.handle('subtitle:vidvaultLoad', async (event, options) => {
        const { downloadUrl, url, label, lang, id, activate } = options || {};
        if (!downloadUrl && !url) {
            return { success: false, error: 'Missing subtitle download URL.' };
        }

        try {
            const raw = await downloadSubtitle(downloadUrl || url, url);
            const content = toWebVTT(raw);
            const trackId = String(id || `vv-${Date.now()}`);

            const injected = await runInPlayer(event.sender, injectScript({
                id: trackId,
                label: String(label || 'Subtitle'),
                lang: String(lang || 'und'),
                content,
                activate: activate !== false,
            }), true);

            if (!injected.success) return injected;

            return {
                success: true,
                id: trackId,
                label: String(label || 'Subtitle'),
                lang: String(lang || 'und'),
                content,
            };
        } catch (error) {
            console.error('[Subtitles] VidVault load failed:', error);
            return { success: false, error: error.message || 'Failed to load subtitle.' };
        }
    });

    // Experimental: download English from VidVault, machine-translate, inject.
    ipcMain.handle('subtitle:generate', async (event, options) => {
        const {
            targetLang,
            label,
            type,
            tmdbId,
            season,
            episode,
            title,
            year,
            sourceDownloadUrl,
            sourceUrl,
            sourceLabel,
        } = options || {};

        if (!targetLang) return { success: false, error: 'No target language selected.' };

        const sender = event.sender;
        const report = (phase, extra = {}) => {
            if (!sender.isDestroyed()) sender.send('subtitle:generateProgress', { phase, ...extra });
        };

        try {
            report('locating');

            let downloadUrl = sourceDownloadUrl;
            let fallbackUrl = sourceUrl;
            let fromLabel = sourceLabel || 'English';

            if (!downloadUrl && !fallbackUrl) {
                if (!tmdbId) {
                    return { success: false, error: 'Missing media id for subtitle lookup.' };
                }
                report('downloading', { source: 'VidVault' });
                const tracks = await listSubtitles({ type, tmdbId, season, episode, title, year });
                const source = pickEnglishTrack(tracks);
                if (!source) {
                    return { success: false, error: 'No English subtitle found on VidVault for this title.' };
                }
                downloadUrl = source.downloadUrl;
                fallbackUrl = source.url;
                fromLabel = source.label;
            }

            report('downloading', { source: fromLabel });
            const raw = await downloadSubtitle(downloadUrl || fallbackUrl, fallbackUrl);
            const vttText = toWebVTT(raw);

            report('translating', { done: 0, total: 0 });
            const result = await translateVTT(vttText, targetLang, ({ done, total }) => {
                report('translating', { done, total });
            });

            report('injecting');
            const id = `cs-gen-${Date.now()}`;
            const injected = await runInPlayer(sender, injectScript({
                id,
                label: String(label || targetLang),
                lang: String(targetLang),
                content: result.content,
                activate: true,
            }), true);

            if (!injected.success) return injected;

            return {
                success: true,
                id,
                label: String(label || targetLang),
                content: result.content,
                sourceLabel: fromLabel,
                cueCount: result.cueCount,
                failedCues: result.failedCues,
            };
        } catch (error) {
            console.error('[Subtitles] Generation failed:', error);
            return { success: false, error: error.message || 'Subtitle generation failed.' };
        }
    });

    // Audio booster + equalizer (injected Web Audio graph in the player frame).
    ipcMain.handle('audio:apply', async (event, cfg) => {
        return runInPlayer(event.sender, audioApplyScript(cfg || {}), true);
    });

    ipcMain.handle('audio:reset', async (event) => {
        return runInPlayer(event.sender, audioResetScript());
    });

    console.log('[Subtitles] Custom subtitle handlers registered');
}

module.exports = { registerSubtitleHandlers };
