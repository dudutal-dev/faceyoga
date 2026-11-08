// חוזה המניפסט (נכתב על ידי pipeline/06_assemble.mjs). האפליקציה משתמשת רק בפריטים approved.
export interface ManifestMedia { exerciseId: string; clip?: string; still?: string; mode?: 'pingpong' | 'loop'; bytes?: number; qa: 'approved' | 'pending' | 'rejected' }
export interface NarrationItem { url: string; durationMs: number; text: string; qa: string }
export interface Manifest {
  version: string; generatedAt: string;
  character: { front: string; side: string };
  voice: { id: string; model: string };
  media: Record<string, ManifestMedia>;
  narration: Record<string, NarrationItem>;
  audio: { music?: string; ui: Record<string, string> };
}

export const CONTENT_BASE = import.meta.env.BASE_URL.replace(/\/?$/, '/');
export const contentUrl = (rel: string) => CONTENT_BASE + rel.replace(/^\//, '');

const EMPTY: Manifest = { version: '0', generatedAt: '', character: { front: 'character/front.jpg', side: 'character/side.jpg' }, voice: { id: '', model: '' }, media: {}, narration: {}, audio: { ui: {} } };
let cached: Promise<Manifest> | null = null;
export function loadManifest(): Promise<Manifest> {
  cached ??= fetch(contentUrl('manifest.json')).then(r => (r.ok ? (r.json() as Promise<Manifest>) : EMPTY)).catch(() => EMPTY);
  return cached;
}
/** מדיה מאושרת לתרגיל: קליף אם יש, אחרת סטיל. */
export function mediaFor(m: Manifest, exerciseId: string): { clip?: string; still?: string; mode?: 'pingpong' | 'loop' } {
  const x = m.media[exerciseId];
  if (!x) return {};
  return { clip: x.qa === 'approved' ? x.clip : undefined, still: x.still, mode: x.mode };
}
