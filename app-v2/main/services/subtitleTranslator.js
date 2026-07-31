/**
 * Subtitle Translator (experimental)
 *
 * Downloads / receives WebVTT (or SRT converted to VTT), translates cue text only,
 * keeps timestamps intact.
 *
 * Primary engine: Google's public gtx endpoint (same one used by translate.google.com).
 * Fallback: @vitalets/google-translate-api.
 *
 * Important behaviours:
 *  - Fail fast after a few consecutive hard failures (no 5-minute death spiral).
 *  - Stable cue markers so batch replies can be re-aligned.
 *  - On mis-aligned batches, split in half instead of translating every cue 1-by-1.
 */

const { translate: vitaletsTranslate } = require('@vitalets/google-translate-api/dist/cjs/index.js');

const MAX_BATCH_CUES = 18;
const MAX_BATCH_CHARS = 900;
const BATCH_DELAY_MS = 120;
const MAX_RETRIES = 2;
const MAX_CONSECUTIVE_FAILURES = 2;

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const MARK = (i) => `⟦${i}⟧`;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/** Parse WebVTT or SRT into cues. SRT-aware so single-newline files still split. */
function parseVTT(raw) {
    const text = String(raw).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
    if (!text) return [];

    // Prefer SRT-style blocks (number + timing) when the file looks like SRT/VTT cues.
    const cueBlocks = text.split(/\n(?=\d+\n\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}\s*-->)/);
    const looksLikeNumbered = cueBlocks.length > 1 && /^\d+\n/.test(cueBlocks[0].replace(/^WEBVTT[^\n]*\n+/, ''));

    const chunks = looksLikeNumbered
        ? cueBlocks
        : text.split(/\n{2,}/);

    const cues = [];

    for (let block of chunks) {
        block = block.replace(/^WEBVTT[^\n]*\n*/, '').trim();
        if (!block) continue;

        const lines = block.split('\n').filter(line => line.trim() !== '');
        if (lines.length === 0) continue;
        if (/^(NOTE|STYLE|REGION)\b/i.test(lines[0])) continue;

        const timingIndex = lines.findIndex(line => line.includes('-->'));
        if (timingIndex === -1) continue;

        const body = lines.slice(timingIndex + 1);
        if (body.length === 0) continue;

        const original = body.join('\n').trim();
        const clean = original
            .replace(/<[^>]*>/g, '')
            .replace(/\{[^}]*\}/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        if (!clean) continue;

        cues.push({
            id: timingIndex > 0 && /^\d+$/.test(lines[timingIndex - 1]) ? lines[timingIndex - 1] : null,
            timing: lines[timingIndex].replace(/(\d{1,2}:\d{2}:\d{2}),(\d{1,3})/g, '$1.$2'),
            original,
            clean,
            translated: null,
        });
    }

    return cues;
}

function buildVTT(cues) {
    const parts = ['WEBVTT', ''];
    for (const cue of cues) {
        if (cue.id) parts.push(cue.id);
        parts.push(cue.timing);
        parts.push(cue.translated || cue.clean || cue.original);
        parts.push('');
    }
    return parts.join('\n');
}

function buildBatches(cues) {
    const batches = [];
    let current = [];
    let chars = 0;

    for (const cue of cues) {
        const size = cue.clean.length + 8;
        const full = current.length >= MAX_BATCH_CUES || (chars + size) > MAX_BATCH_CHARS;
        if (current.length > 0 && full) {
            batches.push(current);
            current = [];
            chars = 0;
        }
        current.push(cue);
        chars += size;
    }
    if (current.length > 0) batches.push(current);
    return batches;
}

function packBatch(batch) {
    return batch.map((cue, i) => `${MARK(i)} ${cue.clean}`).join('\n');
}

function unpackBatch(translated, batchSize) {
    const map = new Map();
    const re = /⟦(\d+)⟧\s*([\s\S]*?)(?=⟦\d+⟧|$)/g;
    let match;
    while ((match = re.exec(String(translated))) !== null) {
        const idx = Number(match[1]);
        const text = match[2].replace(/\s+/g, ' ').trim();
        if (Number.isInteger(idx) && text) map.set(idx, text);
    }

    if (map.size === batchSize) {
        return Array.from({ length: batchSize }, (_, i) => map.get(i) || null);
    }

    // Soft fallback: plain lines when markers were stripped.
    const lines = String(translated).split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === batchSize) {
        return lines.map(line => line.replace(/^⟦\d+⟧\s*/, ''));
    }

    return null;
}

async function translateViaGtx(text, targetLang) {
    const params = new URLSearchParams({
        client: 'gtx',
        sl: 'en',
        tl: targetLang,
        dt: 't',
        q: text,
    });

    // Prefer POST so larger batches are not truncated by URL length.
    let res = await fetch('https://translate.googleapis.com/translate_a/single', {
        method: 'POST',
        headers: {
            'User-Agent': UA,
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
            Accept: 'application/json',
        },
        body: params.toString(),
    });

    // Some networks reject POST on this host — fall back to GET for short payloads.
    if (!res.ok && text.length < 1200) {
        res = await fetch(`https://translate.googleapis.com/translate_a/single?${params}`, {
            headers: { 'User-Agent': UA, Accept: 'application/json' },
        });
    }

    if (res.status === 429) {
        const err = new Error('Google Translate rate limited (HTTP 429)');
        err.code = 429;
        throw err;
    }
    if (!res.ok) throw new Error(`Google Translate HTTP ${res.status}`);

    const data = await res.json();
    if (!Array.isArray(data) || !Array.isArray(data[0])) {
        throw new Error('Unexpected Google Translate response');
    }
    return data[0].map(chunk => (chunk && chunk[0]) || '').join('');
}

async function translateViaVitalets(text, targetLang) {
    const result = await vitaletsTranslate(text, { to: targetLang });
    return result.text;
}

async function translateText(text, targetLang) {
    let lastError;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            return await translateViaGtx(text, targetLang);
        } catch (error) {
            lastError = error;
            // On hard rate-limit, don't keep hammering the same endpoint.
            if (error && error.code === 429) break;
            await sleep(350 * (attempt + 1));
        }
    }

    // One fallback attempt through the library the project already depends on.
    try {
        return await translateViaVitalets(text, targetLang);
    } catch (error) {
        lastError = error;
    }

    const err = new Error(
        (lastError && lastError.message) || 'Translation request failed'
    );
    err.cause = lastError;
    throw err;
}

async function translateBatch(batch, targetLang) {
    if (batch.length === 1) {
        batch[0].translated = await translateText(batch[0].clean, targetLang);
        return;
    }

    const packed = packBatch(batch);
    const translated = await translateText(packed, targetLang);
    const lines = unpackBatch(translated, batch.length);

    if (lines) {
        batch.forEach((cue, i) => {
            cue.translated = lines[i] || cue.clean;
        });
        return;
    }

    // Alignment failed — split the batch instead of 1-by-1 hammering.
    if (batch.length <= 2) {
        for (const cue of batch) {
            cue.translated = await translateText(cue.clean, targetLang);
            await sleep(60);
        }
        return;
    }

    const mid = Math.ceil(batch.length / 2);
    await translateBatch(batch.slice(0, mid), targetLang);
    await sleep(BATCH_DELAY_MS);
    await translateBatch(batch.slice(mid), targetLang);
}

/**
 * @param {string} vttText
 * @param {string} targetLang
 * @param {(progress: {done: number, total: number, phase?: string}) => void} onProgress
 */
async function translateVTT(vttText, targetLang, onProgress) {
    const allCues = parseVTT(vttText);
    const cues = allCues.filter(cue => cue.clean.length > 0);

    if (cues.length === 0) {
        throw new Error('No subtitle cues found in the source file.');
    }

    // Probe first so a broken translate path fails in seconds, not after the whole file.
    try {
        const probe = await translateText('Hello', targetLang);
        if (!probe || !String(probe).trim()) {
            throw new Error('Empty probe response');
        }
    } catch (error) {
        const detail = (error && error.message) || 'unreachable';
        throw new Error(
            `Translation service is not reachable (${detail}). ` +
            'Check your internet connection and try again.'
        );
    }

    const batches = buildBatches(cues);
    let done = 0;
    let failed = 0;
    let consecutiveFailures = 0;
    let lastError = null;

    for (const batch of batches) {
        try {
            await translateBatch(batch, targetLang);
            consecutiveFailures = 0;
        } catch (error) {
            lastError = error;
            batch.forEach(cue => { cue.translated = cue.clean; });
            failed += batch.length;
            consecutiveFailures += 1;

            // Fail fast — don't burn minutes retrying a broken/blocked service.
            if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                const detail = (error && error.message) || 'unknown error';
                throw new Error(
                    `Translation failed early (${detail}). ` +
                    'Check your network connection to Google Translate and try again.'
                );
            }
        }

        done += batch.length;
        if (onProgress) onProgress({ done, total: cues.length });
        await sleep(BATCH_DELAY_MS);
    }

    if (failed === cues.length) {
        const detail = (lastError && lastError.message) || 'all requests failed';
        throw new Error(`Could not translate any lines (${detail}).`);
    }

    return { content: buildVTT(allCues), cueCount: cues.length, failedCues: failed };
}

module.exports = { translateVTT, parseVTT, buildVTT };
