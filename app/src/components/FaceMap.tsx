// מפת פנים אינטראקטיבית: ניווט בספרייה וסימון אזורי טיפול. SVG פשוט, עובד בשני הנושאים.
import type { Zone } from '../db';
import { ZONE_HE } from '../content/exercises';

const SHAPES: Record<Zone, { d: string; lx: number; ly: number }> = {
  forehead: { d: 'M62 58c10-22 30-32 38-32s28 10 38 32c-12-6-24-9-38-9s-26 3-38 9z', lx: 100, ly: 44 },
  glabella: { d: 'M92 62h16v16h-16z', lx: 100, ly: 72 },
  eyes: { d: 'M58 84c6-8 14-10 22-10s14 4 16 10c-6 6-12 8-19 8s-14-3-19-8zM104 84c2-6 8-10 16-10s16 2 22 10c-5 5-12 8-19 8s-13-2-19-8z', lx: 100, ly: 96 },
  cheeks: { d: 'M52 100c6 4 14 6 24 6l2 26c-10 0-20-6-26-14zM148 100c-6 4-14 6-24 6l-2 26c10 0 20-6 26-14z', lx: 100, ly: 120 },
  lips: { d: 'M82 140c6-4 12-5 18-5s12 1 18 5c-5 7-11 10-18 10s-13-3-18-10z', lx: 100, ly: 163 },
  jaw: { d: 'M56 128c6 20 20 36 44 42 24-6 38-22 44-42l6 6c-6 24-24 42-50 46-26-4-44-22-50-46z', lx: 100, ly: 186 },
  neck: { d: 'M76 182h48l6 44H70z', lx: 100, ly: 214 },
};

interface Props { selected?: Zone[]; onToggle?: (z: Zone) => void; highlight?: Zone[]; size?: number; labels?: boolean }
export default function FaceMap({ selected = [], onToggle, highlight = [], size = 220, labels = true }: Props) {
  return (
    <svg viewBox="0 0 200 236" width={size} height={size * 1.18} role="group" aria-label="מפת אזורי הפנים">
      <path d="M100 18c-34 0-56 28-56 66 0 44 22 82 56 92 34-10 56-48 56-92 0-38-22-66-56-66z" fill="var(--bg-tint)" stroke="var(--line)" strokeWidth="1.5" />
      {(Object.keys(SHAPES) as Zone[]).map(z => {
        const on = selected.includes(z), hi = highlight.includes(z);
        return (
          <g key={z} onClick={() => onToggle?.(z)} style={{ cursor: onToggle ? 'pointer' : 'default' }} role={onToggle ? 'button' : undefined} aria-pressed={onToggle ? on : undefined} aria-label={ZONE_HE[z]}>
            <path d={SHAPES[z].d} fill={on ? 'var(--accent)' : hi ? 'var(--color-gold)' : 'var(--fg-soft)'} fillOpacity={on ? 0.75 : hi ? 0.55 : 0.12} stroke={on ? 'var(--accent-deep)' : 'transparent'} strokeWidth="1.5" />
          </g>
        );
      })}
      {labels && (Object.keys(SHAPES) as Zone[]).filter(z => z !== 'glabella').map(z => <text key={z} x={SHAPES[z].lx} y={SHAPES[z].ly} textAnchor="middle" fontSize="10" fill="var(--fg)" fillOpacity=".8" pointerEvents="none">{ZONE_HE[z]}</text>)}
    </svg>
  );
}
