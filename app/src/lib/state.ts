// מצב המשתמשת ברגע זה: שבוע, מפגש הבא, סינון, סיכום שבוע. משותף ל"היום", לנגן ולתוכנית.
import { db, getProfile, todayISO, type Profile, type SessionRow } from '../db';
import { buildFilter, buildMainSession, buildQuickSession, buildSingle, stageOf, PHOTO_WEEKS, type Filter, type Session } from '../content/plan';
import { summarizeWeek, weekNumber, greenStreak, type WeekSummary } from './week';

export interface UserState { profile: Profile; today: string; week: number; filter: Filter; sessions: SessionRow[]; summary: WeekSummary; streak: number; mainIndex: number; firstOfWeek: boolean; photoDue: number | null; checkinDue: boolean; lastDate: string | null }

export async function loadState(): Promise<UserState | null> {
  const profile = await getProfile(); if (!profile) return null;
  const today = todayISO();
  const week = weekNumber(profile.startDate, today);
  const [sessions, pain, photos, checkins] = await Promise.all([db.sessions.toArray(), db.pain.toArray(), db.photos.toArray(), db.checkins.toArray()]);
  const painCounts: Record<string, number> = {};
  for (const r of pain) painCounts[r.exerciseId] = (painCounts[r.exerciseId] ?? 0) + 1;
  const filter = buildFilter(profile, today, painCounts);
  const light = profile.track === 'light';
  const summary = summarizeWeek(sessions, profile.startDate, week, light);
  const mainThisWeek = sessions.filter(s => s.week === week && s.kind === 'main' && s.status !== 'stopped').length;
  const totalMain = sessions.filter(s => s.kind === 'main' && s.status !== 'stopped').length;
  const photoWeeksDone = new Set(photos.filter(p => p.view === 'front').map(p => p.week));
  const photoDue = PHOTO_WEEKS.find(w => w <= week && w >= week - 2 && !photoWeeksDone.has(w)) ?? (!photoWeeksDone.has(0) ? 0 : null);
  const last = sessions.map(s => s.date).sort().at(-1) ?? null;
  return { profile, today, week, filter, sessions, summary, streak: greenStreak(sessions, profile.startDate, week, light), mainIndex: totalMain, firstOfWeek: mainThisWeek === 0, photoDue, checkinDue: week >= 2 && !checkins.some(c => c.week === week), lastDate: last };
}

export function nextSession(s: UserState): Session {
  return buildMainSession(s.week, s.mainIndex, s.filter, { hasGuaSha: s.profile.hasGuaSha, firstOfWeek: s.firstOfWeek, track: s.profile.track });
}
export function sessionFor(kind: string, s: UserState, exId?: string | null): Session {
  if (kind === 'main') return nextSession(s);
  if (kind === 'single' && exId) return buildSingle(exId, s.week);
  return buildQuickSession(kind, s.week, s.filter);
}
export const stageName = (week: number) => stageOf(week).nameHe;
