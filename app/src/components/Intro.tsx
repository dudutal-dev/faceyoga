// מסך הפתיחה (סרטון המדריכה על כל המסך) וההקדמה בפרקים, בסגנון סטוריז, בקול המדריכה.
import { useEffect, useRef, useState } from 'react';
import { INTRO } from '../content/exercises';
import { contentUrl, loadManifest, mediaFor, type Manifest } from '../content/manifest';

/** נגן ההקדמה, משוחרר מתוך נגיעה (חובה באייפון). לקרוא בלחיצה שפותחת את ההקדמה. */
let shared: HTMLAudioElement | null = null;
export function unlockIntroAudio() {
  shared = new Audio(contentUrl('audio/ui/silence.mp3'));
  shared.setAttribute('playsinline', '');
  shared.play().catch(() => {});
}

export function Welcome({ onIntro, onSkip }: { onIntro: () => void; onSkip: () => void }) {
  const [m, setM] = useState<Manifest | null>(null);
  useEffect(() => { loadManifest().then(setM); }, []);
  const hero = m ? mediaFor(m, 'hero') : {};
  return (
    <div className="fixed inset-0 bg-black text-white overflow-hidden" dir="rtl">
      {hero.clip
        ? <video src={contentUrl(hero.clip)} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover object-[50%_20%] fade-in" />
        : <img src={contentUrl(hero.still ?? 'character/front.jpg')} alt="" className="absolute inset-0 w-full h-full object-cover object-[50%_20%] kenburns fade-in" />}
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 via-45% to-black/20" />
      <div className="absolute inset-x-0 bottom-0 px-6 flex flex-col gap-4 max-w-[520px] mx-auto" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 28px)' }}>
        <div className="text-[0.85rem] tracking-[0.2em] text-white/90 rise" style={{ textShadow: '0 1px 8px rgba(0,0,0,.6)' }}>יוגה לפָּנִים · 12 שבועות</div>
        <h1 className="text-[3.4rem] leading-[0.95] font-bold rise-2" style={{ fontFamily: 'var(--font-display)', textShadow: '0 2px 18px rgba(0,0,0,.45)' }}>פָּנִים<span className="text-[var(--color-gold)]"> 12</span></h1>
        <p className="text-xl text-white/85 leading-snug rise-3">רבע שעה, כמה פעמים בשבוע.<br />רק בשבילך.</p>
        <div className="flex flex-wrap gap-2 text-xs text-white/80 rise-3">
          {['מדריכה בווידאו', 'קריינות בעברית', 'מראה ומאמנת פנים', 'בלי חשבון'].map(t => <span key={t} className="rounded-full border border-white/25 bg-white/10 backdrop-blur px-3 py-1.5">{t}</span>)}
        </div>
        <button className="btn-primary mt-2 !bg-none !bg-white !text-[var(--color-rose-deep)] rise-3" onClick={() => { unlockIntroAudio(); onIntro(); }}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden><path d="M8 5.5v13l11-6.5z" /></svg>
          בואי נכיר
        </button>
        <button className="text-white/70 py-1 text-sm" onClick={onSkip}>כבר מכירה, ישר להרשמה</button>
      </div>
    </div>
  );
}

/** ההקדמה: 5 פרקים. יש להפעיל מתוך נגיעה (משחרר שמע באייפון). */
export function IntroStories({ onDone, doneLabel = 'בואי נתחיל' }: { onDone: () => void; doneLabel?: string }) {
  const [m, setM] = useState<Manifest | null>(null);
  const [i, setI] = useState(0);
  const [t, setT] = useState(0);             // התקדמות הפרק הנוכחי 0..1
  const [paused, setPaused] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const talkVid = useRef<HTMLVideoElement | null>(null);
  useEffect(() => { loadManifest().then(setM); }, []);

  // אלמנט שמע אחד, שוחרר בנגיעה שפתחה את ההקדמה (play מתבצע מיד בטעינה הראשונה).
  useEffect(() => {
    if (!m) return;
    const a = (audio.current ??= shared ?? new Audio());
    const n = m.narration[INTRO[i]!.id];
    setT(0);
    if (!n) { const id = window.setTimeout(next, 9000); return () => window.clearTimeout(id); }
    a.src = contentUrl(n.url);
    a.onended = () => window.setTimeout(next, 900);
    a.ontimeupdate = () => {
      setT(a.duration ? a.currentTime / a.duration : 0);
      const v = talkVid.current;
      if (v && Math.abs(v.currentTime - a.currentTime) > 0.12) v.currentTime = a.currentTime; // תיקון סטייה: השפתיים עם הקול
    };
    a.onplay = () => { const v = talkVid.current; if (v) { v.currentTime = a.currentTime; v.play().catch(() => {}); } };
    a.onpause = () => talkVid.current?.pause();
    a.play().catch(() => setPaused(true));
    return () => { a.onended = null; a.ontimeupdate = null; a.onplay = null; a.onpause = null; a.pause(); };
  }, [m, i]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { audio.current?.pause(); }, []);

  function next() { setI(x => { if (x >= INTRO.length - 1) { return x; } return x + 1; }); }
  function prev() { setI(x => Math.max(0, x - 1)); }
  function togglePause() { const a = audio.current; if (!a) return; if (a.paused) { a.play().catch(() => {}); setPaused(false); } else { a.pause(); setPaused(true); } }
  const last = i === INTRO.length - 1;
  const ch = INTRO[i]!;

  return (
    <div className="fixed inset-0 bg-black text-white overflow-hidden select-none" dir="rtl">
      {m?.talk?.[ch.id]
        ? <video key={ch.id} ref={talkVid} src={contentUrl(m.talk[ch.id]!)} muted playsInline preload="auto" className="absolute inset-0 w-full h-full object-cover object-[50%_22%] fade-in" />
        : INTRO.map((c, k) => <img key={c.id} src={contentUrl(c.image)} alt="" className="absolute inset-0 w-full h-full object-cover object-[50%_22%] transition-opacity duration-700" style={{ opacity: k === i ? 1 : 0 }} />)}
      <div className="absolute inset-0 bg-gradient-to-t from-black/92 via-black/35 to-black/45" />
      {/* פסי התקדמות */}
      <div className="absolute inset-x-3 flex gap-1.5" style={{ top: 'calc(env(safe-area-inset-top) + 10px)' }}>
        {INTRO.map((c, k) => <div key={c.id} className="flex-1 h-[3px] rounded-full bg-white/25 overflow-hidden"><div className="h-full bg-white" style={{ width: `${k < i ? 100 : k === i ? Math.round(t * 100) : 0}%`, transition: 'width 250ms linear' }} /></div>)}
      </div>
      <div className="absolute inset-x-4 flex items-center justify-between" style={{ top: 'calc(env(safe-area-inset-top) + 22px)' }}>
        <span className="text-xs text-white/70">פרק {i + 1} מתוך {INTRO.length}</span>
        <button className="text-sm text-white/80 px-3 py-1.5 rounded-full bg-black/30 backdrop-blur" onClick={onDone}>דלגי</button>
      </div>
      {/* אזורי נגיעה: ימין = אחורה, שמאל = קדימה (כיוון קריאה בעברית) */}
      <button className="absolute top-20 bottom-56 right-0 w-1/3" aria-label="הפרק הקודם" onClick={prev} />
      <button className="absolute top-20 bottom-56 left-0 w-1/3" aria-label="הפרק הבא" onClick={() => (last ? undefined : next())} />
      <button className="absolute top-20 bottom-56 left-1/3 w-1/3" aria-label={paused ? 'המשך' : 'השהיה'} onClick={togglePause} />

      <div key={ch.id} className="absolute inset-x-0 bottom-0 px-6 flex flex-col gap-3 max-w-[520px] mx-auto" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}>
        <h2 className="text-[2rem] leading-tight rise" style={{ fontFamily: 'var(--font-display)' }}>{ch.title}</h2>
        <p className="text-[1.05rem] leading-relaxed text-white/88 rise-2">{ch.text}</p>
        {i === 2 && (
          <div className="grid grid-cols-3 gap-2 rise-3">
            {[['stills/rel_temples.jpg', 'שחרור'], ['stills/act_cheek_lift.jpg', 'הפעלה'], ['stills/lift_sweep.jpg', 'הרמה']].map(([src, label], k) => (
              <div key={label} className="relative rounded-2xl overflow-hidden aspect-[3/4] border border-white/15">
                <img src={contentUrl(src!)} alt="" className="w-full h-full object-cover object-top" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 text-sm font-semibold"><span className="text-[var(--color-gold)]">{k + 1}</span> {label}</div>
              </div>
            ))}
          </div>
        )}
        {i === 3 && (
          <ul className="flex flex-col gap-1.5 text-sm rise-3">
            {[['ימים', 'פחות נפיחות, לסת רגועה', true], ['חודשיים ומעלה', 'אולי מלאות קלה בלחיים', true], ['לא יקרה', 'קמטים עמוקים, הרמת עפעף', false]].map(([when, what, ok]) => (
              <li key={String(when)} className="flex items-center gap-3 rounded-xl bg-white/10 backdrop-blur px-3 py-2">
                <span className="w-6 h-6 shrink-0 rounded-full grid place-items-center text-xs" style={{ background: ok ? 'var(--color-sage)' : 'rgba(255,255,255,.2)' }}>{ok ? '✓' : '–'}</span>
                <span className="flex flex-col leading-tight"><span className="font-semibold">{when}</span><span className="text-white/80 text-[0.85rem]">{what}</span></span>
              </li>
            ))}
          </ul>
        )}
        {i === 4 && (
          <div className="flex flex-wrap gap-2 text-xs rise-3">{['נשאר בטלפון', 'בלי חשבון', 'בלי צילום שנשלח', 'אפשר לכבות בכל רגע'].map(x => <span key={x} className="rounded-full bg-white/12 border border-white/20 px-3 py-1.5">{x}</span>)}</div>
        )}
        <div className="flex items-center gap-3 mt-2">
          {last
            ? <button className="btn-primary !bg-none !bg-white !text-[var(--color-rose-deep)]" onClick={onDone}>{doneLabel}</button>
            : <>
                <button className="w-12 h-12 shrink-0 rounded-full bg-white/12 grid place-items-center" onClick={togglePause} aria-label={paused ? 'המשך' : 'השהיה'}>
                  {paused ? <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M16 5.5v13L5 12z" /></svg> : <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><rect x="6.5" y="5" width="4" height="14" rx="1.2" /><rect x="13.5" y="5" width="4" height="14" rx="1.2" /></svg>}
                </button>
                <button className="flex-1 h-12 rounded-full bg-white/15 font-semibold" onClick={next}>הבא</button>
              </>}
        </div>
      </div>
    </div>
  );
}
