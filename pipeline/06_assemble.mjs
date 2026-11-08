// הרכבה: לולאות מאושרות → content/video, סטילים (JPEG) → content/stills, דמות → JPEG, וכתיבת content/manifest.json.
// הרצה: node pipeline/06_assemble.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { ROOT, config } from './lib.mjs';
import { CLIPS } from './clips.mjs';
import { KEYFRAMES } from './keyframes.mjs';

const C = p => path.join(ROOT, 'content', p);
const qa = JSON.parse(fs.readFileSync(path.join(ROOT, 'pipeline', 'qa_status.json'), 'utf8'));
const narPath = C('audio/narration/index.json');
const nar = fs.existsSync(narPath) ? JSON.parse(fs.readFileSync(narPath, 'utf8')) : {};
for (const d of ['video', 'stills', 'character']) fs.mkdirSync(C(d), { recursive: true });
const KF = path.join(ROOT, 'outputs', 'stage2', 'keyframes'), LOOPS = path.join(ROOT, 'outputs', 'stage2', 'loops');
const jpg = (src, dest, w) => { if (!fs.existsSync(dest) || fs.statSync(dest).mtimeMs < fs.statSync(src).mtimeMs) execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', src, '-vf', `scale=${w}:-2`, '-q:v', '4', dest]); };

jpg(C('character/front.png'), C('character/front.jpg'), 900);
jpg(C('character/side.png'), C('character/side.jpg'), 900);

const media = {};
// כל תרגיל שיש לו תמונת-מפתח באותו שם (שיא התנועה) מקבל סטיל; קליף מאושר נכנס כוידאו.
const ids = new Set([...Object.keys(CLIPS), ...Object.keys(KEYFRAMES).filter(k => !k.endsWith('_pre'))]);
for (const id of ids) {
  const kfFile = path.join(KF, `${id}.png`);
  const entry = { exerciseId: id, qa: qa[id]?.qa ?? 'pending' };
  if (fs.existsSync(kfFile)) { jpg(kfFile, C(`stills/${id}.jpg`), 720); entry.still = `stills/${id}.jpg`; }
  const loop = path.join(LOOPS, `${id}.mp4`);
  if (entry.qa === 'approved' && fs.existsSync(loop)) {
    fs.copyFileSync(loop, C(`video/${id}.mp4`));
    entry.clip = `video/${id}.mp4`; entry.mode = CLIPS[id]?.mode ?? 'loop'; entry.bytes = fs.statSync(loop).size;
  } else fs.rmSync(C(`video/${id}.mp4`), { force: true });
  media[id] = entry;
}
const narration = Object.fromEntries(Object.entries(nar).map(([k, v]) => [k, { url: `audio/narration/${k}.mp3`, durationMs: v.durationMs, text: v.text, qa: v.qa }]));
const ui = Object.fromEntries(fs.readdirSync(C('audio/ui')).filter(f => f.endsWith('.mp3')).map(f => [f.replace(/^ui_|\.mp3$/g, ''), `audio/ui/${f}`]));
const music = fs.existsSync(C('audio/music/music_a_10min.mp3')) ? 'audio/music/music_a_10min.mp3' : undefined;
const manifest = { version: crypto.createHash('sha256').update(JSON.stringify({ media, narration })).digest('hex').slice(0, 10), generatedAt: new Date().toISOString().slice(0, 10), character: { front: 'character/front.jpg', side: 'character/side.jpg' }, voice: { id: config.tts.voice_id, model: config.tts.model_id }, media, narration, audio: { music, ui } };
fs.writeFileSync(C('manifest.json'), JSON.stringify(manifest, null, 2));
const v = Object.values(media);
console.log(`מניפסט ${manifest.version}: ${v.filter(x => x.clip).length} קליפים מאושרים, ${v.filter(x => x.still).length} סטילים, ${Object.keys(narration).length} קטעי קריינות, ${Object.keys(ui).length} צלילים, מוזיקה: ${music ? 'כן' : 'לא'}`);
