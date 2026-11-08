// ספריית צנרת משותפת — ElevenLabs. כל קריאה: retry, cache לפי hash, רישום עלות.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const ROOT = path.resolve(import.meta.dirname, '..');
export const API = 'https://api.elevenlabs.io';
const CACHE_DIR = path.join(ROOT, 'pipeline', '.cache');
const COSTS = path.join(ROOT, 'pipeline', 'costs.json');
fs.mkdirSync(CACHE_DIR, { recursive: true });
if (!fs.existsSync(COSTS)) fs.writeFileSync(COSTS, '[]');

/** המפתח: מ-.env (מחשב מקומי), ממשתנה סביבה, או 'proxy-injected' בסביבת ענן שבה ה-proxy מזריק את הכותרת. */
export function loadEnv() {
  const env = { ...process.env };
  const f = path.join(ROOT, '.env');
  if (fs.existsSync(f)) for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    if (!l || l.startsWith('#') || !l.includes('=')) continue;
    const i = l.indexOf('='); env[l.slice(0, i).trim()] = l.slice(i + 1).trim();
  }
  if (!env.ELEVENLABS_API_KEY) env.ELEVENLABS_API_KEY = 'proxy-injected';
  return env;
}
export const env = loadEnv();
export const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'pipeline', 'config.json'), 'utf8'));

export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const hash = obj => crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex').slice(0, 16);

/** קריאה עם retry על 429/5xx/שגיאות רשת. */
export async function api(p, { method = 'GET', body, headers = {}, tries = 5 } = {}) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(API + p, {
        method,
        headers: { 'xi-api-key': env.ELEVENLABS_API_KEY, ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...headers },
        body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
      });
      if (r.status === 429 || r.status >= 500) { last = new Error(`${r.status} ${await r.text()}`); await sleep(2000 * 2 ** i); continue; }
      return r;
    } catch (e) { last = e; await sleep(2000 * 2 ** i); }
  }
  throw last;
}

export function logCost(entry) {
  const arr = JSON.parse(fs.readFileSync(COSTS, 'utf8'));
  arr.push({ at: new Date().toISOString(), ...entry });
  fs.writeFileSync(COSTS, JSON.stringify(arr, null, 2));
}

/** cache: אם כבר הופק לאותו מפתח — מחזיר את הקובץ בלי לקרוא ל-API. */
function cachePath(key, ext) { return path.join(CACHE_DIR, `${key}.${ext}`); }

/** יצירה אסינכרונית (image/video): submit → poll → download. */
export async function generate(kind, request, { ext, pollMs, stage, label }) {
  const key = hash({ kind, request });
  const cached = cachePath(key, ext);
  if (fs.existsSync(cached)) { console.log(`  [cache] ${label} ← ${key}`); return { file: cached, key, cached: true }; }

  const r = await api(`/v1/flows/${kind}`, { method: 'POST', body: request });
  if (!r.ok) throw new Error(`${kind} create ${r.status}: ${(await r.text()).slice(0, 500)}`);
  const { id } = await r.json();
  console.log(`  [submit] ${label} → ${id}`);
  const t0 = Date.now();
  for (;;) {
    await sleep(pollMs);
    const g = await api(`/v1/flows/${kind}/${id}`);
    if (!g.ok) throw new Error(`${kind} get ${g.status}: ${(await g.text()).slice(0, 300)}`);
    const j = await g.json();
    if (j.status === 'completed') {
      const d = await fetch(j.content_url);
      const buf = Buffer.from(await d.arrayBuffer());
      fs.writeFileSync(cached, buf);
      logCost({ stage, kind, label, generation_id: id, model_id: request.model_id, bytes: buf.length, seconds: Math.round((Date.now() - t0) / 1000), usd: null, note: 'עלות לא מפורסמת ב-API; לקרוא מדוח השימוש בחשבון' });
      console.log(`  [done] ${label} ${(buf.length / 1e6).toFixed(1)}MB ב-${Math.round((Date.now() - t0) / 1000)} ש'`);
      return { file: cached, key, id, cached: false };
    }
    if (j.status === 'failed') { logCost({ stage, kind, label, generation_id: id, model_id: request.model_id, failed: j.failure_reason, usd: 0 }); throw new Error(`${label} נכשל: ${j.failure_reason} — ${j.error_message || ''}`); }
    process.stdout.write('.');
  }
}

export function imageRef(file) {
  const ext = path.extname(file).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  return { type: 'inline_base64', content_base64: fs.readFileSync(file).toString('base64'), mime_type: mime };
}

export function copyTo(src, dest) { fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.copyFileSync(src, dest); return dest; }
