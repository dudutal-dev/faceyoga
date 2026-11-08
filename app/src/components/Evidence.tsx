// תג ראיות: נקודות + מילה. לחיצה מסבירה.
import { EVIDENCE_HE } from '../content/exercises';
export default function Evidence({ level, compact = false }: { level: 0 | 1 | 2 | 3; compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-2.5 py-1 bg-[var(--bg-tint)] soft" title={EVIDENCE_HE[level]}>
      <span aria-hidden className="tracking-[2px]">{[1, 2, 3].map(i => <span key={i} style={{ color: i <= level ? 'var(--accent)' : 'var(--line)' }}>●</span>)}</span>
      {!compact && <span>{EVIDENCE_HE[level]}</span>}
    </span>
  );
}
