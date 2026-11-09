import { useEffect, useState } from 'react';
import { loadState, type UserState } from '../lib/state';
import { STAGES, PROGRAM_WEEKS, newInWeek, PHOTO_WEEKS } from '../content/plan';
import { summarizeWeek } from '../lib/week';

export default function Plan() {
  const [s, setS] = useState<UserState | null>(null);
  useEffect(() => { loadState().then(setS); }, []);
  if (!s) return null;
  const light = s.profile.track === 'light';
  return (
    <section className="flex flex-col gap-5">
      <header className="pt-2 rise"><div className="eyebrow">12 שבועות</div><h1 className="text-[1.9rem]">התוכנית</h1>
        <p className="soft">כל מפגש: שחרור, הפעלה, הרמה. כל שלב מאריך את ההחזקות ומוסיף תרגילים.</p></header>
      {STAGES.filter(st => st.key !== 'M').map((st, si) => (
        <div key={st.key} className="card overflow-hidden flex flex-col rise-2">
          <div className={`${['grad-sun', 'grad-emerald', 'grad-blue', 'grad-night'][si]} px-5 py-4 flex items-baseline justify-between`}><div className="display text-xl">{st.nameHe}</div><div className="text-white/85 text-sm">שבועות {st.weeks[0]}–{st.weeks[1]}</div></div>
          <div className="p-5 pt-3 flex flex-col gap-3">
          <div className="soft text-sm">{st.perWeek - (light ? 1 : 0)} מפגשים × {st.minutes} דקות · החזקה של {st.hold} שניות</div>
          <div className="flex flex-col gap-2">
            {Array.from({ length: st.weeks[1] - st.weeks[0] + 1 }, (_, n) => st.weeks[0] + n).map(w => {
              const sum = summarizeWeek(s.sessions, s.profile.startDate, w, light);
              const cur = w === s.week, past = w < s.week;
              const fresh = newInWeek(w);
              return (
                <div key={w} className={`rounded-2xl px-4 py-3 flex items-center gap-3 ${cur ? 'bg-[var(--accent)]/10 border-2 border-[var(--accent)]' : 'bg-[var(--bg-tint)]'}`}>
                  <span className="w-9 h-9 rounded-full grid place-items-center text-sm font-semibold shrink-0" style={{ background: sum.green ? 'var(--color-sage)' : past ? 'var(--line)' : 'var(--bg-elev)', color: sum.green ? '#fff' : 'var(--fg)' }}>{sum.green ? '✓' : w}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">שבוע {w}{cur ? ' · עכשיו' : ''}{(PHOTO_WEEKS as readonly number[]).includes(w) ? ' · צילום' : ''}</div>
                    <div className="soft text-sm truncate">{past || cur ? `${sum.minutes} דקות · ${sum.mainSessions}/${sum.target} מפגשים` : fresh.length ? `חדש: ${fresh.map(e => e.nameHe).join(', ')}` : 'ממשיכות לבנות'}</div>
                  </div>
                </div>
              );
            })}
          </div>
          </div>
        </div>
      ))}
      <div className="card-tint p-5"><div className="font-semibold">אחרי שבוע {PROGRAM_WEEKS}: תחזוקה</div><p className="soft text-sm mt-1">שני מפגשים בשבוע שומרים על מה שבנית. צילום השוואה בשבוע 24.</p></div>
    </section>
  );
}
