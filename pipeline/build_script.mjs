// מפיק את תסריט הקריינות מספריית התרגילים (מקור אמת יחיד באפליקציה) + ניקוד ממוקד מ-nikud.json.
// הרצה: node pipeline/build_script.mjs → content/scripts/he/all.md ; אחר כך: node pipeline/04_narration.mjs content/scripts/he/all.md
import fs from 'node:fs';
import path from 'node:path';
import { EXERCISES, LINES, ORDINALS, SESSION_OPEN, TEACHER, INTRO } from '../app/src/content/exercises.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const NIKUD = JSON.parse(fs.readFileSync(path.join(ROOT, 'pipeline', 'nikud.json'), 'utf8'));
// החלפת מילים שלמות בלבד (גבולות: רווח/פיסוק/תחילת-סוף)
export function nikud(text) {
  return text.replace(/[א-ת]+/g, w => NIKUD[w] ?? w);
}
const rows = [];
const add = (id, text) => rows.push(`id: ${id} | ${nikud(text)}`);
for (const e of EXERCISES) { add(`${e.id}_intro`, e.intro); if (e.cue) add(`${e.id}_cue`, e.cue); }
ORDINALS.forEach((w, i) => add(`count_${i + 1}`, w + '.'));
for (const [k, t] of Object.entries(LINES)) add(k, t);
for (const [w, t] of Object.entries(SESSION_OPEN)) add(`open_w${w}`, t);
for (const [w, t] of Object.entries(TEACHER)) add(`teacher_w${w}`, t);
for (const x of INTRO) add(x.id, x.text);
const out = path.join(ROOT, 'content', 'scripts', 'he', 'all.md');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, `# פנים 12 — תסריט קריינות (נוצר אוטומטית מ-app/src/content/exercises.ts, לא לערוך ידנית)\n\n${rows.join('\n')}\n`);
const chars = rows.reduce((a, r) => a + r.split('|')[1].length, 0);
console.log(`${rows.length} שורות, ${chars} תווים → ${out}`);
