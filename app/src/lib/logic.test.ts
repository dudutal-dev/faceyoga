import { RepCounter, WrinkleGuard } from './reps';
import { summarizeWeek, weekNumber, greenStreak } from './week';
import { adviseAfterSession, trend, softNudge } from './adapt';
import type { SessionRow } from '../db';

const row = (o: Partial<SessionRow>): SessionRow => ({ date: '2026-11-08', week: 1, kind: 'main', plannedMin: 12, actualSec: 720, status: 'done', exercises: [], pain: false, ...o });

describe('זיהוי חזרות', () => {
  it('חזרה נספרת רק אחרי החזקה מספקת', () => {
    const c = new RepCounter(0.5, 3000);
    c.push(0.6, 0); expect(c.holding).toBe(true);
    expect(c.push(0.1, 1000)?.type).toBe('drop');
    c.push(0.6, 2000); expect(c.push(0.1, 5500)?.type).toBe('rep');
    expect(c.reps).toBe(1);
  });
  it('היסטרזיס: רעד סביב הסף לא שובר החזקה', () => {
    const c = new RepCounter(0.5, 1000);
    c.push(0.55, 0); expect(c.push(0.45, 300)).toBeNull(); expect(c.holding).toBe(true);
  });
  it('התרעת קימוט: רק אחרי 700ms ברציפות, ולא שוב מיד', () => {
    const g = new WrinkleGuard(0.45, 700, 10000);
    expect(g.push(0.6, 0)).toBe(false); expect(g.push(0.6, 800)).toBe(true);
    expect(g.push(0.6, 900)).toBe(false); expect(g.push(0.6, 1700)).toBe(false);
  });
});

describe('שבוע', () => {
  it('מספר שבוע מתאריך התחלה', () => { expect(weekNumber('2026-11-01', '2026-11-07')).toBe(1); expect(weekNumber('2026-11-01', '2026-11-08')).toBe(2); });
  it('שבוע ירוק לפי מפגשים מלאים; בוקר נספר בדקות בלבד', () => {
    const s = [row({ date: '2026-11-01' }), row({ date: '2026-11-03' }), row({ date: '2026-11-04', kind: 'morning', actualSec: 240 })];
    const w = summarizeWeek(s, '2026-11-01', 1);
    expect(w.mainSessions).toBe(2); expect(w.green).toBe(false); expect(w.minutes).toBe(28);
    expect(summarizeWeek([...s, row({ date: '2026-11-05' })], '2026-11-01', 1).green).toBe(true);
    expect(summarizeWeek(s, '2026-11-01', 1, true).green).toBe(true); // קליל: יעד 2
  });
  it('רצף לא נשבר בגלל השבוע הנוכחי', () => {
    const s = [1, 2, 3].flatMap(w => [0, 2, 4].map(d => row({ week: w, date: `2026-11-0${d + 1}` })));
    expect(greenStreak(s, '2026-11-01', 4)).toBe(3);
  });
});

describe('בטיחות אחרי מפגש', () => {
  it('כאב פעמיים ברצף → הודעה', () => { expect(adviseAfterSession(row({ pain: true }), row({ pain: true }))).toHaveLength(1); expect(adviseAfterSession(row({ pain: true }), row({}))).toHaveLength(0); });
  it('לסת תפוסה מאוד → הצעת שחרור', () => { expect(adviseAfterSession(row({ feel: 2 }), undefined)[0]).toContain('לסת תפוסה'); });
  it('מגמה', () => {
    const c = (w: number, j: number) => ({ week: w, date: '', jawTension: j, puffiness: 5, satisfaction: 5 });
    expect(trend([c(2, 8), c(5, 4)], 'jawTension')).toBe('better'); expect(trend([c(2, 5)], 'jawTension')).toBeNull();
  });
  it('תזכורת רכה אחרי 3 ימים', () => { expect(softNudge('2026-11-01', '2026-11-03')).toBeNull(); expect(softNudge('2026-11-01', '2026-11-04')).not.toBeNull(); });
});
