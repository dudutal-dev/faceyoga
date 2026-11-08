// שלב 1 — המדריכה: 4 מועמדות, קרוב חזיתי (ראש-כתפיים), 9:16. תוצרים: outputs/stage1/
// הרצה: node pipeline/01_character.mjs            → 4 מועמדות חזית
//        node pipeline/01_character.mjs side <N>   → פרופיל למועמדת N (אחרי בחירת דודו), ומעתיק את שתיהן ל-content/character
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, config, generate, imageRef, copyTo } from './lib.mjs';

const OUT = path.join(ROOT, 'outputs', 'stage1'); fs.mkdirSync(OUT, { recursive: true });

// מה שהווידאו צריך: פנים ברורות, ידיים יכולות להיכנס לפריים, עור אמיתי, רקע אחיד.
const BASE = [
  'Photorealistic close-up portrait photograph of a single Israeli woman about 42 years old, {who}.',
  'Natural real skin with visible fine texture and subtle natural expression lines around the eyes, NOT airbrushed, NOT retouched, minimal natural makeup, warm kind calm expression, lips relaxed and closed.',
  'Framing: head, neck, collarbones and top of the shoulders, the face fills the upper-middle of the frame with generous space around it so both hands can later touch the face without leaving the frame. Camera at eye level, {view}.',
  'Wearing {clothes}, neckline open so the whole neck is visible. Hair pulled back away from the face, forehead, ears and jawline fully visible.',
  'Plain solid warm off-white studio background, soft even diffused frontal light like a beauty tutorial, no harsh shadows.',
  'No jewelry, no text, no watermark, no logos, no props, no other people.',
].join(' ');
export const CANDIDATES = [
  { n: 1, who: 'olive skin, dark brown hair in a low bun, dark brown eyes, soft oval face', clothes: 'a simple champagne-coloured scoop-neck top' },
  { n: 2, who: 'light skin, honey-brown hair in a low ponytail, hazel eyes, gentle heart-shaped face', clothes: 'a simple dusty-rose scoop-neck top' },
  { n: 3, who: 'medium-tan skin, black curly hair tied back, brown eyes, warm round face', clothes: 'a simple soft sage-green scoop-neck top' },
  { n: 4, who: 'fair skin with light freckles, auburn hair in a low bun, green eyes, elegant long face', clothes: 'a simple cream scoop-neck top' },
];
const VIEWS = {
  front: 'frontal view, she looks straight into the camera',
  side: 'exact side profile view from her right side, she faces the left edge of the frame, same woman, same clothes, same studio, same lighting, same framing',
};
const prompt = (c, view) => BASE.replace('{who}', c.who).replace('{clothes}', c.clothes).replace('{view}', VIEWS[view]);

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
