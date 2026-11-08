// חישובי שבוע: טבעת 60 דקות, שבוע ירוק (≥ מפגשים מתוכננים לשלב), רצף שבועות. יום שפוספס לא מאפס כלום.
import type { SessionRow } from '../db';
import { WEEKLY_GOAL_MIN, stageOf } from '../content/plan';

export function daysBetween(aISO: string, bISO: string): number {
  const a = new Date(aISO + 'T00:00:00'), b = new Date(bISO + 'T00:00:00');
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}
export const weekNumber = (startISO: string, dateISO: string) => Math.max(1, Math.floor(daysBetween(startISO, dateISO) / 7) + 1);
export const dayInWeek = (startISO: string, dateISO: string) => ((daysBetween(startISO, dateISO) % 7) + 7) % 7;

export interface WeekSummary { week: number; minutes: number; mainSessions: number; target: number; ringFraction: number; green: boolean; days: boolean[] }

/** מפגשי בוקר וקצרים נספרים בדקות; "שבוע ירוק" נקבע לפי מפגשים מלאים. במסלול קליל היעד נמוך באחד. */
export function summarizeWeek(sessions: SessionRow[], startISO: string, week: number, light = false): WeekSummary {
  const rows = sessions.filter(s => s.week === week && s.actualSec > 0);
  const minutes = Math.round(rows.reduce((a, s) => a + s.actualSec, 0) / 60);
  const mainSessions = rows.filter(s => s.kind === 'main' && s.status !== 'stopped').length;
  const target = Math.max(2, stageOf(week).perWeek - (light ? 1 : 0));
  const days = Array.from({ length: 7 }, (_, d) => rows.some(s => dayInWeek(startISO, s.date) === d));
  return { week, minutes, mainSessions, target, ringFraction: Math.min(1, minutes / WEEKLY_GOAL_MIN), green: mainSessions >= target, days };
}

export function greenStreak(sessions: SessionRow[], startISO: string, currentWeek: number, light = false): number {
  let streak = 0;
  for (let w = currentWeek; w >= 1; w--) {
    if (summarizeWeek(sessions, startISO, w, light).green) streak++;
    else if (w !== currentWeek) break; // השבוע הנוכחי עוד לא נגמר
  }
  return streak;
}
