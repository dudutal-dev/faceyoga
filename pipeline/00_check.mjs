// שלב 0 — בדיקת מפתח: TTS עברי קצר + תמלול חזרה. הרצה: node pipeline/00_check.mjs
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, api } from './lib.mjs';

const out = path.join(ROOT, 'outputs', 'stage0'); fs.mkdirSync(out, { recursive: true });
const SENTENCE = 'שימי את קצות האצבעות על עצמות הלחיים, וחייכי לאט.';
const r = await api('/v1/text-to-speech/XrExE9yKIg1WjnnlVkGX?output_format=mp3_44100_128', { method: 'POST', body: { text: SENTENCE, model_id: 'eleven_v4', language_code: 'he' } });
console.log('tts', r.status);
if (!r.ok) { console.log((await r.text()).slice(0, 400)); process.exit(1); }
const buf = Buffer.from(await r.arrayBuffer()); fs.writeFileSync(path.join(out, 'tts_check.mp3'), buf);
const fd = new FormData(); fd.append('file', new Blob([buf], { type: 'audio/mpeg' }), 'a.mp3'); fd.append('model_id', 'scribe_v1'); fd.append('language_code', 'heb');
const s = await api('/v1/speech-to-text', { method: 'POST', body: fd });
console.log('stt', s.status, s.ok ? (await s.json()).text : (await s.text()).slice(0, 300));
for (const p of ['/v1/flows/image', '/v1/flows/video', '/v1/user/subscription']) { const g = await api(p); console.log(p, g.status); }
