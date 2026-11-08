// בטיחות: שאלון סינון → עצירה / התאמה. ניטור כאב ותחושת לסת → התאמות. דטרמיניסטי וניתן לבדיקה.
import type { CheckIn, SessionRow } from '../db';

export interface Question { key: string; text: string; detail: string; stop?: boolean }
export const SCREENING: Question[] = [
  { key: 'eyelid', text: 'עפעף שצנח לאחרונה, בצד אחד, או שהחמיר', detail: 'זה יכול להיות סימן לבעיה עצבית או שרירית. צריך בירור אצל רופא עיניים או נוירולוג לפני כל תרגול באזור העיניים.', stop: true },
  { key: 'palsy', text: 'שיתוק פנים (בל) או אי־סימטריה שהופיעה פתאום', detail: 'אימון פנים במצב כזה צריך הנחיה של פיזיותרפיסטית. אי־סימטריה פתאומית היא מצב חירום: פני מיד לעזרה רפואית.', stop: true },
  { key: 'tmj', text: 'כאב, נקישות או נעילה במפרק הלסת, או חריקת שיניים', detail: 'נדלג על תרגילי לסת עם התנגדות, ונשאיר יותר שחרור.' },
  { key: 'bleeding', text: 'תרופות לדילול דם או נטייה לשטפי דם', detail: 'בלי גואשה ובלי עיסוי עמוק.' },
  { key: 'rosacea', text: 'רוזציאה או נימים שבורים בפנים', detail: 'בלי גואשה ובלי עיסוי עמוק.' },
  { key: 'skin', text: 'אקנה פעילה, דרמטיטיס או פסוריאזיס בפנים', detail: 'בלי עיסוי והחלקה, רק תרגילי שריר.' },
  { key: 'pregnancy', text: 'היריון', detail: 'אפשר לתרגל. בלי מכשירי חום או חשמל (ממילא לא כלולים).' },
];
export const stopKeys = (s: Record<string, boolean>) => SCREENING.filter(q => q.stop && s[q.key]).map(q => q.key);

/** אחרי מפגש: כאב לסת או תחושה ≥4 פעמיים ברצף → מצב TMJ זמני. */
export function adviseAfterSession(last: SessionRow, prev: SessionRow | undefined): string[] {
  const out: string[] = [];
  if (last.pain && prev?.pain) out.push('דיווחת על כאב פעמיים ברצף. התרגילים שכאבו יוצאו מהתוכנית. אם הכאב נמשך, כדאי לבדוק אצל רופאת שיניים או פיזיותרפיסטית.');
  if ((last.feel ?? 10) <= 3) out.push('הלסת והצוואר עדיין מרגישים תפוסים. במפגש הבא נתחיל ממפגש "לסת תפוסה" קצר.');
  return out;
}

/** מגמה פשוטה בין הצ'ק־אין הראשון לאחרון (לתצוגה, בלי מספרים מומצאים). */
export function trend(rows: CheckIn[], key: 'jawTension' | 'puffiness' | 'satisfaction'): 'better' | 'same' | 'worse' | null {
  if (rows.length < 2) return null;
  const first = rows[0]![key], last = rows[rows.length - 1]![key];
  const d = last - first; const good = key === 'satisfaction' ? d : -d;
  return good >= 2 ? 'better' : good <= -2 ? 'worse' : 'same';
}

/** תזכורת רכה אחרי 3 ימים בלי תרגול. הזמנה, לא משימה. */
export function softNudge(lastISO: string | null, todayISO: string): string | null {
  if (!lastISO) return null;
  const days = Math.round((new Date(todayISO + 'T00:00:00').getTime() - new Date(lastISO + 'T00:00:00').getTime()) / 86400000);
  return days >= 3 ? 'כמה ימים בלי תרגול. ארבע דקות של בוקר? גם זה נספר.' : null;
}
