// יומן: צילומי שבועות 0/6/12/24 עם השוואה בהחלקה, ומגמות הצ'ק־אין השבועי. הכול מקומי.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, type PhotoRow, type CheckIn } from '../db';
import { loadState, type UserState } from '../lib/state';
import { PHOTO_WEEKS } from '../content/plan';
import { trend } from '../lib/adapt';

export default function Journal() {
  const nav = useNavigate();
  const [s, setS] = useState<UserState | null>(null);
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [checks, setChecks] = useState<CheckIn[]>([]);
  const [view, setView] = useState<'front' | 'profile'>('front');
  useEffect(() => { loadState().then(setS); db.photos.toArray().then(setPhotos); db.checkins.orderBy('week').toArray().then(setChecks); }, []);
  const byWeek = useMemo(() => Object.fromEntries(photos.filter(p => p.view === view).map(p => [p.week, p])), [photos, view]);
  const weeks = (PHOTO_WEEKS as readonly number[]).filter(w => byWeek[w]);
  const [a, b] = [weeks[0], weeks.at(-1)];
  if (!s) return null;
  return (
    <section className="flex flex-col gap-5">
      <header className="pt-2 rise"><div className="eyebrow">נשמר רק בטלפון</div><h1 className="text-[1.9rem]">היומן שלך</h1></header>

      <div className="flex gap-2">{(['front', 'profile'] as const).map(v => <button key={v} className="chip" aria-pressed={view === v} onClick={() => setView(v)}>{v === 'front' ? 'חזית' : 'פרופיל'}</button>)}</div>
      {weeks.length >= 2 && a !== undefined && b !== undefined && a !== b
        ? <Compare before={byWeek[a]!} after={byWeek[b]!} labels={[`שבוע ${a}`, `שבוע ${b}`]} />
        : <div className="card-tint p-5 soft">{weeks.length ? 'אחרי הצילום הבא תוכלי להשוות בהחלקה.' : 'עוד אין צילומים. הצילום הראשון לוקח דקה.'}</div>}

      <div className="grid grid-cols-4 gap-2">
        {(PHOTO_WEEKS as readonly number[]).map(w => {
          const p = byWeek[w]; const due = w <= s.week;
          return (
            <button key={w} className="flex flex-col items-center gap-1" onClick={() => due && nav(`/photo/${w}`)} disabled={!due}>
              <span className="w-full aspect-[3/4] rounded-2xl overflow-hidden bg-[var(--bg-tint)] grid place-items-center border border-[var(--line)]">{p ? <Thumb row={p} /> : <span className="soft text-2xl">{due ? '+' : '·'}</span>}</span>
              <span className="text-xs soft">שבוע {w}</span>
            </button>
          );
        })}
      </div>

      <div className="card p-5 flex flex-col gap-3">
        <div className="font-semibold">איך זה מרגיש, שבוע אחרי שבוע</div>
        {checks.length < 2 ? <p className="soft text-sm">הצ'ק־אין השבועי מופיע במסך "היום" משבוע 2. אחרי שניים כאלה יופיע כאן גרף.</p> : <Chart rows={checks} />}
        {checks.length >= 2 && (
          <ul className="text-sm flex flex-col gap-1">
            {([['jawTension', 'מתח בלסת'], ['puffiness', 'נפיחות בבוקר'], ['satisfaction', 'שביעות רצון']] as const).map(([k, t]) => { const tr = trend(checks, k); return <li key={k} className="flex justify-between"><span>{t}</span><span className="soft">{tr === 'better' ? 'השתפר' : tr === 'worse' ? 'פחות טוב' : 'יציב'}</span></li>; })}
          </ul>
        )}
      </div>
      <p className="soft text-sm">בהשוואה הוגנת חשוב שהתאורה תהיה דומה. שינוי קטן בתאורה נראה גדול יותר מכל תרגיל.</p>
    </section>
  );
}

function useObjectUrl(blob: Blob) { const [u, setU] = useState(''); useEffect(() => { const x = URL.createObjectURL(blob); setU(x); return () => URL.revokeObjectURL(x); }, [blob]); return u; }
function Thumb({ row }: { row: PhotoRow }) { const u = useObjectUrl(row.blob); return u ? <img src={u} alt="" className="w-full h-full object-cover" /> : null; }

function Compare({ before, after, labels }: { before: PhotoRow; after: PhotoRow; labels: [string, string] }) {
  const [pos, setPos] = useState(50);
  const ua = useObjectUrl(before.blob), ub = useObjectUrl(after.blob);
  return (
    <div className="relative rounded-[24px] overflow-hidden aspect-[3/4] bg-black select-none" dir="ltr">
      {ub && <img src={ub} alt={labels[1]} className="absolute inset-0 w-full h-full object-cover" />}
      {ua && <img src={ua} alt={labels[0]} className="absolute inset-0 w-full h-full object-cover" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />}
      <div className="absolute inset-y-0 w-0.5 bg-white/90 shadow" style={{ left: `${pos}%` }}><div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white text-[var(--color-rose-deep)] grid place-items-center shadow">⇆</div></div>
      <span className="absolute top-3 left-3 bg-black/55 text-white text-xs rounded-full px-2.5 py-1">{labels[0]}</span>
      <span className="absolute top-3 right-3 bg-black/55 text-white text-xs rounded-full px-2.5 py-1">{labels[1]}</span>
      <input type="range" min={0} max={100} value={pos} onChange={e => setPos(+e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize" aria-label="השוואה" />
    </div>
  );
}

/** גרף קווים פשוט ל-3 מדדים, 0–10, לאורך שבועות. */
function Chart({ rows }: { rows: CheckIn[] }) {
  const W = 320, H = 140, P = 20;
  const xs = rows.map(r => r.week), x0 = Math.min(...xs), x1 = Math.max(...xs, x0 + 1);
  const X = (w: number) => P + ((w - x0) / (x1 - x0)) * (W - 2 * P), Y = (v: number) => H - P - (v / 10) * (H - 2 * P);
  const series = [['jawTension', 'var(--accent)', 'מתח בלסת'], ['puffiness', 'var(--color-gold)', 'נפיחות'], ['satisfaction', 'var(--color-sage)', 'שביעות רצון']] as const;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ direction: "ltr" }} role="img" aria-label="מגמות שבועיות">
        {[0, 5, 10].map(v => <line key={v} x1={P} x2={W - P} y1={Y(v)} y2={Y(v)} stroke="var(--line)" />)}
        {series.map(([k, c]) => <polyline key={k} fill="none" stroke={c} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" points={rows.map(r => `${X(r.week)},${Y(r[k])}`).join(' ')} />)}
        {rows.map(r => <text key={r.week} x={X(r.week)} y={H - 4} fontSize="10" textAnchor="middle" fill="var(--fg-soft)">{r.week}</text>)}
      </svg>
      <div className="flex gap-3 text-xs mt-1">{series.map(([k, c, t]) => <span key={k} className="flex items-center gap-1"><span className="w-3 h-1 rounded" style={{ background: c }} />{t}</span>)}</div>
    </div>
  );
}
