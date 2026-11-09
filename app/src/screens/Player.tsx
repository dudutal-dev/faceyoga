// נגן המפגש. נגיעה אחת ב"התחילי" משחררת שמע ומצלמה (iOS/Android מתירים רק מתוך נגיעה).
// הקריינית מובילה; הטיימר קובע את הקצב; מאמן הפנים (אם פעיל) רק מודד ומעיר, לא עוצר את המפגש.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { loadState, sessionFor } from '../lib/state';
import { loadManifest, mediaFor, contentUrl, type Manifest } from '../content/manifest';
import { PHASE_HE, COUNT_WORDS } from '../content/exercises';
import type { Session } from '../content/plan';
import { Voice, fallbackLines } from '../lib/audio';
import { loadFace, startCamera, stopCamera, runFace, avg, browTension, frameBrightness, ensurePlaying, cameraErrorText, type FaceFrame } from '../lib/face';
import { RepCounter, WrinkleGuard } from '../lib/reps';
import { db, getSettings, todayISO, type Settings } from '../db';

interface Live { label: string; remaining: number; total: number; rep: number; reps: number; holding: boolean }
const sleepTick = 200;

export default function Player() {
  const { kind = 'main' } = useParams();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [m, setM] = useState<Manifest | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [started, setStarted] = useState(false);
  const [idx, setIdx] = useState(0);
  const [live, setLive] = useState<Live | null>(null);
  const [paused, setPaused] = useState(false);
  const [mirror, setMirror] = useState(false);
  const [camState, setCamState] = useState<'off' | 'loading' | 'on' | 'denied'>('off');
  const [quality, setQuality] = useState(0);         // 0..1 אות התרגיל מהמצלמה
  const [faceSeen, setFaceSeen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [musicOn, setMusicOn] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [caption, setCaption] = useState<string | null>(null);
  const [setup, setSetup] = useState(false);          // שלב הצבת הטלפון לפני מפגש עם מראה
  const [checks, setChecks] = useState({ face: false, dist: '' as '' | 'near' | 'far' | 'ok', center: false, light: true, ready: 0 });
  const [seenReps, setSeenReps] = useState(0);         // חזרות שהמאמנת זיהתה בתרגיל הנוכחי
  // מצב טלוויזיה: הטלפון לרוחב (שיקוף מסך לטלוויזיה). מדריכה ומראה זה לצד זה.
  const [tv, setTv] = useState(() => window.innerWidth > window.innerHeight);
  const tvRef = useRef(tv); tvRef.current = tv;
  useEffect(() => { const h = () => setTv(window.innerWidth > window.innerHeight); window.addEventListener('resize', h); window.addEventListener('orientationchange', h); return () => { window.removeEventListener('resize', h); window.removeEventListener('orientationchange', h); }; }, []);
  const zoom = useRef({ z: 1, x: 0, y: 0 });

  const voice = useRef<Voice | null>(null);
  const run = useRef({ token: 0, paused: false, jump: null as number | null, painSkip: false });
  const camVideo = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const stopFace = useRef<(() => void) | null>(null);
  const coach = useRef({ counter: null as RepCounter | null, guard: new WrinkleGuard(), reps: 0, warnings: 0, guardOn: false, blend: [] as string[], on: 0.4 });
  const wake = useRef<WakeLockSentinel | null>(null);
  const painRef = useRef(false);
  const setupRef = useRef({ on: false, good: 0, lastLight: 0, light: 128, began: false });

  useEffect(() => {
    (async () => {
      const [st, man, set] = await Promise.all([loadState(), loadManifest(), getSettings()]);
      if (!st) { nav('/onboarding', { replace: true }); return; }
      setSession(sessionFor(kind, st, sp.get('ex'))); setM(man); setSettings(set);
      setMirror(set.mirror && kind !== 'morning'); setMusicOn(set.music === 'on');
    })();
    return () => { run.current.token++; voice.current?.dispose(); stopFace.current?.(); stopCamera(stream.current); wake.current?.release().catch(() => {}); };
  }, [kind, sp, nav]);

  useEffect(() => { if (!toast) return; const t = window.setTimeout(() => setToast(null), 3500); return () => window.clearTimeout(t); }, [toast]);
  useEffect(() => { if (!started || paused) return; const t = window.setInterval(() => setElapsed(v => v + 1), 1000); return () => window.clearInterval(t); }, [started, paused]);
  useEffect(() => { run.current.paused = paused; if (!voice.current) return; if (paused) voice.current.pause(); else voice.current.resume(); }, [paused]);
  useEffect(() => { voice.current?.setMusic(musicOn); }, [musicOn]);

  const step = session?.steps[idx];
  const media = useMemo(() => (m && step ? mediaFor(m, step.exercise.id) : {}), [m, step]);

  // ---------- מצלמה ומאמן ----------
  async function enableCamera() {
    if (!camVideo.current) return;
    setCamState('loading');
    try {
      stream.current = await startCamera(camVideo.current);
      setCamState('on');
      if (settings?.coach !== false) {
        try {
          const lm = await loadFace();
          stopFace.current = runFace(camVideo.current, lm, onFace);
        } catch { setToast('המאמנת לא נטענה במכשיר הזה. המראה עובדת כרגיל.'); if (setupRef.current.on) beginSession(); }
      }
    } catch (err) { setCamState('denied'); setMirror(false); setToast(cameraErrorText(err)); if (setupRef.current.on) beginSession(); }
  }
  useEffect(() => { if (!mirror && setupRef.current.on) beginSession(); }, [mirror]); // eslint-disable-line react-hooks/exhaustive-deps
  function disableCamera() { stopFace.current?.(); stopFace.current = null; stopCamera(stream.current); stream.current = null; setCamState('off'); }
  useEffect(() => { if (!started) return; if (mirror && camState === 'off') enableCamera(); if (!mirror && camState === 'on') disableCamera(); }, [mirror, started]); // eslint-disable-line react-hooks/exhaustive-deps

  /** זום יציב על הפנים: יעד מוחלק, שינוי רק כשהוא משמעותי, ושמירה על הזום עד 2 ש' כשהפנים נעלמות לרגע.
   *  כותב ישירות לסגנון האלמנט, ומחזיר את מיקום הפנים בתצוגה (לאליפסה העוקבת). */
  const zoomTarget = useRef({ z: 1, x: 0, y: 0, seen: 0 });
  const [faceBox, setFaceBox] = useState<{ x: number; y: number; w: number } | null>(null);
  function applyZoom(f: FaceFrame | null) {
    const v = camVideo.current; if (!v) return;
    const zr = zoom.current, tg = zoomTarget.current, now = performance.now();
    if (f) {
      tg.seen = now;
      const tz = Math.min(tvRef.current ? 5 : 3, Math.max(1, 0.42 / Math.max(0.03, f.width))); // בטלוויזיה עד פי 5
      const tx = (0.5 - f.cx) * 100, ty = ((tvRef.current ? 0.5 : 0.46) - f.cy) * 100;
      if (Math.abs(tz - tg.z) / tg.z > 0.08) tg.z += (tz - tg.z) * 0.25; // רק שינוי משמעותי בגודל
      if (Math.abs(tx - tg.x) > 1.5) tg.x += (tx - tg.x) * 0.2;
      if (Math.abs(ty - tg.y) > 1.5) tg.y += (ty - tg.y) * 0.2;
    } else if (now - tg.seen > 2000) { tg.z += (1 - tg.z) * 0.03; tg.x *= 0.97; tg.y *= 0.97; } // איבוד ממושך: חוזרים לאט
    zr.z += (tg.z - zr.z) * 0.06; zr.x += (tg.x - zr.x) * 0.06; zr.y += (tg.y - zr.y) * 0.06;
    const lim = ((1 - 1 / zr.z) / 2) * 100;
    const x = Math.max(-lim, Math.min(lim, zr.x)), y = Math.max(-lim, Math.min(lim, zr.y));
    v.style.transform = `scaleX(-1) scale(${zr.z.toFixed(3)}) translate(${x.toFixed(2)}%, ${y.toFixed(2)}%)`;
    // מיקום הפנים בתצוגה (מראה), לאליפסה העוקבת במצב טלוויזיה
    if (f && tvRef.current) {
      const px = 0.5 + ((1 - f.cx) - 0.5 + x / 100 * -1) * zr.z, py = 0.5 + (f.cy - 0.5 + y / 100) * zr.z;
      setFaceBox({ x: px, y: py, w: f.width * zr.z });
    } else if (!f && now - tg.seen > 600) setFaceBox(null);
  }
  function onFace(f: FaceFrame | null) {
    setFaceSeen(!!f); applyZoom(f);
    const su = setupRef.current;
    if (su.on) {
      const now = performance.now();
      if (camVideo.current && now - su.lastLight > 800) { su.lastLight = now; su.light = frameBrightness(camVideo.current); }
      const dist = !f ? '' : f.width < (tvRef.current ? 0.035 : 0.2) ? 'far' : f.width > 0.62 ? 'near' : 'ok';
      const center = !!f && Math.abs(f.cx - 0.5) < (tvRef.current ? 0.3 : 0.16) && f.cy > 0.2 && f.cy < 0.8;
      const light = su.light >= 65;
      const ok = !!f && dist === 'ok' && center && light;
      su.good = ok ? su.good + 1 : 0;
      setChecks({ face: !!f, dist, center, light, ready: Math.min(1, su.good / 30) });
      if (su.good >= 30) beginSession(); // כ-2 שניות יציבות
      return;
    }
    if (!f) { setQuality(0); return; }
    const c = coach.current;
    if (c.blend.length) {
      const v = avg(f.blend, c.blend); setQuality(Math.min(1, v / c.on));
      const ev = c.counter?.push(v, f.t); if (ev?.type === 'rep') { c.reps++; setSeenReps(n => n + 1); navigator.vibrate?.(15); }
    }
    if (c.guardOn && c.guard.push(browTension(f.blend), f.t)) { c.warnings++; voice.current?.say([c.warnings % 2 ? 'wrinkle_1' : 'wrinkle_2']); setToast('המצח מתכווץ. הניחי עליו יד ונסי שוב רק עם הלחיים.'); }
  }

  // ---------- מנוע המפגש ----------
  async function wait(sec: number, token: number, onTick?: (left: number) => void): Promise<boolean> {
    let left = sec * 1000;
    while (left > 0) {
      if (token !== run.current.token) return false;
      if (run.current.jump !== null || run.current.painSkip) return false;
      await new Promise(r => setTimeout(r, sleepTick));
      if (!run.current.paused) { left -= sleepTick; onTick?.(Math.ceil(left / 1000)); }
    }
    return true;
  }
  async function sayGate(ids: string[], token: number) {
    while (run.current.paused && token === run.current.token) await new Promise(r => setTimeout(r, sleepTick));
    if (token !== run.current.token) return;
    await voice.current?.say(ids);
  }

  async function runSession(s: Session) {
    const token = ++run.current.token;
    const intro = [s.openLine, s.teacherLine].filter(Boolean) as string[];
    if (intro.length) { setLive({ label: 'פתיחה', remaining: 0, total: 0, rep: 0, reps: 0, holding: false }); await sayGate(intro, token); }
    let i = run.current.jump ?? 0;
    while (i < s.steps.length) {
      if (token !== run.current.token) return;
      setIdx(i); run.current.jump = null; run.current.painSkip = false;
      const st = s.steps[i]!; const e = st.exercise;
      const c = coach.current; c.blend = []; c.counter = null; c.guardOn = false; setSeenReps(0);
      setLive({ label: PHASE_HE[e.phase], remaining: 0, total: 0, rep: 0, reps: st.reps, holding: false });
      await sayGate(st.narration, token);
      if (run.current.jump === null && !run.current.painSkip) {
        c.guardOn = !!e.wrinkleGuard;
        if (st.reps > 0) {
          if (e.signal) { c.blend = e.signal.blend; c.on = e.signal.on; c.counter = new RepCounter(e.signal.on, st.holdSec * 700); }
          for (let r = 1; r <= st.reps; r++) {
            setLive({ label: 'מחזיקים', remaining: st.holdSec, total: st.holdSec, rep: r, reps: st.reps, holding: true });
            voice.current?.tick('hold');
            await sayGate([r === st.reps ? 'last' : `count_${r}`], token);
            if (r === Math.ceil(st.reps / 2) && e.cue) voice.current?.say([`${e.id}_cue`]);
            if (!(await wait(st.holdSec, token, left => setLive(l => l && { ...l, remaining: left })))) break;
            setLive({ label: 'משחררים', remaining: 0, total: 0, rep: r, reps: st.reps, holding: false });
            voice.current?.tick('release');
            if (st.holdSec >= 4) { if (!(await wait(2.5, token))) break; } else if (!(await wait(0.8, token))) break;
          }
        } else {
          const half = Math.round(st.durationSec / 2);
          let said = false;
          await wait(st.durationSec, token, left => {
            setLive({ label: PHASE_HE[e.phase], remaining: left, total: st.durationSec, rep: 0, reps: 0, holding: true });
            if (!said && left <= half) { said = true; voice.current?.say([e.sides ? 'switch_side' : e.cue ? `${e.id}_cue` : 'good'].filter(Boolean)); }
          });
        }
      }
      c.guardOn = false; c.blend = [];
      if (token !== run.current.token) return;
      if (run.current.painSkip) { await sayGate(['pain_ok'], token); }
      voice.current?.tick('next');
      const j = run.current.jump; i = j !== null ? Math.max(0, Math.min(s.steps.length - 1, j)) : i + 1;
      if (j === null && i < s.steps.length) await wait(1, token);
    }
    await sayGate([s.closeLine], token);
    voice.current?.tick('end');
    finish('done');
  }

  function start() {
    if (!session || !m) return;
    voice.current = new Voice(m, fallbackLines());
    voice.current.onCaption = t => setCaption(t && t.length > 14 ? t : null); // לא מציגים ספירות קצרות
    voice.current.unlock(musicOn, settings?.musicVolume ?? 0.5);
    navigator.wakeLock?.request('screen').then(l => { wake.current = l; }).catch(() => {});
    setStarted(true); // המצלמה נפתחת ב-useEffect אחרי שאלמנט המראה נטען
    if (mirror) { setupRef.current = { on: true, good: 0, lastLight: 0, light: 128, began: false }; setSetup(true); }
    else beginSession();
  }
  /** מתחילים את המפגש: אוטומטית כשהפנים יציבות במסגרת, או בלחיצה. פעם אחת בלבד. */
  function beginSession() {
    const su = setupRef.current;
    if (su.began || !session) return;
    su.began = true; su.on = false; setSetup(false);
    voice.current?.tick('start');
    runSession(session);
  }
  function finish(status: 'done' | 'stopped') {
    run.current.token++;
    voice.current?.stop();
    const c = coach.current;
    const st = status === 'done' ? 'done' : elapsed >= 300 ? 'partial' : 'stopped';
    nav('/finish', { replace: true, state: { kind: session?.kind ?? 'main', plannedMin: session?.plannedMin ?? 0, actualSec: elapsed, status: st, exercises: session?.steps.map(x => x.exercise.id) ?? [], coachReps: c.reps, wrinkleWarnings: c.warnings, pain: painRef.current } });
  }
  async function reportPain() {
    if (!step) return;
    painRef.current = true;
    await db.pain.add({ date: todayISO(), exerciseId: step.exercise.id });
    run.current.painSkip = true; voice.current?.stop();
    setToast('דילגנו. אם זה יחזור, התרגיל ייצא מהתוכנית.');
  }
  const jump = (d: number) => { if (!session) return; run.current.jump = Math.max(0, Math.min(session.steps.length - 1, idx + d)); voice.current?.stop(); };

  if (!session || !m || !step) return <div className="min-h-dvh grid place-items-center bg-black text-white/70">מכינה את המפגש…</div>;
  const e = step.exercise;
  const progress = ((idx + (live && live.reps ? live.rep / live.reps : 0)) / session.steps.length) * 100;
  const demoSrc = media.clip ? contentUrl(media.clip) : null;
  const still = contentUrl(media.still ?? m.character.front);
  const split = mirror && camState !== 'denied';

  const icon = 'w-10 h-10 shrink-0 rounded-full grid place-items-center border transition-colors';
  const timeStr = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;

  return (
    <div className={`fixed inset-0 bg-[#141010] text-white select-none flex ${tv && setup && started ? 'flex-row' : 'flex-col'} ${tv ? 'tv' : ''}`} dir="rtl" style={tv ? { paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' } : undefined}>
      <div className={tv ? 'flex-1 min-h-0 min-w-0 flex flex-row' : 'contents'}>
      {/* מדריכה */}
      <div className={`relative overflow-hidden min-h-0 ${setup ? 'hidden' : split && started ? (tv ? 'basis-1/2 shrink-0' : 'basis-[34%] shrink-0') : 'flex-1'}`} onClick={() => started && !setup && setPaused(p => !p)}>
        {demoSrc
          ? <video key={demoSrc} src={demoSrc} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover object-[50%_22%]" />
          : <img key={still} src={still} alt="" className="absolute inset-0 w-full h-full object-cover object-[50%_22%] kenburns" />}
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/65 to-transparent" />
        {!split && <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/75 to-transparent" />}
        <div className="absolute inset-x-0 h-1 bg-white/15" style={{ top: 'env(safe-area-inset-top)' }}><div className="h-full bg-[var(--color-gold)] transition-[width] duration-700" style={{ width: `${progress}%` }} /></div>
        <div className="absolute right-4 left-4" style={{ top: 'calc(env(safe-area-inset-top) + 12px)' }}>
          <div className="text-white/75 text-xs">{PHASE_HE[e.phase]} · תרגיל {idx + 1} מתוך {session.steps.length}</div>
          <div className={`display leading-tight drop-shadow ${tv ? 'text-[2rem]' : 'text-[1.6rem]'}`}>{e.nameHe}</div>
        </div>
        {!split && started && !caption && <Steps steps={e.steps} />}
        {/* כתובית כמו בסרט, על תחתית הווידאו (לא תופסת מקום מהמראה) */}
        {started && caption && (!(split && started) || tv) && <div className="absolute inset-x-3 bottom-2 bg-black/15 backdrop-blur-md border border-white/20 rounded-xl px-3 py-1.5"><p className={`text-center leading-[1.35] text-white font-medium line-clamp-2 [text-shadow:0_1px_3px_rgba(0,0,0,.85),0_0_10px_rgba(0,0,0,.45)] overflow-hidden max-h-[2.7em] ${tv ? 'text-lg' : 'text-[0.86rem]'}`}>{caption}</p></div>}
      </div>

      {/* מראה: שום פקד לא מכסה את הפנים */}
      {split && started && (
        <div className="relative flex-1 min-h-0 bg-black overflow-hidden" onClick={() => { if (camVideo.current) ensurePlaying(camVideo.current); if (!setup) setPaused(p => !p); }}>
          <video ref={camVideo} className="absolute inset-0 w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} playsInline muted autoPlay />
          {caption && !setup && !tv && <div className="absolute inset-x-3 top-2 z-10 bg-black/15 backdrop-blur-md border border-white/20 rounded-xl px-3 py-1.5 pointer-events-none"><p className={`text-center leading-[1.35] text-white font-medium line-clamp-2 [text-shadow:0_1px_3px_rgba(0,0,0,.85),0_0_10px_rgba(0,0,0,.45)] overflow-hidden max-h-[2.7em] ${tv ? 'text-lg' : 'text-[0.86rem]'}`}>{caption}</p></div>}
          {camState !== 'on' && <div className="absolute inset-0 grid place-items-center text-white/60 text-sm">{camState === 'loading' ? 'פותחת מצלמה…' : ''}</div>}
          {camState === 'on' && (
            <>
              {tv ? (faceBox && <div className="absolute pointer-events-none rounded-[50%] border-2 transition-all duration-300" style={{ left: `${(faceBox.x - faceBox.w * 0.75) * 100}%`, top: `${faceBox.y * 100}%`, width: `${faceBox.w * 150}%`, aspectRatio: '0.78', transform: 'translateY(-52%)', borderColor: setup ? 'rgba(142,165,140,.95)' : 'rgba(196,160,106,.8)' }} />) : <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet"><ellipse cx="50" cy="50" rx={setup ? 31 : 30} ry={setup ? 41 : 42} fill="none" stroke={setup ? (checks.ready > 0 ? 'rgba(142,165,140,.95)' : 'rgba(255,255,255,.55)') : faceSeen ? 'rgba(196,160,106,.8)' : 'rgba(255,255,255,.45)'} strokeWidth={setup ? 0.9 : 0.6} strokeDasharray={faceSeen ? '0' : '2 2'} /></svg>}
              {!setup && <div className="absolute bottom-2 inset-x-2 flex justify-center pointer-events-none">
                {!faceSeen
                  ? <span className="bg-black/55 backdrop-blur rounded-full px-3 py-1 text-xs">הפנים בתוך האליפסה, מול אור</span>
                  : coach.current.blend.length > 0 && (
                    <span className="bg-black/55 backdrop-blur rounded-full px-3 py-1 flex items-center gap-2 text-xs">
                      <span>המאמנת רואה</span>
                      <span className="w-16 h-1.5 rounded-full bg-white/20 overflow-hidden"><span className="block h-full bg-[var(--color-gold)] transition-[width] duration-150" style={{ width: `${Math.round(quality * 100)}%` }} /></span>
                      {seenReps > 0 && <span className="text-[var(--color-gold)] font-semibold">✓ {seenReps}</span>}
                    </span>
                  )}
              </div>}
            </>
          )}
        </div>
      )}
      {!(split && started) && <video ref={camVideo} className="hidden" playsInline muted />}
      </div>

      {toast && <div className="absolute inset-x-4 top-[38%] bg-black/85 border border-white/15 rounded-2xl p-3 text-center z-20 text-sm">{toast}</div>}
      {paused && started && <div className="absolute inset-x-0 top-[30%] grid place-items-center pointer-events-none z-10"><div className="bg-black/70 rounded-full px-7 py-2.5 text-lg">מושהה</div></div>}

      {/* הצבת הטלפון: בדיקות אוטומטיות, והמפגש מתחיל לבד כשהכול מוכן */}
      {started && setup && (
        <div className={`shrink-0 bg-[#1b1513] border-white/10 px-5 pt-4 flex flex-col gap-3 ${tv ? 'w-[46%] border-r overflow-y-auto justify-center' : 'border-t'}`} style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 14px)' }}>
          <div className="flex items-center gap-4">
            <PhoneStand />
            <div className="flex-1 leading-snug">
              <div className="font-semibold text-lg">{tv ? 'מצב טלוויזיה' : 'מעמידים את הטלפון'}</div>
              <div className="text-white/70 text-sm">{tv ? 'הטלפון לרוחב, צמוד לטלוויזיה, המצלמה אלייך. שבי במרחק מטר עד שלושה, עם הפנים לאור. המצלמה תתקרב לפנים לבד.' : 'זקוף על השולחן, בגובה העיניים, במרחק יד. נשען על כוס או ספרים. הידיים פנויות לפנים. רוצה על הטלוויזיה? סובבי את הטלפון לרוחב.'}</div>
            </div>
          </div>
          <ul className={`grid gap-2 text-sm ${tv ? 'grid-cols-1' : 'grid-cols-2'}`}>
            <Check ok={checks.face} text={checks.face ? 'רואה את הפנים' : 'מחפשת את הפנים'} />
            <Check ok={checks.dist === 'ok'} text={checks.dist === 'far' ? 'התקרבי קצת' : checks.dist === 'near' ? 'התרחקי קצת' : 'מרחק טוב'} />
            <Check ok={checks.center} text={checks.center ? 'במרכז' : 'פנים במרכז האליפסה'} />
            <Check ok={checks.light} text={checks.light ? 'תאורה טובה' : 'האור מאחורייך. הסתובבי לאור'} />
          </ul>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-[var(--color-sage)] transition-[width] duration-200" style={{ width: `${Math.round(checks.ready * 100)}%` }} /></div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-white/60 text-xs">כשהכול ירוק, המפגש מתחיל לבד. במהלכו, נגיעה במסך עוצרת.</span>
            <button className="h-11 px-4 shrink-0 rounded-full bg-white/12 text-sm" onClick={beginSession}>להתחיל עכשיו</button>
          </div>
        </div>
      )}

      {/* לוח תחתון קבוע: מצב + פקדים. לא מונח על הווידאו או על המראה */}
      {started && !setup && (
        <div className={`shrink-0 bg-[#141c1b] border-t border-white/10 px-3 pt-2.5 flex gap-2 ${tv ? 'flex-row items-center gap-4 px-4' : 'flex-col'}`} style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' }}>
          <div className={`flex items-center gap-2.5 min-h-[40px] ${tv ? 'flex-1 min-w-0' : ''}`}>
            {live && live.total > 0 ? <Countdown remaining={live.remaining} total={live.total} /> : <span className="w-11 h-11 shrink-0 rounded-full border-2 border-white/15 grid place-items-center"><span className="w-2 h-2 rounded-full bg-[var(--color-gold)] animate-pulse" /></span>}
            <div className="flex-1 min-w-0 leading-tight">
              <div className="font-semibold truncate">{live?.label ?? ''}</div>
              <div className="text-white/60 text-sm truncate">{live && live.reps > 0 && live.rep > 0 ? `חזרה ${COUNT_WORDS[live.rep - 1] ?? live.rep} מתוך ${live.reps}` : e.muscle}</div>
            </div>
            <span className="text-white/50 text-sm tabular-nums">{timeStr}</span>
            <button className={icon} style={{ borderColor: mirror ? 'var(--color-gold)' : 'rgba(255,255,255,.15)', color: mirror ? 'var(--color-gold)' : 'rgba(255,255,255,.7)' }} aria-pressed={mirror} aria-label="מראה" onClick={() => setMirror(v => !v)}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" /><circle cx="12" cy="11" r="3" /><path d="M7.5 17.5c1-1.6 2.6-2.5 4.5-2.5s3.5.9 4.5 2.5" /></svg>
            </button>
            <button className={icon} style={{ borderColor: musicOn ? 'var(--color-gold)' : 'rgba(255,255,255,.15)', color: musicOn ? 'var(--color-gold)' : 'rgba(255,255,255,.7)' }} aria-pressed={musicOn} aria-label="מוזיקה" onClick={() => setMusicOn(v => !v)}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V6l10-2v12" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="16.5" cy="16" r="2.5" />{!musicOn && <path d="M3 3l18 18" />}</svg>
            </button>
          </div>
          <div className={`flex items-center gap-1.5 ${tv ? 'shrink-0 gap-2' : 'justify-between'}`}>
            <button className="h-11 flex-1 min-w-0 max-w-[84px] rounded-full bg-[var(--color-stop)] text-white font-semibold text-sm" onClick={() => finish('stopped')}>סיום</button>
            <button className="w-11 h-11 shrink-0 rounded-full bg-white/10 grid place-items-center disabled:opacity-30" onClick={() => jump(-1)} disabled={idx === 0} aria-label="הקודם"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg></button>
            <button className="w-14 h-14 shrink-0 rounded-full bg-white text-[var(--color-rose-deep)] grid place-items-center shadow-lg active:scale-95 transition-transform" onClick={() => setPaused(p => !p)} aria-label={paused ? 'המשך' : 'השהיה'}>{paused ? <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M16 5.5v13L5 12z" /></svg> : <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><rect x="6.5" y="5" width="4" height="14" rx="1.2" /><rect x="13.5" y="5" width="4" height="14" rx="1.2" /></svg>}</button>
            <button className="w-11 h-11 shrink-0 rounded-full bg-white/10 grid place-items-center disabled:opacity-30" onClick={() => jump(1)} disabled={idx >= session.steps.length - 1} aria-label="הבא"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg></button>
            <button className="h-11 flex-1 min-w-0 max-w-[84px] rounded-full bg-white/10 text-[0.8rem] whitespace-nowrap overflow-hidden px-1" onClick={reportPain}>כואב לי</button>
          </div>
        </div>
      )}

      {/* מסך פתיחה */}
      {!started && (
        <div className="absolute inset-0 z-10 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/40 to-transparent">
          <div className="p-6 flex flex-col gap-3 max-w-[520px] w-full mx-auto" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}>
            <div className="text-white/70 text-sm">{session.plannedMin} דקות · {session.steps.length} תרגילים</div>
            <div className="display text-[2rem] leading-tight">{session.title}</div>
            <ol className="flex flex-wrap gap-1.5 text-xs text-white/80">{session.steps.map(s => <li key={s.key} className="rounded-full bg-white/12 px-2.5 py-1">{s.exercise.nameHe}</li>)}</ol>
            <button className="chip !bg-white/10 !border-white/25 !text-white !justify-between !rounded-2xl !py-2 mt-1" aria-pressed={mirror} onClick={() => setMirror(v => !v)}>
              <span className="text-start">מראה ומאמנת פנים<br /><span className="text-white/60 text-xs">המצלמה לא מקליטה ולא שולחת</span></span><span>{mirror ? 'פועל' : 'כבוי'}</span>
            </button>
            <p className="text-white/60 text-xs">רוצה על הטלוויזיה? שיקוף מסך מהטלפון לטלוויזיה, והטלפון לרוחב, צמוד אליה.</p>
            <button className="btn-primary !text-xl" onClick={start}>התחילי</button>
            <button className="text-white/70 py-2" onClick={() => nav(-1)}>חזרה</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Countdown({ remaining, total }: { remaining: number; total: number }) {
  const r = 19, c = 2 * Math.PI * r, frac = total ? remaining / total : 0;
  return (
    <div className="relative w-11 h-11 shrink-0">
      <svg viewBox="0 0 44 44" className="w-11 h-11 -rotate-90"><circle cx="22" cy="22" r={r} fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="3.5" /><circle cx="22" cy="22" r={r} fill="none" stroke="var(--color-gold)" strokeWidth="3.5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} style={{ transition: 'stroke-dashoffset 250ms linear' }} /></svg>
      <div className="absolute inset-0 grid place-items-center font-semibold tabular-nums">{remaining}</div>
    </div>
  );
}
function Check({ ok, text }: { ok: boolean; text: string }) {
  return <li className="flex items-center gap-2 rounded-xl bg-white/6 px-2.5 py-2"><span className="w-5 h-5 shrink-0 rounded-full grid place-items-center text-[11px]" style={{ background: ok ? 'var(--color-sage)' : 'rgba(255,255,255,.15)' }}>{ok ? '✓' : ''}</span><span className={ok ? '' : 'text-white/75'}>{text}</span></li>;
}
/** איור: טלפון זקוף נשען על כוס, מול פנים. */
function PhoneStand() {
  return (
    <svg viewBox="0 0 64 64" width="64" height="64" className="shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 56h56" opacity=".5" />
      <rect x="30" y="14" width="16" height="30" rx="3" transform="rotate(8 38 29)" stroke="var(--color-gold)" />
      <path d="M44 56V44h10v12" opacity=".6" />
      <circle cx="14" cy="22" r="7" /><path d="M6 44c1.5-7 4.5-10 8-10s6.5 3 8 10" />
      <path d="M19 21l3-1" opacity=".7" />
    </svg>
  );
}
function Steps({ steps }: { steps: string[] }) {
  return <ol className="absolute bottom-4 right-4 left-4 flex flex-col gap-1.5 text-sm">{steps.map((s, i) => <li key={i} className="flex gap-2 items-start"><span className="w-5 h-5 shrink-0 rounded-full bg-white/20 grid place-items-center text-xs">{i + 1}</span><span className="text-white/90 drop-shadow">{s}</span></li>)}</ol>;
}
