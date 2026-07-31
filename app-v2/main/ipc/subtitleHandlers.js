/**
 * Custom Subtitle Handlers
 *
 * Injects user-supplied WebVTT tracks into the <video> element that lives inside
 * the player's cross-origin iframe. The renderer cannot reach that document, so
 * all DOM work happens here through WebFrameMain.executeJavaScript.
 */

const { ipcMain } = require('electron');
const { translateVTT } = require('../services/subtitleTranslator');

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

/** Prefer a plain English track over SDH/forced variants. */
function pickSourceTrack(tracks) {
    const usable = tracks.filter(t => !t.custom && t.src);
    if (usable.length === 0) return null;

    const english = usable.filter(t => /english|^en/i.test(t.label) || /^en/i.test(t.lang));
    const pool = english.length > 0 ? english : usable;

    const plain = pool.find(t => !/sdh|forced|cc\b/i.test(t.label));
    return plain || pool[0];
}

async function downloadTrack(url, referer) {
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
            'Accept': 'text/vtt,text/plain,*/*',
            ...(referer ? { Referer: referer, Origin: new URL(referer).origin } : {}),
        },
    });

    if (!response.ok) {
        throw new Error(`Could not download the source subtitle (HTTP ${response.status}).`);
    }
    return response.text();
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

    // Experimental: download the player's English track and machine-translate it.
    ipcMain.handle('subtitle:generate', async (event, options) => {
        const { targetLang, label } = options || {};
        if (!targetLang) return { success: false, error: 'No target language selected.' };

        const sender = event.sender;
        const report = (phase, extra = {}) => {
            if (!sender.isDestroyed()) sender.send('subtitle:generateProgress', { phase, ...extra });
        };

        try {
            report('locating');
            const frame = await waitForPlayerFrame(sender, 20, 500);
            if (!frame) {
                return { success: false, error: 'Player video not found. Start playback first, then try again.' };
            }

            const tracks = await frame.executeJavaScript(LIST_TRACKS, true);
            const source = pickSourceTrack(tracks || []);
            if (!source) {
                return { success: false, error: 'This player has no subtitle track to translate from.' };
            }

            report('downloading', { source: source.label });
            const vttText = await downloadTrack(source.src, frame.url);

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
                sourceLabel: source.label,
                cueCount: result.cueCount,
                failedCues: result.failedCues,
            };
        } catch (error) {
            console.error('[Subtitles] Generation failed:', error);
            return { success: false, error: error.message || 'Subtitle generation failed.' };
        }
    });

    console.log('[Subtitles] Custom subtitle handlers registered');
}

module.exports = { registerSubtitleHandlers };
