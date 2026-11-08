// נגן המפגש. נגיעה אחת ב"התחילי" משחררת שמע ומצלמה (iOS/Android מתירים רק מתוך נגיעה).
// הקריינית מובילה; הטיימר קובע את הקצב; מאמן הפנים (אם פעיל) רק מודד ומעיר, לא עוצר את המפגש.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { loadState, sessionFor } from '../lib/state';
import { loadManifest, mediaFor, contentUrl, type Manifest } from '../content/manifest';
import { PHASE_HE, COUNT_WORDS } from '../content/exercises';
import type { Session } from '../content/plan';
import { Voice, fallbackLines } from '../lib/audio';
import { loadFace, startCamera, stopCamera, runFace, avg, browTension, type FaceFrame } from '../lib/face';
import { RepCounter, WrinkleGuard } from '../lib/reps';
import { db, getSettings, todayISO, type Settings } from '../db';
import Evidence from '../components/Evidence';

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

  const voice = useRef<Voice | null>(null);
  const run = useRef({ token: 0, paused: false, jump: null as number | null, painSkip: false });
  const camVideo = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const stopFace = useRef<(() => void) | null>(null);
  const coach = useRef({ counter: null as RepCounter | null, guard: new WrinkleGuard(), reps: 0, warnings: 0, guardOn: false, blend: [] as string[], on: 0.4 });
  const wake = useRef<WakeLockSentinel | null>(null);
  const painRef = useRef(false);

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
  useEffect(() => { run.current.paused = paused; if (!voice.current) return; if (paused) voice.current.pause(); else voice.current.resume(musicOn); }, [paused, musicOn]);
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
        } catch { setToast('המאמן לא נטען במכשיר הזה. המראה עובדת כרגיל.'); }
      }
    } catch { setCamState('denied'); setMirror(false); setToast('אין גישה למצלמה. אפשר לאשר בהגדרות הדפדפן.'); }
  }
  function disableCamera() { stopFace.current?.(); stopFace.current = null; stopCamera(stream.current); stream.current = null; setCamState('off'); }
  useEffect(() => { if (!started) return; if (mirror && camState === 'off') enableCamera(); if (!mirror && camState === 'on') disableCamera(); }, [mirror, started]); // eslint-disable-line react-hooks/exhaustive-deps

  function onFace(f: FaceFrame | null) {
    setFaceSeen(!!f); if (!f) { setQuality(0); return; }
    const c = coach.current;
    if (c.blend.length) {
      const v = avg(f.blend, c.blend); setQuality(Math.min(1, v / c.on));
      const ev = c.counter?.push(v, f.t); if (ev?.type === 'rep') c.reps++;
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
      const c = coach.current; c.blend = []; c.counter = null; c.guardOn = false;
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
    voice.current.unlock(musicOn, settings?.musicVolume ?? 0.5);
    navigator.wakeLock?.request('screen').then(l => { wake.current = l; }).catch(() => {});
    setStarted(true);
    if (mirror) enableCamera();
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

  return (
    <div className="fixed inset-0 bg-[#141010] text-white select-none flex flex-col" dir="rtl">
      {/* מדריכה */}
      <div className={`relative overflow-hidden transition-all duration-500 ${split ? 'h-[52%]' : 'flex-1'}`}>
        {demoSrc
          ? <video key={demoSrc} src={demoSrc} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover object-[50%_25%]" />
          : <img key={still} src={still} alt="" className="absolute inset-0 w-full h-full object-cover object-[50%_25%] kenburns" />}
        <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/60 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute inset-x-0 h-1 bg-white/15" style={{ top: 'env(safe-area-inset-top)' }}><div className="h-full bg-[var(--color-gold)] transition-[width] duration-700" style={{ width: `${progress}%` }} /></div>
        <div className="absolute right-4 left-4 flex items-start justify-between gap-3" style={{ top: 'calc(env(safe-area-inset-top) + 14px)' }}>
          <div className="min-w-0">
            <div className="text-white/70 text-xs tracking-wider">{PHASE_HE[e.phase]} · {idx + 1}/{session.steps.length}</div>
            <div className="display text-2xl leading-tight">{e.nameHe}</div>
            <div className="text-white/75 text-sm">{e.muscle}</div>
          </div>
          <div className="opacity-90 shrink-0"><Evidence level={e.evidence} compact /></div>
        </div>
        {!split && started && <Steps steps={e.steps} />}
      </div>

      {/* מראה */}
      {split && (
        <div className="relative flex-1 bg-black overflow-hidden">
          <video ref={camVideo} className="absolute inset-0 w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} playsInline muted />
          {started && camState !== 'on' && <div className="absolute inset-0 grid place-items-center text-white/60 text-sm">{camState === 'loading' ? 'פותחת מצלמה…' : 'המראה תיפתח עם תחילת המפגש'}</div>}
          {camState === 'on' && (
            <>
              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none"><ellipse cx="50" cy="46" rx="23" ry="34" fill="none" stroke={faceSeen ? 'rgba(196,160,106,.55)' : 'rgba(255,255,255,.35)'} strokeWidth=".5" strokeDasharray={faceSeen ? '0' : '2 2'} /></svg>
              {coach.current.blend.length > 0 && (
                <div className="absolute top-3 right-3 bg-black/55 backdrop-blur rounded-full px-3 py-1.5 flex items-center gap-2 text-xs">
                  <span>המאמנת רואה</span>
                  <span className="w-16 h-1.5 rounded-full bg-white/20 overflow-hidden"><span className="block h-full bg-[var(--color-gold)] transition-[width] duration-150" style={{ width: `${Math.round(quality * 100)}%` }} /></span>
                </div>
              )}
              {!faceSeen && <div className="absolute top-3 inset-x-0 text-center text-xs text-white/70">התקרבי כך שהפנים בתוך האליפסה</div>}
            </>
          )}
        </div>
      )}
      {!split && <video ref={camVideo} className="hidden" playsInline muted />}

      {/* טיימר וחזרות */}
      {started && live && (
        <div className="absolute inset-x-0 flex justify-center pointer-events-none" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 132px)' }}>
          <div className="bg-black/55 backdrop-blur-md rounded-full pl-5 pr-2 py-2 flex items-center gap-3">
            <Countdown remaining={live.remaining} total={live.total} holding={live.holding} />
            <div className="text-start">
              <div className="font-semibold">{live.label}</div>
              {live.reps > 0 && <div className="text-white/70 text-sm">חזרה {COUNT_WORDS[live.rep - 1] ?? live.rep} מתוך {live.reps}</div>}
            </div>
          </div>
        </div>
      )}

      {toast && <div className="absolute inset-x-4 top-1/3 bg-black/80 border border-white/15 rounded-2xl p-3 text-center z-20 text-sm">{toast}</div>}

      {/* מסך פתיחה */}
      {!started && (
        <div className="absolute inset-0 z-10 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/40 to-transparent">
          <div className="p-6 pb-10 flex flex-col gap-3 max-w-[520px] w-full mx-auto">
            <div className="text-white/70 text-sm">{session.plannedMin} דקות · {session.steps.length} תרגילים</div>
            <div className="display text-[2rem] leading-tight">{session.title}</div>
            <ol className="flex flex-wrap gap-1.5 text-xs text-white/80">{session.steps.map(s => <li key={s.key} className="rounded-full bg-white/12 px-2.5 py-1">{s.exercise.nameHe}</li>)}</ol>
            <button className="chip !bg-white/10 !border-white/25 !text-white !justify-between mt-1" aria-pressed={mirror} onClick={() => setMirror(v => !v)}>
              <span>מראה ומאמנת פנים <span className="text-white/60 text-xs">(המצלמה לא מקליטה ולא שולחת)</span></span><span>{mirror ? 'פועל' : 'כבוי'}</span>
            </button>
            <button className="btn-primary !text-xl" onClick={start}>התחילי</button>
            <button className="text-white/70 py-2" onClick={() => nav(-1)}>חזרה</button>
          </div>
        </div>
      )}

      {/* פקדים */}
      {started && (
        <div className="absolute inset-x-0 z-10 flex flex-col items-center gap-2 px-4" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
          <div className="w-full max-w-[460px] bg-black/60 backdrop-blur-md rounded-[28px] p-2 flex items-center justify-between gap-2">
            <button className="btn-stop !min-h-[54px] !px-4 !rounded-[22px]" onClick={() => finish('stopped')}>סיום</button>
            <button className="chip !min-h-[54px] !px-4 !rounded-[22px] !bg-white/10 !border-white/20 !text-white" onClick={() => jump(-1)} disabled={idx === 0} aria-label="הקודם">→</button>
            <button className="w-[66px] h-[66px] rounded-full bg-white text-[var(--color-rose-deep)] text-xl grid place-items-center shadow-lg active:scale-95 transition-transform" onClick={() => setPaused(p => !p)} aria-label={paused ? 'המשך' : 'השהיה'}>{paused ? <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M8 5.5v13l11-6.5z" /></svg> : <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><rect x="6.5" y="5" width="4" height="14" rx="1.2" /><rect x="13.5" y="5" width="4" height="14" rx="1.2" /></svg>}</button>
            <button className="chip !min-h-[54px] !px-4 !rounded-[22px] !bg-white/10 !border-white/20 !text-white" onClick={() => jump(1)} disabled={idx >= session.steps.length - 1} aria-label="הבא">←</button>
            <button className="chip !min-h-[54px] !px-3 !rounded-[22px] !bg-white/10 !border-white/20 !text-white !text-sm" onClick={reportPain}>כואב לי</button>
          </div>
          <div className="flex items-center gap-2 text-white/70 text-sm tabular-nums">
            <span>{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}</span>
            <button className="chip !min-h-9 !px-3 !bg-black/40 !border-white/20 !text-white !text-xs" aria-pressed={mirror} onClick={() => setMirror(v => !v)}>מראה</button>
            <button className="chip !min-h-9 !px-3 !bg-black/40 !border-white/20 !text-white !text-xs" aria-pressed={musicOn} onClick={() => setMusicOn(v => !v)}>מוזיקה</button>
          </div>
        </div>
      )}
      {paused && started && <div className="absolute inset-0 grid place-items-center pointer-events-none z-0"><div className="bg-black/60 rounded-full px-8 py-3 text-xl">מושהה</div></div>}
    </div>
  );
}

function Countdown({ remaining, total, holding }: { remaining: number; total: number; holding: boolean }) {
  const r = 22, c = 2 * Math.PI * r, frac = total ? remaining / total : 0;
  return (
    <div className="relative w-14 h-14">
      <svg viewBox="0 0 56 56" className="w-14 h-14 -rotate-90"><circle cx="28" cy="28" r={r} fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="4" /><circle cx="28" cy="28" r={r} fill="none" stroke="var(--color-gold)" strokeWidth="4" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} style={{ transition: 'stroke-dashoffset 250ms linear' }} /></svg>
      <div className="absolute inset-0 grid place-items-center text-lg font-semibold tabular-nums">{holding && total ? remaining : '·'}</div>
    </div>
  );
}
function Steps({ steps }: { steps: string[] }) {
  return <ol className="absolute bottom-48 right-4 left-4 flex flex-col gap-1.5 text-sm">{steps.map((s, i) => <li key={i} className="flex gap-2 items-start"><span className="w-5 h-5 shrink-0 rounded-full bg-white/20 grid place-items-center text-xs">{i + 1}</span><span className="text-white/90 drop-shadow">{s}</span></li>)}</ol>;
}
