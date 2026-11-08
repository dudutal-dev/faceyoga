// Dexie / IndexedDB — כל הנתונים מקומיים, כולל תמונות הפנים. אין שרת, אין חשבון, אין טלמטריה.
import Dexie, { type EntityTable } from 'dexie';

export type Track = 'full' | 'light' | 'aftercare';
export type Zone = 'forehead' | 'glabella' | 'eyes' | 'cheeks' | 'lips' | 'jaw' | 'neck';
export type SessionKind = 'main' | 'morning' | 'quick' | 'single';
export type SessionStatus = 'done' | 'partial' | 'stopped';

/** טיפול אסתטי שסומן: האפליקציה מדלגת על האזור עד `until`. */
export interface Treatment { id: string; type: 'botox' | 'filler' | 'threads' | 'surgery'; zones: Zone[]; date: string; until: string }

export interface Profile {
  id: number;
  name: string;
  track: Track;
  practiceDays: number[];      // 0=ראשון … 6=שבת
  reminderTime: string;        // "20:30"
  screening: Record<string, boolean>;
  treatments: Treatment[];
  hasGuaSha: boolean;
  startDate: string;           // ISO — תחילת שבוע 1
  createdAt: string;
  onboarded: boolean;
  eyesAcknowledged: boolean;   // אישרה שבדקה את העפעף אצל רופא (אם סימנה)
}
export interface SessionRow {
  id?: number;
  date: string;
  week: number;
  kind: SessionKind;
  plannedMin: number;
  actualSec: number;
  status: SessionStatus;
  exercises: string[];
  coachReps?: number;          // חזרות שזוהו במצלמה
  wrinkleWarnings?: number;
  feel?: number | null;        // 0–10 תחושת לסת/צוואר אחרי
  pain: boolean;
}
export interface PainReport { id?: number; date: string; exerciseId: string }
export interface CheckIn { id?: number; week: number; date: string; jawTension: number; puffiness: number; satisfaction: number }
export interface PhotoRow { id?: number; week: 0 | 6 | 12 | 24; view: 'front' | 'profile'; date: string; blob: Blob; width: number; height: number; outline?: number[] /* x,y מנורמלים של קו המתאר */; yaw?: number; faceWidth?: number }
export interface Settings {
  id: number;
  mirror: boolean;
  coach: boolean;
  music: 'on' | 'off';
  musicVolume: number;         // 0–1
  fontScale: 'normal' | 'large' | 'xl';
  darkMode: 'auto' | 'light' | 'dark';
  voiceOnlyMorning: boolean;
}

export class FaceDB extends Dexie {
  profile!: EntityTable<Profile, 'id'>;
  sessions!: EntityTable<SessionRow, 'id'>;
  pain!: EntityTable<PainReport, 'id'>;
  checkins!: EntityTable<CheckIn, 'id'>;
  photos!: EntityTable<PhotoRow, 'id'>;
  settings!: EntityTable<Settings, 'id'>;
  constructor() {
    super('faceyoga');
    this.version(1).stores({ profile: 'id', sessions: '++id, date, week, kind', pain: '++id, exerciseId, date', checkins: '++id, week', photos: '++id, week, view', settings: 'id' });
  }
}
export const db = new FaceDB();

export const DEFAULT_SETTINGS: Settings = { id: 1, mirror: true, coach: true, music: 'on', musicVolume: 0.5, fontScale: 'normal', darkMode: 'auto', voiceOnlyMorning: false };

export function todayISO(d = new Date()): string {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}
export function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + days);
  return todayISO(d);
}

export function blankProfile(): Profile {
  return { id: 1, name: '', track: 'full', practiceDays: [0, 2, 4], reminderTime: '20:30', screening: {}, treatments: [], hasGuaSha: false, startDate: todayISO(), createdAt: new Date().toISOString(), onboarded: false, eyesAcknowledged: false };
}
export async function getProfile(): Promise<Profile | null> { return (await db.profile.get(1)) ?? null; }
export async function saveProfile(p: Partial<Profile>) {
  const cur = (await getProfile()) ?? blankProfile();
  await db.profile.put({ ...cur, ...p, id: 1 });
}
export async function getSettings(): Promise<Settings> { return { ...DEFAULT_SETTINGS, ...((await db.settings.get(1)) ?? {}) }; }
export async function saveSettings(s: Partial<Settings>) { await db.settings.put({ ...(await getSettings()), ...s, id: 1 }); }
export function applyDisplaySettings(s: Settings) {
  document.documentElement.dataset.font = s.fontScale;
  if (s.darkMode !== 'auto') document.documentElement.dataset.theme = s.darkMode; else delete document.documentElement.dataset.theme;
}

/** ייצוא כל הנתונים חוץ מתמונות (הן נשארות רק במכשיר). */
export async function exportAll(): Promise<string> {
  const data = { app: 'faceyoga', exportedAt: new Date().toISOString(), profile: await db.profile.toArray(), sessions: await db.sessions.toArray(), pain: await db.pain.toArray(), checkins: await db.checkins.toArray(), settings: await db.settings.toArray() };
  return JSON.stringify(data, null, 2);
}
export async function importAll(json: string): Promise<void> {
  const d = JSON.parse(json) as Partial<Record<'profile' | 'sessions' | 'pain' | 'checkins' | 'settings', unknown[]>>;
  await db.transaction('rw', [db.profile, db.sessions, db.pain, db.checkins, db.settings], async () => {
    for (const t of ['profile', 'sessions', 'pain', 'checkins', 'settings'] as const) {
      await db.table(t).clear();
      if (Array.isArray(d[t])) await db.table(t).bulkPut(d[t] as object[]);
    }
  });
}
export async function deletePhotos() { await db.photos.clear(); }
export async function resetAll(): Promise<void> { await db.delete(); await db.open(); }
