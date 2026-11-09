// סנכרון שפתיים: תמונת המדריכה + הקלטת הקריינות → סרטון מדבר (creatify-aurora). תוצרים: outputs/stage3/talk/<id>.mp4
// הרצה: node pipeline/lipsync.mjs intro_1 [intro_2 ...]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, generate, imageRef, copyTo } from './lib.mjs';

const OUT = path.join(ROOT, 'outputs', 'stage3', 'talk'); fs.mkdirSync(OUT, { recursive: true });
const IMAGE = path.join(ROOT, 'outputs', 'stage2', 'keyframes', 'talk_portrait.png');

export async function talk(id) {
  const audio = path.join(ROOT, 'content', 'audio', 'narration', `${id}.mp3`);
  if (!fs.existsSync(audio)) throw new Error(`אין קריינות ${id}`);
  const img = fs.existsSync(IMAGE) ? IMAGE : path.join(ROOT, 'content', 'character', 'front.png');
  const request = { model_id: 'creatify-aurora', image: imageRef(img), audio: { type: 'inline_base64', content_base64: fs.readFileSync(audio).toString('base64'), mime_type: 'audio/mpeg' } };
  const r = await generate('video', request, { ext: 'mp4', pollMs: 10000, stage: 3, label: `talk ${id}` });
  const dest = copyTo(r.file, path.join(OUT, `${id}_raw.mp4`));
  // דחיסה לטלפון; שומרים את השמע (זה הסנכרון)
  const out = path.join(OUT, `${id}.mp4`);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', dest, '-vf', 'scale=720:-2,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', out]);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', out, '-vf', "select='not(mod(n\\,40))',scale=240:-1,tile=6x1", '-frames:v', '1', path.join(OUT, `${id}_sheet.jpg`)]);
  return out;
}
if (process.argv[1] && import.meta.filename === path.resolve(process.argv[1])) {
  const ids = process.argv.slice(2);
  const res = await Promise.allSettled(ids.map(talk));
  res.forEach((r, j) => console.log(`${ids[j]}: ${r.status === 'fulfilled' ? r.value : 'FAILED ' + r.reason.message}`));
}
