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

  // ---------- שלב 5: שאר התרגילים ----------
  rel_posture: { ref: 'side', pose: 'Three-quarter side view as in the reference. She sits tall: the chin gently glides straight back (a soft chin tuck, not down), the back of the neck lengthens, the crown of the head reaches up, shoulders relaxed and down. Calm face. Both arms hang relaxed at her sides completely OUT OF FRAME: NO hands and NO fingers visible anywhere in the image.' },
  rel_neck_side: { ref: 'front', pose: 'She gently tilts her head to her right side, the right ear lowering toward the right shoulder, a soft comfortable stretch along the left side of the neck. Shoulders stay level and relaxed. Eyes softly closed, calm face. Hands not visible.' },
  rel_scm: { ref: 'front', pose: 'Her head is turned slightly to her left. Two fingertips (index and middle) of her right hand rest lightly on the right side of her neck just below the ear, on the long neck muscle, ready to stroke downward toward the collarbone. Calm face, shoulders relaxed.' },
  rel_temples: { ref: 'front', pose: 'The fingertips of both hands (index, middle and ring fingers together) rest lightly on her temples, beside the outer ends of the eyebrows, elbows low and relaxed. Eyes softly closed, peaceful expression, forehead smooth.' },
  rel_forehead_pre: { ref: 'front', pose: 'Both palms rest flat and relaxed side by side on the center of her forehead, fingers pointing toward each other, below the hairline. Eyes softly closed, peaceful face.' },
  rel_forehead: { ref: 'front', extra: ['rel_forehead_pre'], pose: 'Same hands as in the second reference, now slid outward: each palm rests flat on a temple at the side of the forehead, fingers pointing up. Eyes softly closed, forehead smooth and relaxed.' },
  act_cheek_o: { ref: 'front', pose: 'Her mouth forms a clear rounded vertical O shape, like saying the vowel "oo" with the jaw slightly open: the lips are rounded and stretched long over the teeth, teeth hidden. At the same time the cheeks are lifted high by a smile around the eyes. Eyes soft and slightly smiling, forehead smooth, eyebrows not raised. Both arms hang relaxed at her sides completely OUT OF FRAME: NO hands and NO fingers visible anywhere in the image.' },
  act_cheek_puff: { ref: 'front', pose: 'Lips closed and both cheeks clearly and fully puffed out with air like a balloon, the cheeks visibly round and inflated, a light playful look. Eyes soft and calm, forehead smooth. Both arms hang relaxed at her sides completely OUT OF FRAME: NO hands and NO fingers visible anywhere in the image.' },
  act_jaw_forward: { ref: 'side', pose: 'Three-quarter side view as in the reference. Her chin is lifted slightly and she gazes a little upward; her lower jaw is pushed gently forward so the lower teeth come slightly in front of the upper teeth, creating a visible stretch under the chin and along the front of the neck. Lips relaxed. Hands not visible.' },
  act_neck_kiss: { ref: 'side', pose: 'Three-quarter side view as in the reference. She tilts her head back slightly and looks up toward the ceiling, and pushes her lips forward in a kiss shape toward the ceiling; the front of her neck is long and engaged. Shoulders relaxed and down. Hands not visible.' },
  act_tongue_press: { ref: 'front', pose: 'Her right index finger rests lightly under the center of her chin, on the soft area under the jaw. Lips closed, calm relaxed face, slight gentle concentration, forehead smooth.' },
  act_lips_pre: { ref: 'front', pose: 'Both index fingertips rest lightly at the two corners of her mouth, other fingers curled softly. Lips relaxed and closed, calm face.' },
  act_lips: { ref: 'front', extra: ['act_lips_pre'], pose: 'Same finger placement as in the second reference: index fingertips at the corners of the mouth. Both lips are rolled inward over the teeth so the lips are hidden, the mouth a thin line, with a slight closed smile. Forehead smooth, eyes soft.' },
  act_brow_pre: { ref: 'front', pose: 'Her right palm rests flat across the whole forehead, just above the eyebrows, fingers pointing to the left, pressing very lightly. Eyes open and calm, relaxed face. She wears exactly the same champagne silk off-the-shoulder top as in the reference, with the straight horizontal neckline across both shoulders.' },
  act_brow: { ref: 'front', extra: ['act_brow_pre'], pose: 'Same palm placement as in the second reference, flat across the forehead. She tries to lift her eyebrows against the hand: the eyes open wider with a gentle bright expression, while the skin under the palm stays smooth (no forehead wrinkles). She wears exactly the same champagne silk off-the-shoulder top as in the reference, with the straight horizontal neckline across both shoulders.' },
  lift_sweep_start: { ref: 'front', pose: 'Both palms rest flat and softly on her lower face, the heels of the hands at the chin and fingers along the jawline toward the ears. Eyes softly closed, peaceful expression.' },
  lift_sweep: { ref: 'front', extra: ['lift_sweep_start'], pose: 'Both palms have swept upward and outward: now they rest flat at the sides of the face in front of the ears and temples, fingertips reaching toward the hairline. Eyes softly closed, peaceful expression, face lifted and relaxed.' },
  lift_jawline_start: { ref: 'front', pose: 'Each hand forms a soft V with the index and middle fingers that cups the jawline at the chin: the index finger above the jaw bone and the middle finger below it, both hands meeting near the center of the chin. Calm face.' },
  lift_jawline: { ref: 'front', extra: ['lift_jawline_start'], pose: 'The same V-shaped fingers cupping the jaw bone, now slid along the jawline to just below the ears on both sides. Calm face, neck long.' },
  lift_close: { ref: 'front', pose: 'Both palms gently cover her cheeks and the sides of her face, fingertips near the temples, eyes closed, a serene peaceful expression as if taking a deep breath. Mouth relaxed.' },
  am_drain: { ref: 'front', pose: 'The flat fingers of both hands rest lightly on her collarbones and the base of the neck, just above the collarbones, gently pressing like a feather. Calm morning expression, eyes soft, face fresh.' },
  am_eyes: { ref: 'front', pose: 'The ring finger of each hand rests lightly on the soft area under each eye, at the inner corner near the nose, other fingers curled softly away. Eyes open and calm, fresh morning look.' },
  rel_posture_front: { ref: 'front', pose: 'Frontal view. She has glided her whole head straight backward a little, like closing a drawer: the chin stays level (not tilted up, not down), the neck looks long, a very slight soft fold appears under the chin. Shoulders relaxed and down. Calm neutral face, eyes looking forward. Both arms hang relaxed at her sides completely OUT OF FRAME: NO hands and NO fingers visible anywhere in the image. She wears exactly the same champagne silk off-the-shoulder top with the straight horizontal neckline.' },
  act_lips_nohands: { ref: 'front', pose: 'Both lips are rolled inward over the teeth so the lips are completely hidden and the mouth is a straight thin closed line. NOT smiling, no teeth visible, corners of the mouth neutral. Eyes calm, forehead smooth. Both arms hang relaxed at her sides completely OUT OF FRAME: NO hands and NO fingers visible anywhere in the image. She wears exactly the same champagne silk off-the-shoulder top with the straight horizontal neckline.' },
  rel_tongue: { ref: 'front', pose: 'A completely relaxed, calm resting face: lips softly closed, jaw loose, teeth apart behind closed lips, eyes soft and half-lidded with a peaceful expression, breathing through the nose. Both arms hang relaxed at her sides completely OUT OF FRAME: NO hands and NO fingers visible anywhere in the image. She wears exactly the same champagne silk off-the-shoulder top with the straight horizontal neckline.' },
  hero: { ref: 'front', pose: 'A warm, radiant, welcoming smile to the camera, lips gently parted showing a hint of teeth, eyes smiling and bright, head tilted very slightly to one side, as if greeting a good friend. Both arms hang relaxed at her sides completely OUT OF FRAME: NO hands visible. She wears exactly the same champagne silk off-the-shoulder top with the straight horizontal neckline.' },
  gs_jaw_start: { ref: 'front', pose: 'She holds a smooth flat pale-green jade gua sha stone in her right hand, laid almost flat against the skin at the center of her chin on the jawline, the curved edge along the jaw bone. Calm face, skin with a light dewy glow of facial oil.' },
  gs_jaw: { ref: 'front', extra: ['gs_jaw_start'], pose: 'The same jade gua sha stone from the second reference, now glided along the jawline up to just below her right ear, held almost flat against the skin. Calm face, light dewy glow.' },
};

export const keyframePrompt = k => [SAME, KEYFRAMES[k].pose, HANDS, END].join(' ');

export async function makeKeyframe(k) {
  const def = KEYFRAMES[k]; if (!def) throw new Error(`אין תמונת-מפתח ${k}`);
  const refFile = def.ref === 'front' || def.ref === 'side' ? path.join(ROOT, 'content', 'character', `${def.ref}.png`) : path.join(KF_DIR, `${def.ref}.png`);
  const extra = (def.extra || []).map(e => imageRef(path.join(KF_DIR, `${e}.png`)));
  const request = { model_id: config.image.model_id, prompt: keyframePrompt(k), aspect_ratio: config.image.aspect_ratio, resolution: process.env.KF_RES || config.image.resolution, images: [imageRef(refFile), ...extra] };
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
