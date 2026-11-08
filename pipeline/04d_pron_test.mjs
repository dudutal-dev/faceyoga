// בדיקת הגייה: "פנים" (face) בכמה כתיבים, באותו קול. outputs/stage1/pron/
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib.mjs';
import { tts } from './04_narration.mjs';
const OUT = path.join(ROOT, 'outputs', 'stage1', 'pron'); fs.mkdirSync(OUT, { recursive: true });
const V = { a: 'הַפָּנִים שֶׁלָּךְ רְגוּעוֹת. יוֹגָה לַפָּנִים.', b: 'הַפָּאנִים שֶׁלָּךְ רְגוּעוֹת. יוֹגָה לַפָּאנִים.', c: 'הפַּנים שלך רגועות. יוגה לפַּנים.' };
for (const [k, text] of Object.entries(V)) { const { file } = await tts({ text, voiceId: 'EXAVITQu4vr4xnSDxMaL', modelId: 'eleven_v4', label: `pron_${k}` }); fs.copyFileSync(file, path.join(OUT, `panim_${k}.mp3`)); console.log(k, text); }
