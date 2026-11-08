// סיום מפגש: שמירה, תחושת לסת/צוואר, חגיגת שבוע ירוק, התאמות בטיחות.
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { db, todayISO, getProfile, type SessionKind, type SessionStatus, type SessionRow } from '../db';
import { weekNumber, summarizeWeek } from '../lib/week';
import { adviseAfterSession } from '../lib/adapt';
import { WEEKLY_GOAL_MIN } from '../content/plan';
import Ring from '../components/Ring';

interface St { kind: SessionKind; plannedMin: number; actualSec: number; status: SessionStatus; exercises: string[]; coachReps: number; wrinkleWarnings: number; pain: boolean }

export default function Finish() {
  const nav = useNavigate();
  const st = useLocation().state as St | null;
  const [id, setId] = useState<number | null>(null);
  const [feel, setFeel] = useState(7);
  const [msgs, setMsgs] = useState<string[]>([]);
  const [ring, setRing] = useState<{ minutes: number; green: boolean; newlyGreen: boolean } | null>(null);
  const saved = useRef(false);

  useEffect(() => {
    if (!st || saved.current) return; saved.current = true;
    (async () => {
      const p = await getProfile(); if (!p) return;
      const week = weekNumber(p.startDate, todayISO());
      const all = await db.sessions.toArray();
      const before = summarizeWeek(all, p.startDate, week, p.track === 'light');
      const row: SessionRow = { date: todayISO(), week, kind: st.kind, plannedMin: st.plannedMin, actualSec: st.actualSec, status: st.status, exercises: st.exercises, coachReps: st.coachReps, wrinkleWarnings: st.wrinkleWarnings, feel: null, pain: st.pain };
      const newId = await db.sessions.add(row); setId(newId as number);
      const after = summarizeWeek([...all, row], p.startDate, week, p.track === 'light');
      setRing({ minutes: after.minutes, green: after.green, newlyGreen: after.green && !before.green });
    })();
  }, [st]);

  async function done() {
    if (id !== null) {
      await db.sessions.update(id, { feel });
      const rows = (await db.sessions.orderBy('id').reverse().limit(2).toArray());
      const m = adviseAfterSession({ ...rows[0]!, feel }, rows[1]);
      if (m.length) { setMsgs(m); return; }
    }
    nav('/', { replace: true });
  }
  if (!st) return <div className="py-20 text-center"><button className="btn-secondary" onClick={() => nav('/')}>לדף הבית</button></div>;
  const min = Math.max(1, Math.round(st.actualSec / 60));

  return (
    <section className="flex flex-col gap-5 pt-6 min-h-[85dvh]">
      <div className="text-center rise">
        <div className="eyebrow">{st.status === 'done' ? 'סיימת' : 'נשמר'}</div>
        <h1 className="text-[2.1rem] mt-1">{ring?.newlyGreen ? 'שבוע ירוק!' : st.status === 'done' ? 'יפה מאוד' : 'כל דקה נספרת'}</h1>
        <p className="soft mt-1">{min} דקות{st.coachReps ? ` · המאמנת ספרה ${st.coachReps} חזרות` : ''}{st.wrinkleWarnings ? ` · ${st.wrinkleWarnings} תזכורות למצח` : ''}</p>
      </div>
      {ring && <div className="flex justify-center rise-2"><Ring minutes={ring.minutes} goal={WEEKLY_GOAL_MIN} size={180} /></div>}

      {msgs.length === 0 ? (
        <div className="card p-5 flex flex-col gap-2 rise-3">
          <div className="font-semibold">איך הלסת והצוואר מרגישים עכשיו?</div>
          <input type="range" min={0} max={10} value={feel} onChange={e => setFeel(+e.target.value)} aria-label="תחושה" />
          <div className="flex justify-between text-sm soft"><span>תפוסים</span><span className="font-semibold text-[var(--fg)]">{feel}</span><span>משוחררים</span></div>
        </div>
      ) : (
        <div className="card p-5 flex flex-col gap-3 border-[var(--color-gold)]">{msgs.map(m => <p key={m}>{m}</p>)}</div>
      )}
      <button className="btn-primary mt-auto" onClick={() => (msgs.length ? nav('/', { replace: true }) : done())}>{msgs.length ? 'הבנתי' : 'שמירה'}</button>
    </section>
  );
}
