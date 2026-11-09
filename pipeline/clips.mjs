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

  // ---------- שלב 5 ----------  start: 'front'/'side' = תמונת הדמות בלי ידיים. forward = מתנגן קדימה בלבד ומתחיל מחדש (תנועות כלפי מעלה).
  rel_posture: { mode: 'pingpong', start: 'side', end: 'rel_posture', text: 'Sitting tall, she slowly glides her chin straight back into a gentle chin tuck while the back of the neck lengthens upward. Very small, slow movement.' },
  rel_neck_side: { mode: 'pingpong', start: 'front', end: 'rel_neck_side', text: 'She slowly and gently tilts her head to her right, the ear lowering toward the shoulder, shoulders staying level, eyes closing softly.' },
  rel_scm: { mode: 'forward', start: 'rel_scm', end: 'rel_scm', text: 'Her two fingertips stroke slowly and lightly DOWNWARD along the side of her neck from below the ear toward the collarbone, then lift off and return to below the ear, twice, always stroking only downward.' },
  rel_temples: { mode: 'loop', start: 'rel_temples', end: 'rel_temples', text: 'Her fingertips make small slow gentle circles on her temples, two slow circles. Eyes closed, peaceful.' },
  rel_forehead: { mode: 'forward', start: 'rel_forehead_pre', end: 'rel_forehead', text: 'Both palms glide slowly and smoothly outward across the forehead from the center to the temples, like gently ironing soft fabric. Eyes closed.' },
  act_cheek_o: { mode: 'pingpong', start: 'front', end: 'act_cheek_o', attempt: 2, text: 'Her hands stay down OUT OF FRAME the whole clip; no hands, no fingers anywhere, no teeth showing. She slowly draws her lips into a soft O over her teeth and lifts her cheeks in a smile, only the mouth and cheeks move.' },
  act_cheek_puff: { mode: 'pingpong', start: 'front', end: 'act_cheek_puff', text: 'She slowly fills her cheeks with air so both cheeks puff out softly, lips closed.' },
  act_jaw_forward: { mode: 'pingpong', start: 'side', end: 'act_jaw_forward', text: 'She slowly lifts her chin slightly and pushes her lower jaw gently forward until the front of the neck stretches.' },
  act_neck_kiss: { mode: 'pingpong', start: 'side', end: 'act_neck_kiss', text: 'She slowly tilts her head back a little to look at the ceiling and pushes her lips forward into a kiss toward the ceiling.' },
  act_lips: { mode: 'pingpong', start: 'act_lips_pre', end: 'act_lips', attempt: 2, text: 'The lips disappear inward over the teeth: NO teeth visible at any moment, no open smile, the mouth stays closed. The fingertips do not pull the mouth. With index fingertips resting at the corners of her mouth, she slowly rolls both lips inward over her teeth and adds a slight closed smile.' },
  act_brow: { mode: 'pingpong', start: 'act_brow_pre', end: 'act_brow', text: 'With her palm flat on her forehead, she slowly tries to lift her eyebrows against the hand; the eyes open a little wider while the forehead skin stays smooth under the palm.' },
  lift_sweep: { mode: 'forward', start: 'lift_sweep_start', end: 'lift_sweep', text: 'Both palms sweep slowly and smoothly UPWARD and outward from the chin along the jaw to in front of the ears and temples, one long gentle lifting stroke.' },
  lift_jawline: { mode: 'forward', start: 'lift_jawline_start', end: 'lift_jawline', text: 'The V-shaped fingers glide slowly along the jaw bone from the chin up to just below the ears, one smooth stroke on both sides together.' },
  lift_close: { mode: 'loop', start: 'lift_close', end: 'lift_close', text: 'Her palms rest on her face, eyes closed; she takes one slow deep breath, the shoulders rising very slightly and softening. Almost still.' },
  am_drain: { mode: 'loop', start: 'am_drain', end: 'am_drain', text: 'Her flat fingers press very lightly and release above the collarbones, two gentle slow pumps, like a feather.' },
  am_eyes: { mode: 'loop', start: 'am_eyes', end: 'am_eyes', attempt: 2, text: 'Eyes stay OPEN and calm the whole clip. Only the ring fingertips move, tapping very lightly on the cheekbone below the eyes; the fingers never touch the eyes, eyelids or nose, never rub. Her ring fingers tap very lightly under the eyes, moving slowly from the inner corner outward, like tiny raindrops, then return to the inner corner.' },
  hero: { mode: 'pingpong', start: 'front', end: 'hero', text: 'A welcome greeting: she looks into the camera, softly breathes in, and her face slowly blossoms into a warm radiant welcoming smile with a very slight graceful head tilt, a natural blink. No hands in frame at any moment. Elegant, calm, cinematic.' },
  gs_jaw: { mode: 'forward', start: 'gs_jaw_start', end: 'gs_jaw', text: 'She glides the jade gua sha stone slowly and smoothly along her jawline from the chin up to below the ear, held almost flat, one gentle stroke.' },
};
export const clipPrompt = k => [COMMON.intro, CLIPS[k].mode === 'loop' ? 'It begins and ends in exactly the same pose so it loops seamlessly.' : 'She moves slowly and smoothly from the pose in the first frame to exactly the pose in the last frame, in one continuous motion.', CLIPS[k].text, COMMON.face, COMMON.camera].join(' ');

export async function makeClip(k) {
  const c = CLIPS[k]; if (!c) throw new Error(`אין קליף ${k}`);
  const at = k => (k === 'front' || k === 'side') ? path.join(ROOT, 'content', 'character', `${k}.png`) : path.join(KF_DIR, `${k}.png`);
  const start = at(c.start), end = at(c.end);
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
  for (let i = 0; i < keys.length; i += 6) {
    const batch = keys.slice(i, i + 6);
    const res = await Promise.allSettled(batch.map(makeClip));
    res.forEach((r, j) => console.log(`${batch[j]}: ${r.status === 'fulfilled' ? r.value : 'FAILED ' + r.reason.message}`));
  }
}
