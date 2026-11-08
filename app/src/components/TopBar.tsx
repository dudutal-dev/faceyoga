import { useNavigate } from 'react-router-dom';
interface Props { title: string; onBack?: () => void; exitTo?: string | null; exitLabel?: string; step?: string }
export default function TopBar({ title, onBack, exitTo = '/', exitLabel = 'סגירה', step }: Props) {
  const nav = useNavigate();
  return (
    <header className="sticky top-0 z-20 -mx-4 px-4 py-2 bg-[var(--bg)]/92 backdrop-blur-xl flex items-center justify-between gap-2" style={{ paddingTop: 'calc(env(safe-area-inset-top) + .5rem)' }}>
      <div className="w-20">{onBack && <button className="chip !min-h-10 !px-3" onClick={onBack}>→ חזרה</button>}</div>
      <div className="text-center min-w-0"><div className="font-semibold truncate">{title}</div>{step && <div className="soft text-xs">{step}</div>}</div>
      <div className="w-20 flex justify-end">{exitTo && <button className="chip !min-h-10 !px-3" onClick={() => nav(exitTo, { replace: true })}>{exitLabel}</button>}</div>
    </header>
  );
}
