// שמירת קול מעוצב לחשבון + עדכון config. הרצה: node pipeline/04c_save_voice.mjs <label> [reportDir]
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, config, api, logCost } from './lib.mjs';
import { tts, verify } from './04_narration.mjs';

const [label, dir = 'voices_v3'] = process.argv.slice(2);
const rep = JSON.parse(fs.readFileSync(path.join(ROOT, 'outputs', 'stage1', dir, 'report.json'), 'utf8'));
const row = rep.report.find(r => r.label === label); if (!row?.generated_voice_id) throw new Error('label לא נמצא');
const desc = rep.designs[label.replace(/_\d$/, '')];
const r = await api('/v1/text-to-voice', { method: 'POST', body: { voice_name: 'פנים 12 — מדריכה', voice_description: desc, generated_voice_id: row.generated_voice_id, labels: { language: 'he', use_case: 'narration', project: 'faceyoga' } } });
const t = await r.text(); if (!r.ok) { console.error(`save ${r.status}: ${t.slice(0, 400)}`); process.exit(1); }
const voice_id = JSON.parse(t).voice_id; console.log('voice_id:', voice_id);
logCost({ stage: 1, kind: 'voice-save', label, voice_id, usd: 0 });
config.tts.voice_id = voice_id; config.tts.voice_name = `פנים 12 — מדריכה (${label})`; config.tts.chosen_at = new Date().toISOString().slice(0, 10);
fs.writeFileSync(path.join(ROOT, 'pipeline', 'config.json'), JSON.stringify(config, null, 2));
const { file } = await tts({ text: rep.sentence, voiceId: voice_id, modelId: config.tts.model_id, label: 'saved_check' });
const dest = path.join(ROOT, 'outputs', 'stage1', `chosen_voice_${label}.mp3`); fs.copyFileSync(file, dest);
const v = await verify(dest, rep.sentence); console.log(`v4 עם המזהה הקבוע: תמלול ${Math.round(v.match * 100)}% · ${v.heard}`);
