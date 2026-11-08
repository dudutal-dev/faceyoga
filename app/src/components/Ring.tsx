// טבעת 60 דקות בשבוע.
interface Props { minutes: number; goal: number; size?: number; days?: boolean[]; label?: string }
export default function Ring({ minutes, goal, size = 200, days, label = 'דקות השבוע' }: Props) {
  const r = (size - 18) / 2, c = 2 * Math.PI * r, frac = Math.min(1, minutes / goal);
  return (
    <div className="flex flex-col items-center gap-3" role="img" aria-label={`${minutes} דקות מתוך ${goal} השבוע`}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
          <defs><linearGradient id="ringg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="var(--color-gold)" /><stop offset="1" stopColor="var(--accent)" /></linearGradient></defs>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ring-track)" strokeWidth="12" />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#ringg)" strokeWidth="12" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(.4,0,.2,1)' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="display leading-none" style={{ fontSize: size * 0.28 }}>{minutes}</div>
          <div className="soft text-sm mt-1">{label}</div>
          <div className="soft text-xs">מתוך {goal}</div>
        </div>
      </div>
      {days && <div className="flex gap-2" aria-label="ימי תרגול השבוע">{days.map((d, i) => <span key={i} className="w-2.5 h-2.5 rounded-full" style={{ background: d ? 'var(--accent)' : 'var(--ring-track)' }} />)}</div>}
    </div>
  );
}
