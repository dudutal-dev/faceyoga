// הורדת כל התוכן לשימוש בלי רשת: המניפסט → וידאו, קריינות, מוזיקה, מודל הפנים → Cache API.
import { contentUrl, loadManifest } from '../content/manifest';
export const MEDIA_CACHE = 'faceyoga-media';
export interface DownloadPlan { urls: string[]; bytes: number }

export async function planDownload(): Promise<DownloadPlan> {
  const m = await loadManifest();
  const urls = new Set<string>(); let bytes = 0;
  for (const x of Object.values(m.media)) {
    if (x.still) { urls.add(x.still); bytes += 90_000; }
    if (x.qa === 'approved' && x.clip) { urls.add(x.clip); bytes += x.bytes ?? 1_500_000; }
  }
  for (const n of Object.values(m.narration)) { urls.add(n.url); bytes += Math.round(n.durationMs * 16); }
  for (const u of Object.values(m.audio.ui)) { urls.add(u); bytes += 25_000; }
  if (m.audio.music) { urls.add(m.audio.music); bytes += 9_600_000; }
  urls.add(m.character.front); urls.add(m.character.side);
  urls.add('mediapipe/face_landmarker.task'); urls.add('mediapipe/vision_wasm_internal.js'); urls.add('mediapipe/vision_wasm_internal.wasm'); bytes += 3_760_000 + 15_000_000;
  return { urls: [...urls], bytes };
}
export async function cachedCount(urls: string[]): Promise<number> {
  if (!('caches' in window)) return 0;
  const cache = await caches.open(MEDIA_CACHE); let n = 0;
  for (const u of urls) if (await cache.match(contentUrl(u))) n++;
  return n;
}
export async function downloadAll(urls: string[], onProgress: (done: number, total: number, failed: number) => void, signal?: AbortSignal) {
  if (!('caches' in window)) throw new Error('הדפדפן לא תומך בשמירה לשימוש בלי רשת');
  const cache = await caches.open(MEDIA_CACHE); let done = 0, failed = 0;
  for (const u of urls) {
    if (signal?.aborted) break;
    const full = contentUrl(u);
    if (!(await cache.match(full))) { try { const r = await fetch(full, { signal }); if (r.ok) await cache.put(full, r); else failed++; } catch { failed++; } }
    done++; onProgress(done, urls.length, failed);
  }
  return { done, failed };
}
export const formatMB = (b: number) => `${Math.max(1, Math.round(b / 1e6))}MB`;
