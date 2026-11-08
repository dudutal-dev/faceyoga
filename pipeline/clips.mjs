// קליפי Veo בין תמונות מפתח. 4 ש', 9:16. reps: pre→peak (באפליקציה פינג-פונג = 8 ש'). timed: kf→kf (לולאה טבעית).
// הרצה: node pipeline/clips.mjs <id...> | pilot     → outputs/stage2/<id>.mp4 + loops/<id>.mp4 + QA
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, config, generate, imageRef, copyTo } from './lib.mjs';
import { KF_DIR } from './keyframes.mjs';

const OUT = path.join(ROOT, 'outputs', 'stage2'); const LOOPS = path.join(OUT, 'loops');
fs.mkdirSync(LOOPS, { recursive: true });

const COMMON = {
  intro: 'A calm, elegant face-yoga tutorial. The same woman, same studio, same clothes and lighting, filmed in a single continuous shot.',
  face: 'Her hands keep exactly five fingers each and stay softly on the skin, never sliding into the mouth or eyes, never pulling or distorting the skin. Her forehead stays smooth. Her face keeps its identity exactly. Natural blinking.',
  camera: 'Static locked camera, no camera movement, no zoom, no cuts, framing unchanged, background unchanged.',
  negative: 'extra fingers, missing fingers, fused fingers, deformed hands, hands inside mouth, fingers in eyes, skin pulled, face morphing, identity change, wrinkled forehead, raised eyebrows, exaggerated grimace, talking, camera movement, zoom, cuts, scene change, text, captions, logos, watermark, other people, jewelry change',
};

// mode 'pingpong': start→end, האפליקציה מנגנת קדימה ואחורה. mode 'loop': start=end, תנועה עדינה באמצע.
export const CLIPS = {
  act_cheek_lift: { mode: 'pingpong', start: 'act_cheek_lift_pre', end: 'act_cheek_lift', text: 'With her fingertips resting on her cheekbones, she slowly breaks into a wide warm closed-lip smile, so the cheeks rise smoothly and press up against the fingertips. Only the cheeks and mouth move; the eyebrows and forehead stay still and smooth.' },
  act_eye_ring: { mode: 'pingpong', start: 'act_eye_ring_pre', end: 'act_eye_ring', attempt: 2, text: 'Her fingertips stay touching the skin around both eyes for the ENTIRE clip: the hands never lift off, never move away from the face, never leave the frame; only the eyes move. With her V-shaped fingers resting around both eyes, she slowly lifts her gaze upward (the head stays level) and gently tightens only the lower eyelids in a soft squint. The fingers do not move. The forehead stays smooth.' },
  rel_masseter: { mode: 'loop', start: 'rel_masseter', end: 'rel_masseter', text: 'With the flat pads of her fingers on the jaw muscles in front of the ears, she massages in slow, small, gentle circles, two slow circles in total. Her mouth stays slightly open and the jaw relaxed and heavy. Calm soft eyes.' },
};
export const clipPrompt = k => [COMMON.intro, CLIPS[k].mode === 'loop' ? 'It begins and ends in exactly the same pose so it loops seamlessly.' : 'She moves slowly and smoothly from the pose in the first frame to exactly the pose in the last frame, in one continuous motion.', CLIPS[k].text, COMMON.face, COMMON.camera].join(' ');

export async function makeClip(k) {
  const c = CLIPS[k]; if (!c) throw new Error(`אין קליף ${k}`);
  const start = path.join(KF_DIR, `${c.start}.png`), end = path.join(KF_DIR, `${c.end}.png`);
  const request = { model_id: config.video.model_id, prompt: clipPrompt(k), ...(c.attempt ? { seed: 1000 + c.attempt } : {}), negative_prompt: COMMON.negative, duration_secs: config.video.duration_secs, aspect_ratio: config.video.aspect_ratio, resolution: config.video.resolution, generate_audio: false, enhance_prompt: true, start_frame: imageRef(start), end_frame: imageRef(end) };
  const r = await generate('video', request, { ext: 'mp4', pollMs: 10000, stage: 2, label: `clip ${k}` });
  const dest = copyTo(r.file, path.join(OUT, `${k}.mp4`));
  fs.writeFileSync(path.join(OUT, `${k}.prompt.json`), JSON.stringify({ ...request, start_frame: `<${c.start}>`, end_frame: `<${c.end}>`, generation_id: r.id, cache_key: r.key }, null, 2));
  // לולאה: pingpong = קדימה+אחורה (8 ש'); loop = כמו שהוא. דחיסה לטלפון: 720 רוחב, crf 23, בלי שמע.
  const loop = path.join(LOOPS, `${k}.mp4`);
  const vf = c.mode === 'pingpong' ? '[0:v]split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1:a=0,scale=720:-2,format=yuv420p[v]' : '[0:v]scale=720:-2,format=yuv420p[v]';
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', dest, '-filter_complex', vf, '-map', '[v]', '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-movflags', '+faststart', loop]);
  // דף QA: 6 פריימים
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', dest, '-vf', "select='not(mod(n\\,19))',scale=300:-1,tile=6x1:margin=4:padding=4", '-frames:v', '1', path.join(OUT, `${k}_sheet.jpg`)]);
  return loop;
}

export const PILOT = ['act_cheek_lift', 'act_eye_ring', 'rel_masseter'];
if (process.argv[1] && import.meta.filename === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2); const keys = args[0] === 'pilot' ? PILOT : args;
  const res = await Promise.allSettled(keys.map(makeClip));
  res.forEach((r, j) => console.log(`${keys[j]}: ${r.status === 'fulfilled' ? r.value : 'FAILED ' + r.reason.message}`));
}
