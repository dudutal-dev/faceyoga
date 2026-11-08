// עדכון גרסה באפליקציה המותקנת: בודקים בכל פתיחה, בכל חזרה לאפליקציה ובכל שעה; כשיש גרסה חדשה —
// מרעננים אוטומטית אם לא באמצע מפגש, אחרת מציגים באנר "גרסה חדשה" ומרעננים אחרי המפגש.
import { registerSW } from 'virtual:pwa-register';

type Listener = (needRefresh: boolean) => void;
const listeners = new Set<Listener>();
let needRefresh = false;
let apply: ((reload?: boolean) => Promise<void>) | null = null;

export const BUILD = __BUILD_TIME__;

export function onUpdate(l: Listener) { listeners.add(l); l(needRefresh); return () => { listeners.delete(l); }; }
export function updateNow() { return apply?.(true); }
const inSession = () => location.hash.startsWith('#/session');

export function setupPWA() {
  apply = registerSW({
    immediate: true,
    onRegisteredSW(_url, r) {
      if (!r) return;
      const check = () => r.update().catch(() => {});
      window.setInterval(check, 60 * 60 * 1000);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
      window.addEventListener('online', check);
    },
    onNeedRefresh() {
      needRefresh = true; listeners.forEach(l => l(true));
      if (!inSession()) apply?.(true); // לא באמצע מפגש — מרעננים מיד
    },
  });
}
