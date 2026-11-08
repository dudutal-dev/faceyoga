// תמונות מפתח לכל תרגיל, מאותה מדריכה. ref: 'front' | 'side' | מזהה תמונת-מפתח קיימת. extra: תמונות-מפתח נוספות לעקביות.
// הרצה: node pipeline/keyframes.mjs <id...> | pilot
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, config, generate, imageRef, copyTo } from './lib.mjs';

export const KF_DIR = path.join(ROOT, 'outputs', 'stage2', 'keyframes'); fs.mkdirSync(KF_DIR, { recursive: true });

const SAME = 'Photorealistic beauty photograph of the exact same woman as in the first reference image: same face, same skin, same makeup, same sleek low chignon, same champagne silk off-the-shoulder top, same stud earrings, same warm ivory studio, same soft beauty lighting, same camera position and framing (head, neck, collarbones and shoulders).';
const HANDS = 'Her hands are elegant and anatomically correct: exactly five slender fingers on each hand, natural short nude manicure, fingertips touch the skin lightly without pressing it out of shape.';
const END = 'A single frozen moment, sharp focus, no motion blur. No text, no logos, no props, no other people.';

export const KEYFRAMES = {
  act_cheek_lift_pre: { ref: 'front', pose: 'She has raised both hands: the fingertips of her index and middle fingers rest lightly on the top of each cheekbone, the palms angled down and away from the face, elbows low. Her face is neutral and relaxed, lips softly closed, forehead smooth, eyes calm looking into the camera.' },
  act_cheek_lift: { ref: 'front', extra: ['act_cheek_lift_pre'], pose: 'Exactly the same hand placement as in the second reference image: fingertips of the index and middle fingers resting on the top of each cheekbone. She smiles a wide, warm smile with closed lips, so the cheeks lift and press up against the fingertips. Her forehead stays completely smooth and relaxed, eyebrows NOT raised, eyes soft and open.' },
  act_eye_ring_pre: { ref: 'front', pose: 'She has raised both hands and forms a soft V with the index and middle fingers of each hand around each eye: the middle fingertip rests at the outer end of the eyebrow and the index fingertip rests just below the outer corner of the eye on the cheekbone, gently stabilising the skin. Eyes open looking into the camera, face relaxed, forehead smooth.' },
  act_eye_ring: { ref: 'front', extra: ['act_eye_ring_pre'], pose: 'Exactly the same V-shaped finger placement around both eyes as in the second reference image. She looks upward with her eyes (the head stays level), and gently tightens only her lower eyelids in a soft squint. Forehead smooth, eyebrows not raised, the rest of the face relaxed.' },
  rel_masseter: { ref: 'front', pose: 'She has raised both hands: the flat pads of her index, middle and ring fingers rest on the jaw muscles on both sides of her face, just below the cheekbones and in front of the ears, fingers together and relaxed. Her mouth is very slightly open, lips parted a little, the jaw relaxed and dropped, eyes calm and soft, forehead smooth.' },
};

export const keyframePrompt = k => [SAME, KEYFRAMES[k].pose, HANDS, END].join(' ');

export async function makeKeyframe(k) {
  const def = KEYFRAMES[k]; if (!def) throw new Error(`אין תמונת-מפתח ${k}`);
  const refFile = def.ref === 'front' || def.ref === 'side' ? path.join(ROOT, 'content', 'character', `${def.ref}.png`) : path.join(KF_DIR, `${def.ref}.png`);
  const extra = (def.extra || []).map(e => imageRef(path.join(KF_DIR, `${e}.png`)));
  const request = { model_id: config.image.model_id, prompt: keyframePrompt(k), aspect_ratio: config.image.aspect_ratio, resolution: config.image.resolution, images: [imageRef(refFile), ...extra] };
  const r = await generate('image', request, { ext: 'png', pollMs: 3000, stage: 2, label: `keyframe ${k}` });
  return copyTo(r.file, path.join(KF_DIR, `${k}.png`));
}

export const PILOT = ['act_cheek_lift_pre', 'rel_masseter', 'act_eye_ring_pre', 'act_cheek_lift', 'act_eye_ring'];

if (process.argv[1] && import.meta.filename === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const keys = args[0] === 'pilot' ? PILOT : args;
  // קודם תמונות "pre" (בלי תלות), אחר כך תמונות השיא שתלויות בהן
  const first = keys.filter(k => !KEYFRAMES[k].extra), second = keys.filter(k => KEYFRAMES[k].extra);
  for (const batch of [first, second]) {
    const res = await Promise.allSettled(batch.map(makeKeyframe));
    res.forEach((r, j) => console.log(`${batch[j]}: ${r.status === 'fulfilled' ? 'ok' : 'FAILED ' + r.reason.message}`));
  }
}
