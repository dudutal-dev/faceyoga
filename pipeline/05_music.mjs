// מוזיקה וצלילי ממשק דרך ElevenLabs.
// הרצה: node pipeline/05_music.mjs previews   → 3 תצוגות מוזיקה של 60 ש' + 3 אווירה + 4 צלילי ממשק (לבחירת דודו)
//        node pipeline/05_music.mjs full <n>   → רצועה מלאה של 10 דק' מהתצוגה שנבחרה (אחרי בחירה)
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, api, hash, logCost } from './lib.mjs';

const CACHE = path.join(ROOT, 'pipeline', '.cache');

// סגנון ספא רך: בלי פעימה, בלי מלודיה בולטת, פסנתר/פאד, לולאה חלקה. מתחת לקריינות (ducking באפליקציה).
export const MUSIC_PROMPTS = {
  music_a: 'Soft felt piano notes with long gentle decay over a warm airy pad, no percussion, no drums, no beat, slow, intimate, calm modern spa atmosphere, minimal melody, plenty of space, instrumental, seamless loop',
  music_b: 'Warm ambient synth pad with soft shimmering textures and a few distant celesta notes, no percussion, no beat, breathing slowly, peaceful morning light, modern wellness, instrumental, seamless loop',
  music_c: 'Gentle nylon-string guitar harmonics and soft cello drone, no percussion, no beat, sparse, warm, unhurried, Mediterranean calm, self-care ritual, instrumental, seamless loop',
};
export const AMBIENCE_PROMPTS = {};
export const UI_PROMPTS = {
  ui_start: 'A single soft warm glass chime, gentle, short and calming',
  ui_next: 'A tiny soft wooden tap, very short and gentle, barely there',
  ui_hold: 'A very soft rising airy whoosh, short, gentle, like a slow breath in',
  ui_release: 'A very soft falling airy whoosh, short, gentle, like a slow breath out',
  ui_end: 'A warm low singing-bowl tone fading out gently, calm, peaceful',
  ui_celebrate: 'Two soft ascending glass chime notes, gentle and warm, quiet, no sparkle',
};

async function music(label, prompt, lengthMs, outFile) {
  const req = { prompt, music_length_ms: lengthMs, force_instrumental: true, model_id: 'music_v2_5' };
  const key = hash({ kind: 'music', req }); const cached = path.join(CACHE, `${key}.mp3`);
  if (!fs.existsSync(cached)) {
    const r = await api('/v1/music?output_format=mp3_44100_128', { method: 'POST', body: req });
    if (!r.ok) throw new Error(`music ${label} ${r.status}: ${(await r.text()).slice(0, 300)}`);
    fs.writeFileSync(cached, Buffer.from(await r.arrayBuffer()));
    logCost({ stage: 'music', kind: 'music', label, ms: lengthMs, usd: +(lengthMs / 60000 * 0.15).toFixed(3), note: '$0.15/דקה לפי pricing/api' });
  } else console.log(`  [cache] ${label}`);
  fs.copyFileSync(cached, outFile); return outFile;
}
async function sfx(label, text, seconds, loop, outFile) {
  const req = { text, duration_seconds: seconds, prompt_influence: 0.4, loop, model_id: 'eleven_text_to_sound_v3' };
  const key = hash({ kind: 'sfx', req }); const cached = path.join(CACHE, `${key}.mp3`);
  if (!fs.existsSync(cached)) {
    const r = await api('/v1/sound-generation?output_format=mp3_44100_128', { method: 'POST', body: req });
    if (!r.ok) throw new Error(`sfx ${label} ${r.status}: ${(await r.text()).slice(0, 300)}`);
    fs.writeFileSync(cached, Buffer.from(await r.arrayBuffer()));
    logCost({ stage: 'music', kind: 'sfx', label, seconds, usd: +(seconds / 60 * 0.12).toFixed(3), note: '$0.12/דקה לפי pricing/api' });
  } else console.log(`  [cache] ${label}`);
  fs.copyFileSync(cached, outFile); return outFile;
}

const [mode, which] = process.argv.slice(2);
if (mode === 'previews') {
  const OUT = path.join(ROOT, 'outputs', 'stage1', 'audio'); fs.mkdirSync(OUT, { recursive: true });
  const jobs = [
    ...Object.entries(MUSIC_PROMPTS).map(([k, p]) => () => music(k, p, 60000, path.join(OUT, `${k}_preview60s.mp3`))),
    ...Object.entries(AMBIENCE_PROMPTS).map(([k, p]) => () => sfx(k, p, 30, true, path.join(OUT, `${k}_30s.mp3`))),
    ...Object.entries(UI_PROMPTS).map(([k, p]) => () => sfx(k, p, 1.5, false, path.join(OUT, `${k}.mp3`))),
  ];
  for (const j of jobs) { try { console.log('✓', await j()); } catch (e) { console.error('✗', e.message); } }
} else if (mode === 'full') {
  const OUT = path.join(ROOT, 'content', 'audio', 'music'); fs.mkdirSync(OUT, { recursive: true });
  const p = MUSIC_PROMPTS[which]; if (!p) throw new Error('music_a | music_b | music_c');
  // צלילי ממשק נכנסים לאפליקציה יחד עם הרצועה
  const UI = path.join(ROOT, 'content', 'audio', 'ui'); fs.mkdirSync(UI, { recursive: true });
  for (const [k, t] of Object.entries(UI_PROMPTS)) await sfx(k, t, 1.5, false, path.join(UI, `${k}.mp3`));
  console.log(await music(`${which}_full`, p, 600000, path.join(OUT, `${which}_10min.mp3`)));
}
