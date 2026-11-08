// תזכורות מקומיות (Web Notifications). בלי שרת: עובדות כשהאפליקציה פתוחה או רצה ברקע.
import { getProfile, db, todayISO } from '../db';

export async function requestReminderPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  return (await Notification.requestPermission()) === 'granted';
}
let timer: number | null = null;
export function scheduleReminderCheck() {
  if (timer) return;
  const tick = async () => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const p = await getProfile(); if (!p?.onboarded) return;
    const now = new Date();
    if (!p.practiceDays.includes(now.getDay()) || now.toTimeString().slice(0, 5) !== p.reminderTime) return;
    const key = `reminded-${todayISO()}`; if (localStorage.getItem(key)) return;
    if ((await db.sessions.where('date').equals(todayISO()).count()) > 0) return;
    try { new Notification('רגע של פנים', { body: 'חמש־עשרה דקות רק בשבילך. או ארבע, גם זה נספר.', tag: 'faceyoga-daily' }); localStorage.setItem(key, '1'); } catch { /* */ }
  };
  tick(); timer = window.setInterval(tick, 60_000);
}
