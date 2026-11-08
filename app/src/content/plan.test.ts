import { buildFilter, buildMainSession, buildQuickSession, stageOf, QUICK } from './plan';
import { EX, EXERCISES } from './exercises';
import { blankProfile } from '../db';

const base = blankProfile();
const noFilter = buildFilter(base, '2026-11-08');

describe('תוכנית', () => {
  it('כל מזהה בתוכנית קיים בספרייה', () => {
    for (const q of Object.values(QUICK)) for (const id of q.ids) expect(EX[id]).toBeTruthy();
    for (let w = 1; w <= 14; w++) for (let i = 0; i < 4; i++) for (const s of buildMainSession(w, i, noFilter).steps) expect(EX[s.exercise.id]).toBeTruthy();
  });
  it('סדר: שחרור → הפעלה → הרמה, ומסתיים בסגירה', () => {
    const s = buildMainSession(5, 0, noFilter);
    const phases = s.steps.map(x => x.exercise.phase);
    const firstAct = phases.indexOf('activate');
    expect(phases.slice(0, firstAct).every(p => p === 'release')).toBe(true);
    expect(s.steps.at(-1)!.exercise.id).toBe('lift_close');
  });
  it('אורך מפגש לפי שלב: 12 דק׳ בהיכרות, עד 22 בהעמקה', () => {
    expect(buildMainSession(1, 0, noFilter).plannedMin).toBeGreaterThanOrEqual(9);
    expect(buildMainSession(1, 0, noFilter).plannedMin).toBeLessThanOrEqual(15);
    expect(buildMainSession(8, 0, noFilter).plannedMin).toBeLessThanOrEqual(22);
  });
  it('תרגיל לא מופיע לפני שבוע הכניסה שלו', () => {
    const ids = buildMainSession(1, 0, noFilter).steps.map(s => s.exercise.id);
    expect(ids).not.toContain('act_jaw_forward');
    expect(ids).not.toContain('rel_temples');
  });
  it('החזקות ארוכות יותר בהעמקה', () => {
    const h = (w: number) => buildMainSession(w, 0, noFilter).steps.find(s => s.exercise.id === 'act_cheek_lift')!.holdSec;
    expect(h(1)).toBe(5); expect(h(8)).toBe(8);
    expect(stageOf(30).key).toBe('M');
  });
  it('פתיחת שבוע והודעת מדריכה רק במפגש הראשון של השבוע', () => {
    expect(buildMainSession(6, 0, noFilter, { firstOfWeek: true }).teacherLine).toBe('teacher_w6');
    expect(buildMainSession(6, 1, noFilter).openLine).toBeUndefined();
  });
});

describe('סינון בטיחות', () => {
  it('עפעף שצנח: בלי תרגילי עיניים', () => {
    const f = buildFilter({ ...base, screening: { eyelid: true } }, '2026-11-08');
    expect(f.excluded.has('act_eye_ring')).toBe(true); expect(f.excluded.has('am_eyes')).toBe(true);
    for (let i = 0; i < 4; i++) expect(buildMainSession(5, i, f).steps.some(s => s.exercise.tags.includes('eyes'))).toBe(false);
  });
  it('TMJ: בלי לסת עם התנגדות', () => {
    const f = buildFilter({ ...base, screening: { tmj: true } }, '2026-11-08');
    expect(f.excluded.has('act_jaw_forward')).toBe(true); expect(f.excluded.has('rel_masseter')).toBe(false);
  });
  it('בוטוקס במצח: מדלגים עד 6 שבועות, ואז חוזרים', () => {
    const p = { ...base, treatments: [{ id: 't', type: 'botox' as const, zones: ['forehead' as const], date: '2026-11-01', until: '2026-12-13' }] };
    expect(buildFilter(p, '2026-11-08').excluded.has('act_brow')).toBe(true);
    expect(buildFilter(p, '2026-12-14').excluded.has('act_brow')).toBe(false);
  });
  it('מילוי: בלי עיסוי באזור, אבל תרגילי שריר נשארים', () => {
    const p = { ...base, treatments: [{ id: 't', type: 'filler' as const, zones: ['cheeks' as const], date: '2026-11-01', until: '2026-11-29' }] };
    const f = buildFilter(p, '2026-11-08');
    expect(f.excluded.has('lift_sweep')).toBe(true); expect(f.excluded.has('act_cheek_lift')).toBe(false);
  });
  it('גואשה רק למי שיש אבן ובלי מדללי דם', () => {
    expect(noFilter.excluded.has('gs_jaw')).toBe(true);
    expect(buildFilter({ ...base, hasGuaSha: true }, '2026-11-08').excluded.has('gs_jaw')).toBe(false);
    expect(buildFilter({ ...base, hasGuaSha: true, screening: { bleeding: true } }, '2026-11-08').excluded.has('gs_jaw')).toBe(true);
  });
  it('כאב פעמיים → התרגיל יוצא', () => {
    expect(buildFilter(base, '2026-11-08', { act_lips: 2 }).excluded.has('act_lips')).toBe(true);
    expect(buildFilter(base, '2026-11-08', { act_lips: 1 }).excluded.has('act_lips')).toBe(false);
  });
  it('מפגש מהיר לא כולל תרגיל מסונן', () => {
    const f = buildFilter({ ...base, screening: { eyelid: true } }, '2026-11-08');
    expect(buildQuickSession('morning', 3, f).steps.map(s => s.exercise.id)).not.toContain('am_eyes');
  });
});

describe('ספרייה', () => {
  it('מזהים ייחודיים, טקסט קריינות לכל תרגיל, ושלושה שלבים לכרטיס', () => {
    expect(new Set(EXERCISES.map(e => e.id)).size).toBe(EXERCISES.length);
    for (const e of EXERCISES) { expect(e.intro.length).toBeGreaterThan(30); expect(e.steps).toHaveLength(3); }
  });
  it('אין הבטחות אסורות בטקסטים', () => {
    const all = EXERCISES.map(e => e.intro + e.expect + (e.cue ?? '')).join(' ');
    for (const bad of ['בוטוקס', 'מוכח מדעית', 'צעירה ב', 'דיטוקס', 'יחליק את הקמטים', 'מרים את העפעף']) expect(all).not.toContain(bad);
  });
});
