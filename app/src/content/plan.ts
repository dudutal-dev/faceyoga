// התוכנית: 12 שבועות ב-4 שלבים + תחזוקה, 3 מוקדים מתחלפים, ובונה המפגש.
// כל מפגש: שחרור (מהצוואר למעלה) → הפעלה (מוקד היום) → הרמה. סינון בטיחות וכאב מסננים תרגילים.
import { EX, type Exercise } from './exercises';
import type { Profile, Zone, SessionKind } from '../db';

export interface Stage { key: 'A' | 'B' | 'C' | 'D' | 'M'; nameHe: string; weeks: [number, number]; repsMul: number; hold: number; perWeek: number; minutes: number }
export const STAGES: Stage[] = [
  { key: 'A', nameHe: 'היכרות', weeks: [1, 2], repsMul: 1, hold: 5, perWeek: 3, minutes: 12 },
  { key: 'B', nameHe: 'בנייה', weeks: [3, 6], repsMul: 1, hold: 6, perWeek: 3, minutes: 15 },
  { key: 'C', nameHe: 'העמקה', weeks: [7, 10], repsMul: 1.25, hold: 8, perWeek: 4, minutes: 18 },
  { key: 'D', nameHe: 'ביסוס', weeks: [11, 12], repsMul: 1.25, hold: 8, perWeek: 4, minutes: 18 },
  { key: 'M', nameHe: 'תחזוקה', weeks: [13, 999], repsMul: 1, hold: 8, perWeek: 2, minutes: 15 },
];
export const stageOf = (week: number): Stage => STAGES.find(s => week >= s.weeks[0] && week <= s.weeks[1]) ?? STAGES[4]!;
export const WEEKLY_GOAL_MIN = 60;
export const PROGRAM_WEEKS = 12;
export const PHOTO_WEEKS = [0, 6, 12, 24] as const;

/** שלושה מוקדים מתחלפים לפי מספר המפגש בשבוע. */
export type Focus = 'lower' | 'upper' | 'neck';
export const FOCUS_HE: Record<Focus, string> = { lower: 'לחיים ולסת', upper: 'עיניים ומצח', neck: 'צוואר ושפתיים' };
const FOCUS_ORDER: Focus[] = ['lower', 'upper', 'neck', 'lower'];
const FOCUS_SETS: Record<Focus, string[]> = {
  lower: ['act_cheek_lift', 'act_cheek_o', 'act_cheek_puff', 'act_jaw_forward', 'act_lips'],
  upper: ['act_eye_ring', 'act_brow', 'act_cheek_lift', 'act_cheek_puff'],
  neck: ['act_neck_kiss', 'act_tongue_press', 'act_lips', 'act_cheek_lift', 'act_jaw_forward'],
};
const RELEASE = ['rel_posture', 'rel_neck_side', 'rel_scm', 'rel_masseter', 'rel_temples', 'rel_forehead', 'rel_tongue'];
const LIFT_BY_FOCUS: Record<Focus, string[]> = { lower: ['lift_jawline', 'lift_sweep'], upper: ['lift_sweep'], neck: ['lift_jawline', 'lift_sweep'] };

export const QUICK: Record<string, { nameHe: string; sub: string; ids: string[] }> = {
  morning: { nameHe: 'רוטינת בוקר', sub: '4 דקות · נפיחות בוקר', ids: ['am_drain', 'am_eyes', 'rel_masseter', 'lift_sweep'] },
  jaw: { nameHe: 'לסת תפוסה', sub: '3 דקות · אחרי יום עמוס', ids: ['rel_masseter', 'rel_temples', 'rel_tongue', 'rel_neck_side'] },
  event: { nameHe: 'לפני אירוע', sub: '5 דקות · רעננות לכמה שעות', ids: ['am_drain', 'am_eyes', 'act_cheek_lift', 'lift_jawline', 'lift_sweep'] },
  sleep: { nameHe: 'לפני שינה', sub: '3 דקות · להירגע', ids: ['rel_forehead', 'rel_temples', 'rel_masseter', 'lift_close'] },
};

// ---------- סינון ----------
export interface Filter { excluded: Set<string>; reasons: string[] }

/** מה אסור עכשיו, לפי סינון, טיפולים פעילים ודיווחי כאב. */
export function buildFilter(p: Pick<Profile, 'screening' | 'treatments' | 'hasGuaSha'>, todayISO: string, painCounts: Record<string, number> = {}): Filter {
  const ex = new Set<string>(); const reasons: string[] = [];
  const s = p.screening;
  const all = Object.values(EX);
  const drop = (pred: (e: Exercise) => boolean, why: string) => { let n = 0; for (const e of all) if (pred(e) && !ex.has(e.id)) { ex.add(e.id); n++; } if (n) reasons.push(why); };
  if (s.eyelid) drop(e => e.tags.includes('eyes'), 'עפעף שצנח לאחרונה: בלי תרגילי עיניים עד בירור אצל רופא');
  if (s.tmj) drop(e => e.tags.includes('jawResist'), 'כאב או נקישות בלסת: בלי תרגילי לסת עם התנגדות');
  if (s.bleeding || s.rosacea) drop(e => e.tags.includes('guasha') || e.tags.includes('deep'), 'מדללי דם, רוזציאה או נימים: בלי גואשה ובלי עיסוי עמוק');
  if (s.skin) drop(e => e.tags.includes('massage') || e.tags.includes('guasha'), 'עור מגורה או אקנה פעילה: בלי עיסוי, רק תרגילי שריר');
  if (!p.hasGuaSha) drop(e => e.tags.includes('guasha'), '');
  for (const t of p.treatments) {
    if (t.until < todayISO) continue;
    const zones = new Set<Zone>(t.zones);
    if (t.type === 'botox') drop(e => e.zones.some(z => zones.has(z)), `בוטוקס: מדלגות על ${t.zones.length} אזורים עד ${t.until}`);
    else drop(e => e.zones.some(z => zones.has(z)) && (e.tags.includes('massage') || e.tags.includes('guasha') || e.tags.includes('deep')), `${t.type === 'filler' ? 'מילוי' : t.type === 'threads' ? 'חוטים' : 'ניתוח'}: בלי עיסוי באזור עד ${t.until}`);
  }
  const painful = Object.entries(painCounts).filter(([, n]) => n >= 2).map(([id]) => id);
  if (painful.length) { painful.forEach(id => ex.add(id)); reasons.push(`${painful.length} תרגילים שכאבו פעמיים הוצאו מהתוכנית`); }
  return { excluded: ex, reasons: reasons.filter(Boolean) };
}

// ---------- בונה המפגש ----------
export interface Step {
  key: string;
  exercise: Exercise;
  reps: number;          // reps: מספר חזרות; timed: 0
  holdSec: number;
  durationSec: number;   // timed
  narration: string[];   // מזהי קריינות לפתיחת התרגיל
  estSec: number;
}
export interface Session { kind: SessionKind; week: number; focus?: Focus; title: string; steps: Step[]; plannedMin: number; openLine?: string; teacherLine?: string; closeLine: string }

const REST_SEC = 3, INTRO_SEC = 14;

export function makeStep(e: Exercise, stage: Stage, opts: { light?: boolean } = {}): Step {
  if (e.kind === 'timed') {
    const d = e.durationSec ?? 30;
    return { key: e.id, exercise: e, reps: 0, holdSec: 0, durationSec: d, narration: [`${e.id}_intro`], estSec: d + INTRO_SEC };
  }
  const isMassage = (e.holdSec ?? 5) <= 3; // תנועות ליטוף: החזקה קצרה קבועה
  const reps = Math.max(4, Math.round((e.reps ?? 8) * (opts.light ? 0.75 : stage.repsMul)));
  const hold = isMassage ? (e.holdSec ?? 2) : stage.hold;
  return { key: e.id, exercise: e, reps, holdSec: hold, durationSec: 0, narration: [`${e.id}_intro`], estSec: INTRO_SEC + reps * (hold + (isMassage ? 1 : REST_SEC)) };
}

/** מפגש ראשי. index = מספר המפגש בשבוע (0..). */
export function buildMainSession(week: number, index: number, filter: Filter, opts: { hasGuaSha?: boolean; firstOfWeek?: boolean; track?: Profile['track'] } = {}): Session {
  const stage = stageOf(week);
  const focus = FOCUS_ORDER[index % FOCUS_ORDER.length]!;
  const ok = (id: string) => { const e = EX[id]; return !!e && e.minWeek <= week && !filter.excluded.has(id); };
  const light = opts.track === 'light';
  const release = RELEASE.filter(ok).slice(0, 5);
  const acts = FOCUS_SETS[focus].filter(ok).slice(0, light ? 3 : stage.key === 'A' ? 4 : 5);
  const lift = LIFT_BY_FOCUS[focus].filter(ok);
  if (opts.hasGuaSha && week >= 3 && ok('gs_jaw') && index % 2 === 0) lift.unshift('gs_jaw');
  if (ok('lift_close')) lift.push('lift_close');
  const steps = [...release, ...acts, ...lift].map(id => makeStep(EX[id]!, stage, { light }));
  const sec = steps.reduce((a, s) => a + s.estSec, 0) + 30;
  const wk = week > PROGRAM_WEEKS ? 13 : week;
  return {
    kind: 'main', week, focus, title: `${FOCUS_HE[focus]}`, steps, plannedMin: Math.round(sec / 60),
    openLine: opts.firstOfWeek ? `open_w${wk}` : undefined,
    teacherLine: opts.firstOfWeek && [1, 2, 4, 6, 8, 12].includes(week) ? `teacher_w${week}` : undefined,
    closeLine: 'session_close',
  };
}

export function buildQuickSession(key: keyof typeof QUICK | string, week: number, filter: Filter): Session {
  const q = QUICK[key] ?? QUICK.jaw!;
  const stage = stageOf(Math.max(1, week));
  const steps = q.ids.filter(id => EX[id] && !filter.excluded.has(id)).map(id => makeStep(EX[id]!, stage, { light: true }));
  return { kind: key === 'morning' ? 'morning' : 'quick', week, title: q.nameHe, steps, plannedMin: Math.max(1, Math.round(steps.reduce((a, s) => a + s.estSec, 0) / 60)), openLine: key === 'morning' ? 'morning_open' : 'quick_open', closeLine: key === 'morning' ? 'morning_close' : 'session_close_short' };
}

export function buildSingle(id: string, week: number): Session {
  const e = EX[id]!; const step = makeStep(e, stageOf(Math.max(1, week)));
  return { kind: 'single', week, title: e.nameHe, steps: [step], plannedMin: Math.max(1, Math.round(step.estSec / 60)), closeLine: 'session_close_short' };
}

/** מה חדש בשבוע הזה (לכרטיס התוכנית). */
export function newInWeek(week: number): Exercise[] {
  return Object.values(EX).filter(e => e.minWeek === week && e.phase !== 'guasha');
}
