// צילום מכויל: אליפסה מנחה, קו המתאר של הצילום הקודם כ"רוח", וצילום אוטומטי רק כשהזווית והמרחק תואמים.
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { db, todayISO, type PhotoRow } from '../db';
import { loadFace, startCamera, stopCamera, runFace, FACE_OVAL, cameraErrorText, type FaceFrame } from '../lib/face';

type Phase = 'front' | 'profile' | 'done';
const TARGET_W = 0.42; // רוחב פנים יחסי לפריים, כשאין צילום קודם

export default function Photo() {
  const { week: w = '0' } = useParams();
  const week = Number(w) as PhotoRow['week'];
  const first = useSearchParams()[0].get('first') === '1';
  const nav = useNavigate();
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<Phase>('front');
  const [frame, setFrame] = useState<FaceFrame | null>(null);
  const [ghost, setGhost] = useState<number[] | null>(null);
  const [refW, setRefW] = useState(TARGET_W);
  const [hold, setHold] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [dark, setDark] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const phaseRef = useRef<Phase>('front'); phaseRef.current = phase;
  const holdRef = useRef(0);

  useEffect(() => {
    let stop: (() => void) | null = null;
    (async () => {
      const prev = (await db.photos.where('view').equals('front').toArray()).filter(p => p.week < week).sort((a, b) => b.week - a.week)[0];
      if (prev?.outline) { setGhost(prev.outline); setRefW(prev.faceWidth ?? TARGET_W); }
      try { stream.current = await startCamera(video.current!); } catch (e) { setErr(cameraErrorText(e)); return; }
      try {
        const lm = await loadFace();
        stop = runFace(video.current!, lm, f => { setFrame(f); if (f) checkLight(); });
      } catch { setErr('זיהוי הפנים לא נטען במכשיר הזה. אפשר לצלם ידנית.'); }
    })();
    return () => { stop?.(); stopCamera(stream.current); };
  }, [week]);

  // בהירות ממוצעת מדגימה קטנה
  const lightCanvas = useRef<HTMLCanvasElement | null>(null); const lastLight = useRef(0);
  function checkLight() {
    const now = performance.now(); if (now - lastLight.current < 1000 || !video.current) return; lastLight.current = now;
    const c = (lightCanvas.current ??= document.createElement('canvas')); c.width = 32; c.height = 24;
    const g = c.getContext('2d', { willReadFrequently: true })!; g.drawImage(video.current, 0, 0, 32, 24);
    const d = g.getImageData(0, 0, 32, 24).data; let sum = 0; for (let i = 0; i < d.length; i += 4) sum += 0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!;
    setDark(sum / (d.length / 4) < 70);
  }

  const aligned = !!frame && phase === 'front' && Math.abs(frame.yaw) < 3 && Math.abs(frame.pitch) < 5 && Math.abs(frame.roll) < 3 && Math.abs(frame.width - refW) / refW < 0.06 && Math.abs(frame.cx - 0.5) < 0.05;
  const hint = !frame ? 'הביטי למצלמה, הפנים בתוך האליפסה' : phase !== 'front' ? '' : Math.abs(frame.width - refW) / refW >= 0.06 ? (frame.width < refW ? 'התקרבי מעט' : 'התרחקי מעט') : Math.abs(frame.yaw) >= 3 ? 'סובבי את הראש מעט ' + (frame.yaw > 0 ? 'שמאלה' : 'ימינה') : Math.abs(frame.pitch) >= 5 ? (frame.pitch > 0 ? 'הורידי מעט את הסנטר' : 'הרימי מעט את הסנטר') : Math.abs(frame.roll) >= 3 ? 'ישרי את הראש' : Math.abs(frame.cx - 0.5) >= 0.05 ? 'הזיזי את הטלפון למרכז' : 'מצוין, לא לזוז';

  useEffect(() => {
    if (phase !== 'front') return;
    if (aligned) { holdRef.current += 1; setHold(holdRef.current); if (holdRef.current >= 12) { holdRef.current = 0; capture('front'); } }
    else { holdRef.current = 0; setHold(0); }
  }, [frame]); // eslint-disable-line react-hooks/exhaustive-deps

  async function capture(view: 'front' | 'profile') {
    const v = video.current!; const c = document.createElement('canvas');
    const vw = v.videoWidth, vh = v.videoHeight, tw = Math.min(vw, vh * 0.75);
    c.width = Math.round(tw); c.height = vh;
    const g = c.getContext('2d')!; g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(v, (vw - tw) / 2, 0, tw, vh, 0, 0, tw, vh);
    const blob: Blob = await new Promise(r => c.toBlob(b => r(b!), 'image/jpeg', 0.9));
    const outline = view === 'front' && frame ? FACE_OVAL.flatMap(i => [1 - frame.landmarks[i]!.x, frame.landmarks[i]!.y]) : undefined;
    await db.photos.where('week').equals(week).and(p => p.view === view).delete();
    await db.photos.add({ week, view, date: todayISO(), blob, width: c.width, height: c.height, outline, yaw: frame?.yaw, faceWidth: frame?.width });
    navigator.vibrate?.(40);
    setPhase(view === 'front' ? 'profile' : 'done');
  }
  function profileShot() { let n = 3; setCount(n); const t = window.setInterval(() => { n--; if (n <= 0) { window.clearInterval(t); setCount(null); capture('profile'); } else setCount(n); }, 1000); }

  const ov = (pts: number[]) => pts.reduce((s, v, i) => s + (i % 2 ? `,${(v * 100).toFixed(1)} ` : `${(v * 100).toFixed(1)}`), '');
  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col" dir="rtl">
      <div className="relative flex-1 overflow-hidden">
        <video ref={video} className="absolute inset-0 w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} playsInline muted autoPlay />
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
          {ghost && phase === 'front' && <polygon points={ov(ghost)} fill="none" stroke="rgba(196,160,106,.7)" strokeWidth=".5" strokeDasharray="1.5 1" />}
          {phase === 'front' && <ellipse cx="50" cy="45" rx={refW * 55} ry={refW * 55 * 0.8} fill="none" stroke={aligned ? 'rgba(142,165,140,.95)' : 'rgba(255,255,255,.5)'} strokeWidth=".6" />}
        </svg>
        <div className="absolute inset-x-0 top-0 p-4 bg-gradient-to-b from-black/70 to-transparent" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}>
          <div className="flex items-center justify-between">
            <button className="chip !min-h-10 !bg-black/40 !border-white/25 !text-white" onClick={() => nav(first ? '/' : '/journal', { replace: true })}>{phase === 'done' ? 'סיום' : 'אחר כך'}</button>
            <div className="text-sm text-white/80">שבוע {week} · {phase === 'front' ? 'חזית' : phase === 'profile' ? 'פרופיל' : 'נשמר'}</div>
          </div>
          {phase !== 'done' && <div className="mt-3 text-center text-lg font-semibold">{phase === 'front' ? hint : 'סובבי את הראש ימינה עד פרופיל מלא'}</div>}
          {dark && phase !== 'done' && <div className="mt-1 text-center text-sm text-[var(--color-gold)]">התאורה חלשה. כדאי לעמוד מול חלון.</div>}
          {ghost && phase === 'front' && <div className="mt-1 text-center text-xs text-white/60">הקו המקווקו: איפה היו הפנים בצילום הקודם</div>}
        </div>
        {count !== null && <div className="absolute inset-0 grid place-items-center text-7xl font-bold">{count}</div>}
        {phase === 'front' && hold > 0 && <div className="absolute bottom-8 inset-x-0 flex justify-center"><div className="h-1.5 w-40 rounded-full bg-white/20 overflow-hidden"><div className="h-full bg-[var(--color-sage)] transition-[width]" style={{ width: `${(hold / 12) * 100}%` }} /></div></div>}
        {err && <div className="absolute inset-x-4 top-1/3 bg-black/80 rounded-2xl p-4 text-center">{err}</div>}
      </div>
      <div className="p-4 flex flex-col gap-2" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
        {phase === 'front' && <button className="btn-secondary !bg-white/10 !border-white/20 !text-white" onClick={() => capture('front')} disabled={!frame}>צילום ידני</button>}
        {phase === 'profile' && <button className="btn-primary" onClick={profileShot}>צילום פרופיל (ספירה של 3 שניות)</button>}
        {phase === 'done' && <button className="btn-primary" onClick={() => nav(first ? '/' : '/journal', { replace: true })}>נשמר. {first ? 'בואי נתחיל' : 'ליומן'}</button>}
      </div>
    </div>
  );
}
