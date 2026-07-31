/**
 * Subtitle Translator (experimental)
 *
 * Downloads a WebVTT track, translates only the cue text while leaving every
 * timestamp untouched, and rebuilds a valid WebVTT file.
 *
 * Uses the free unofficial Google endpoint, which rate-limits aggressively, so
 * cues are grouped into batches and sent sequentially with a small delay.
 */

const { translate } = require('@vitalets/google-translate-api/dist/cjs/index.js');

const MAX_BATCH_CUES = 40;
const MAX_BATCH_CHARS = 1500;
const BATCH_DELAY_MS = 220;
const MAX_RETRIES = 3;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/** Parse WebVTT (or SRT-ish) text into cues, preserving timing lines verbatim. */
function parseVTT(raw) {
    const text = String(raw).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    const cues = [];

    for (const block of text.split(/\n{2,}/)) {
        const lines = block.split('\n').filter(line => line.trim() !== '');
        if (lines.length === 0) continue;
        if (/^WEBVTT/i.test(lines[0])) continue;
        if (/^(NOTE|STYLE|REGION)\b/i.test(lines[0])) continue;

        const timingIndex = lines.findIndex(line => line.includes('-->'));
        if (timingIndex === -1) continue;

        const body = lines.slice(timingIndex + 1);
        if (body.length === 0) continue;

        const original = body.join(' ').trim();
        cues.push({
            id: timingIndex > 0 ? lines[timingIndex - 1] : null,
            timing: lines[timingIndex].replace(/(\d{2}:\d{2}:\d{2}),(\d{1,3})/g, '$1.$2'),
            original,
            // Tags and speaker markers confuse the translator, so strip them first.
            clean: original.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(),
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
        const size = cue.clean.length + 1;
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

async function translateText(text, targetLang) {
    let lastError;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            const result = await translate(text, { to: targetLang });
            return result.text;
        } catch (error) {
            lastError = error;
            await sleep(600 * (attempt + 1));
        }
    }
    throw lastError;
}

/**
 * Translate one batch. Cues are joined with newlines so one output line maps to
 * one cue; if the translator changes the line count the alignment is broken, so
 * that batch falls back to translating each cue on its own.
 */
async function translateBatch(batch, targetLang) {
    const joined = batch.map(cue => cue.clean).join('\n');
    const translated = await translateText(joined, targetLang);
    const lines = translated.split('\n').map(line => line.trim()).filter(line => line !== '');

    if (lines.length === batch.length) {
        batch.forEach((cue, i) => { cue.translated = lines[i]; });
        return;
    }

    for (const cue of batch) {
        try {
            cue.translated = await translateText(cue.clean, targetLang);
        } catch (error) {
            cue.translated = cue.clean;
        }
        await sleep(80);
    }
}

/**
 * @param {string} vttText   Source WebVTT content
 * @param {string} targetLang Google language code (e.g. 'si')
 * @param {(progress: {done: number, total: number}) => void} onProgress
 */
async function translateVTT(vttText, targetLang, onProgress) {
    const allCues = parseVTT(vttText);
    const cues = allCues.filter(cue => cue.clean.length > 0);

    if (cues.length === 0) {
        throw new Error('No subtitle cues found in the source file.');
    }

    const batches = buildBatches(cues);
    let done = 0;
    let failed = 0;

    for (const batch of batches) {
        try {
            await translateBatch(batch, targetLang);
        } catch (error) {
            // Keep the English text for this batch rather than losing the cues.
            batch.forEach(cue => { cue.translated = cue.clean; });
            failed += batch.length;
        }

        done += batch.length;
        if (onProgress) onProgress({ done, total: cues.length });
        await sleep(BATCH_DELAY_MS);
    }

    if (failed === cues.length) {
        throw new Error('Translation service refused every request (likely rate limited). Try again in a few minutes.');
    }

    return { content: buildVTT(allCues), cueCount: cues.length, failedCues: failed };
}

module.exports = { translateVTT, parseVTT, buildVTT };
