// שלב 1 — המדריכה: 4 מועמדות, קרוב חזיתי (ראש-כתפיים), 9:16. תוצרים: outputs/stage1/
// הרצה: node pipeline/01_character.mjs            → 4 מועמדות חזית
//        node pipeline/01_character.mjs side <N>   → פרופיל למועמדת N (אחרי בחירת דודו), ומעתיק את שתיהן ל-content/character
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, config, generate, imageRef, copyTo } from './lib.mjs';

const OUT = path.join(ROOT, 'outputs', 'stage1'); fs.mkdirSync(OUT, { recursive: true });

// מה שהווידאו צריך: פנים ברורות, ידיים יכולות להיכנס לפריים, עור אמיתי, רקע אחיד.
// גרסה 2 (משוב דודו 8.11): הרבה יותר אסתטית ויפה, לבוש אלגנטי. עדיין עור אמיתי (לא פלסטיק) כדי שהתרגילים ייראו אמינים.
const BASE = [
  'High-end beauty campaign photograph, photorealistic, of a single strikingly beautiful, elegant Israeli woman about 38 years old, {who}.',
  'Radiant, glowing, healthy and luminous skin with natural real texture (not plastic, not over-retouched), refined polished natural makeup: soft luminous base, groomed brows, subtle defined lashes, soft nude-rose lips. Graceful long neck, defined cheekbones, serene confident gentle smile with closed lips.',
  'Framing: head, neck, collarbones and shoulders, the face in the upper-middle of the frame with generous space around it so both hands can later touch the face without leaving the frame. Camera at eye level, {view}.',
  'Wearing {clothes}. The whole neck, collarbones and jawline are fully visible. Hair beautifully styled and pulled back away from the face, forehead and ears visible.',
  'Luxurious minimal spa setting: soft warm seamless backdrop in {bg}, gentle wraparound beauty lighting with a soft glow, flattering and even, subtle depth.',
  'Small delicate stud earrings only. No text, no watermark, no logos, no props, no other people.',
].join(' ');
export const CANDIDATES = [
  { n: 5, who: 'olive sun-kissed skin, glossy dark chocolate-brown hair in a sleek low chignon, warm brown almond eyes', clothes: 'an elegant champagne silk off-the-shoulder top with a soft draped neckline', bg: 'warm ivory' },
  { n: 6, who: 'light luminous skin, long honey-blonde hair in a polished low ponytail, soft hazel eyes', clothes: 'an elegant blush-pink fine-knit off-the-shoulder top', bg: 'soft blush beige' },
  { n: 7, who: 'warm golden-tan skin, glossy black hair in an elegant low bun with soft face-framing strands tucked back, deep brown eyes', clothes: 'an elegant ivory satin wrap top with a wide open V neckline showing the collarbones', bg: 'warm sand' },
  { n: 8, who: 'fair porcelain skin with a soft natural flush, rich copper-auburn hair in a smooth low chignon, bright green eyes', clothes: 'an elegant soft sage silk camisole-style top with thin straps', bg: 'pale warm grey' },
];
const VIEWS = {
  front: 'frontal view, she looks straight into the camera',
  side: 'exact side profile view from her right side, she faces the left edge of the frame, same woman, same clothes, same studio, same lighting, same framing',
};
const prompt = (c, view) => BASE.replace('{who}', c.who).replace('{clothes}', c.clothes).replace('{bg}', c.bg).replace('{view}', VIEWS[view]);

async function makeImage(c, view, refFile) {
  const request = { model_id: config.image.model_id, prompt: prompt(c, view), aspect_ratio: config.image.aspect_ratio, resolution: config.image.resolution };
  if (refFile) request.images = [imageRef(refFile)];
  const r = await generate('image', request, { ext: 'png', pollMs: 3000, stage: 1, label: `character ${c.n} ${view}` });
  return copyTo(r.file, path.join(OUT, `candidate_${c.n}_${view}.png`));
}

const [mode, which] = process.argv.slice(2);
if (mode === 'side') {
  const c = CANDIDATES.find(x => x.n === Number(which)); if (!c) throw new Error('מספר מועמדת לא תקין');
  const front = path.join(OUT, `candidate_${c.n}_front.png`);
  const side = await makeImage(c, 'side', front);
  copyTo(front, path.join(ROOT, 'content', 'character', 'front.png'));
  copyTo(side, path.join(ROOT, 'content', 'character', 'side.png'));
  console.log(side);
} else {
  const files = await Promise.all(CANDIDATES.map(c => makeImage(c, 'front').catch(e => { console.error(`מועמדת ${c.n}: ${e.message}`); return null; })));
  fs.writeFileSync(path.join(OUT, 'prompts.json'), JSON.stringify(CANDIDATES.map(c => ({ ...c, prompt: prompt(c, 'front') })), null, 2));
  console.log('\nתוצאות:'); files.forEach(f => console.log(' ', f));
}
