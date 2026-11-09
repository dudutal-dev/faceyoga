import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Ring from '../components/Ring';
import { loadState, nextSession, type UserState } from '../lib/state';
import { WEEKLY_GOAL_MIN, FOCUS_HE, PROGRAM_WEEKS, stageOf, QUICK } from '../content/plan';
import { softNudge } from '../lib/adapt';
import { contentUrl } from '../content/manifest';
import { db } from '../db';

function greeting() { const h = new Date().getHours(); return h < 11 ? 'בוקר טוב' : h < 17 ? 'צהריים טובים' : h < 21 ? 'ערב טוב' : 'לילה טוב'; }

export default function Today() {
  const nav = useNavigate();
  const [s, setS] = useState<UserState | null>(null);
  const [check, setCheck] = useState({ jawTension: 5, puffiness: 5, satisfaction: 5 });
  useEffect(() => { loadState().then(setS); }, []);
  if (!s) return null;
  const next = nextSession(s);
  const stage = stageOf(s.week);
  const nudge = softNudge(s.lastDate, s.today);
  const morning = new Date().getHours() < 12;
  const doneToday = s.sessions.some(x => x.date === s.today && x.kind === 'main');

  async function saveCheckin() { await db.checkins.add({ week: s!.week, date: s!.today, ...check }); setS(await loadState()); }

  return (
    <section className="flex flex-col gap-5">
      <header className="flex items-start justify-between pt-2 rise">
        <div>
          <div className="eyebrow">שבוע {Math.min(s.week, 99)}{s.week <= PROGRAM_WEEKS ? ` מתוך ${PROGRAM_WEEKS}` : ''} · {stage.nameHe}</div>
          <h1 className="text-[1.9rem] leading-tight mt-1">{greeting()}{s.profile.name ? `, ${s.profile.name}` : ''}</h1>
        </div>
        <Link to="/settings" className="chip !min-h-11 !w-11 !px-0 justify-center" aria-label="הגדרות">
          <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
        </Link>
      </header>

      {/* כרטיס המפגש הבא */}
      <div className="relative overflow-hidden rounded-[28px] min-h-[300px] flex flex-col justify-end rise-2" style={{ background: 'var(--bg-tint)' }}>
        <img src={contentUrl('character/front.jpg')} alt="" className="absolute inset-0 w-full h-full object-cover object-[50%_20%]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
        <div className="relative p-5 text-white flex flex-col gap-2">
          <div className="text-white/80 text-sm">{doneToday ? 'כבר תרגלת היום. מפגש נוסף?' : 'המפגש הבא'} · {next.plannedMin} דקות</div>
          <div className="display text-[1.8rem] leading-tight">{FOCUS_HE[next.focus!]}</div>
          <div className="text-white/80 text-sm">{next.steps.length} תרגילים · שחרור, הפעלה, הרמה</div>
          <button className="btn-primary mt-2 !bg-none !bg-white !text-[var(--color-rose-deep)]" onClick={() => nav('/session/main')}>התחילי מפגש</button>
        </div>
      </div>

      {s.photoDue !== null && (
        <button className="tint-lilac p-4 flex items-center gap-4 text-start rise-3" onClick={() => nav(`/photo/${s.photoDue}`)}>
          <span className="w-12 h-12 rounded-full grid place-items-center bg-white/60 text-xl">◎</span>
          <span className="flex-1"><span className="font-semibold block">צילום שבוע {s.photoDue}</span><span className="soft text-sm">חזית ופרופיל, דקה אחת. נשאר רק בטלפון.</span></span>
          <span className="soft">←</span>
        </button>
      )}

      <div className="grid grid-cols-[auto_1fr] gap-5 items-center tint-peach p-5 rise-3">
        <Ring minutes={s.summary.minutes} goal={WEEKLY_GOAL_MIN} size={132} days={s.summary.days} label="דקות" />
        <div className="flex flex-col gap-1">
          <div className="font-semibold">{s.summary.mainSessions} מתוך {s.summary.target} מפגשים</div>
          <div className="soft text-sm">{s.summary.green ? 'שבוע ירוק. כל הכבוד.' : `עוד ${s.summary.target - s.summary.mainSessions} כדי לסגור שבוע ירוק.`}</div>
          {s.streak > 1 && <div className="text-sm mt-1" style={{ color: 'var(--accent)' }}>{s.streak} שבועות ירוקים ברצף</div>}
          {nudge && <div className="text-sm soft mt-1">{nudge}</div>}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="eyebrow">{morning ? 'הבוקר' : 'קצר וטוב'}</div>
        <div className="grid grid-cols-2 gap-3">
          {(morning ? ['morning', 'event'] : ['jaw', 'sleep']).map(k => (
            <button key={k} className={`${({ morning: 'tint-butter', event: 'tint-blush', jaw: 'tint-lilac', sleep: 'tint-mint' } as Record<string, string>)[k]} p-4 text-start flex flex-col gap-1 active:scale-[.98] transition-transform min-h-[92px]`} onClick={() => nav(`/session/${k}`)}>
              <span className="font-bold">{QUICK[k]!.nameHe}</span><span className="soft text-sm">{QUICK[k]!.sub}</span>
            </button>
          ))}
        </div>
      </div>

      {s.checkinDue && (
        <div className="card p-5 flex flex-col gap-3">
          <div className="font-semibold">צ'ק־אין שבועי</div>
          {([['jawTension', 'מתח בלסת', 'רגועה', 'תפוסה'], ['puffiness', 'נפיחות בבוקר', 'אין', 'הרבה'], ['satisfaction', 'שביעות רצון מהמראה', 'נמוכה', 'גבוהה']] as const).map(([k, t, lo, hi]) => (
            <label key={k} className="flex flex-col">
              <span className="flex justify-between text-sm"><span>{t}</span><span className="soft">{check[k]}</span></span>
              <input type="range" min={0} max={10} value={check[k]} onChange={e => setCheck({ ...check, [k]: +e.target.value })} />
              <span className="flex justify-between text-xs soft"><span>{lo}</span><span>{hi}</span></span>
            </label>
          ))}
          <button className="btn-secondary" onClick={saveCheckin}>שמירה</button>
        </div>
      )}

      {s.filter.reasons.length > 0 && (
        <details className="card-tint p-4 text-sm"><summary className="font-semibold cursor-pointer">התוכנית מותאמת לך</summary><ul className="mt-2 flex flex-col gap-1 soft">{s.filter.reasons.map(r => <li key={r}>{r}</li>)}</ul></details>
      )}
    </section>
  );
}
