// קריינות. הרצה: node pipeline/04_narration.mjs content/scripts/he/<file>.md
// מפיק רק שורות שהשתנו (cache לפי hash), מתמלל חזרה (scribe) ומסמן qa.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, config, api, hash, logCost } from './lib.mjs';

const CACHE = path.join(ROOT, 'pipeline', '.cache');
const wordsOf = s => s.replace(/[֑-ׇ]/g, '').replace(/[.,;:!?"'()\-–—]/g, ' ').split(/\s+/).filter(Boolean); // מתעלם מניקוד

/** TTS עם cache ותמלול חזרה. מחזיר {file, text, match}. */
export async function tts({ text, voiceId, modelId, settings = config.tts.voice_settings, label }) {
  const req = { text, model_id: modelId, language_code: config.tts.language_code, voice_settings: settings };
  const key = hash({ voiceId, req });
  const file = path.join(CACHE, `${key}.mp3`);
  if (!fs.existsSync(file)) {
    const r = await api(`/v1/text-to-speech/${voiceId}?output_format=${config.tts.output_format}`, { method: 'POST', body: req });
    if (!r.ok) throw new Error(`tts ${label} ${r.status}: ${(await r.text()).slice(0, 300)}`);
    fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
    logCost({ stage: 'narration', kind: 'tts', label, model_id: modelId, voice_id: voiceId, chars: text.length, usd: +(text.length / 1000 * (modelId.includes('turbo') ? 0.04 : 0.08)).toFixed(4), note: 'לפי pricing/api: $0.08/1K תווים' });
  }
  return { file, key };
}

export async function verify(file, text) {
  const fd = new FormData();
  fd.append('file', new Blob([fs.readFileSync(file)], { type: 'audio/mpeg' }), 'a.mp3');
  fd.append('model_id', config.stt.model_id);
  fd.append('language_code', config.stt.language_code);
  const r = await api('/v1/speech-to-text', { method: 'POST', body: fd });
  if (!r.ok) return { heard: `STT ${r.status}`, match: 0 };
  const heard = (await r.json()).text || '';
  const a = wordsOf(text), b = new Set(wordsOf(heard));
  return { heard, match: a.filter(w => b.has(w)).length / a.length };
}

const mode = process.argv[2];
// ---- מצב קובץ: הפקת כל השורות `id: <id> | <טקסט>` מתסריט md ----
if (mode && mode.endsWith('.md')) {
  if (!config.tts.voice_id) throw new Error('config.tts.voice_id ריק — לבחור קול קודם');
  const src = path.resolve(mode);
  const lines = fs.readFileSync(src, 'utf8').split(/\r?\n/).filter(l => l.startsWith('id:'));
  const outDir = path.join(ROOT, 'content', 'audio', 'narration'); fs.mkdirSync(outDir, { recursive: true });
  const indexPath = path.join(outDir, 'index.json');
  const index = fs.existsSync(indexPath) ? JSON.parse(fs.readFileSync(indexPath, 'utf8')) : {};
  let bad = 0;
  for (const l of lines) {
    const m = l.match(/^id:\s*([\w-]+)\s*\|\s*(.+)$/); if (!m) continue;
    const [, id, text] = m;
    const prev = `${id}: ${text}`; // (אפשר להוסיף previous_text להמשכיות בעתיד)
    const { file, key } = await tts({ text, voiceId: config.tts.voice_id, modelId: config.tts.model_id, settings: config.tts.voice_settings, label: id });
    const dest = path.join(outDir, `${id}.mp3`);
    const changed = index[id]?.key !== key;
    fs.copyFileSync(file, dest);
    let v = index[id]?.verify;
    if (changed || !v) v = await verify(dest, text);
    const bytes = fs.statSync(dest).size;
    index[id] = { text, key, durationMs: Math.round(bytes * 8 / 128), model: config.tts.model_id, voice: config.tts.voice_id, verify: v, qa: v.match >= 0.9 ? 'approved' : 'pending' };
    if (v.match < 0.9) bad++;
    console.log(`${changed ? '[new]' : '[cache]'} ${id}: ${(bytes * 8 / 128000).toFixed(1)} ש' · תמלול ${Math.round(v.match * 100)}%${v.match < 1 ? ' · ' + v.heard : ''}`);
  }
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
  console.log(`\n${lines.length} שורות · ${bad} מתחת ל-90% תמלול`);
}
