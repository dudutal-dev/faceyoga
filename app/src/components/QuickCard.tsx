// כרטיס מפגש קצר: גרדיאנט עז + אייקון. משותף ל"היום" ולספרייה.
import { QUICK } from '../content/plan';

const LOOK: Record<string, { cls: string; icon: React.ReactNode }> = {
  morning: { cls: 'grad-sun', icon: <><circle cx="12" cy="12" r="4.2" /><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" /></> },
  event: { cls: 'grad-emerald', icon: <><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /><path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" /></> },
  jaw: { cls: 'grad-blue', icon: <><path d="M3 9c3 0 3-3 6-3s3 3 6 3 3-3 6-3" /><path d="M3 15c3 0 3-3 6-3s3 3 6 3 3-3 6-3" /></> },
  sleep: { cls: 'grad-night', icon: <><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /><path d="M16.5 4.5l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5z" /></> },
};

export default function QuickCard({ k, onClick }: { k: string; onClick: () => void }) {
  const q = QUICK[k]!; const look = LOOK[k] ?? LOOK.jaw!;
  return (
    <button className={`${look.cls} grad-card p-4 text-start flex flex-col gap-3 min-h-[118px] active:scale-[.97] transition-transform`} onClick={onClick}>
      <span className="w-10 h-10 rounded-2xl bg-white/20 grid place-items-center backdrop-blur">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{look.icon}</svg>
      </span>
      <span className="flex flex-col"><span className="font-bold text-[1.05rem] leading-tight">{q.nameHe}</span><span className="text-white/85 text-sm">{q.sub}</span></span>
    </button>
  );
}
