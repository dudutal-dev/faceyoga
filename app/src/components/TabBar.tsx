import { NavLink } from 'react-router-dom';
const I = (d: React.ReactNode) => (a: boolean) => <svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" strokeWidth={a ? 2.1 : 1.6} strokeLinecap="round" strokeLinejoin="round">{d}</svg>;
const ICONS: Record<string, (a: boolean) => React.ReactNode> = {
  today: I(<><circle cx="12" cy="12" r="8.5" /><path d="M8.8 14.2c.8 1 1.9 1.6 3.2 1.6s2.4-.6 3.2-1.6M9.3 10h.01M14.7 10h.01" /></>),
  plan: I(<><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M8 3v4M16 3v4M4 10h16M8.5 14h2M13.5 14h2M8.5 17h2" /></>),
  journal: I(<><rect x="4" y="4" width="16" height="16" rx="3" /><circle cx="12" cy="11" r="3" /><path d="M7.5 18c1-2 2.6-3 4.5-3s3.5 1 4.5 3" /></>),
  library: I(<><path d="M12 3.5c-3.6 0-6 2.8-6 6.4 0 3.3 1.7 6.4 3.3 8.1.8.9 1.7 1.5 2.7 1.5s1.9-.6 2.7-1.5c1.6-1.7 3.3-4.8 3.3-8.1 0-3.6-2.4-6.4-6-6.4z" /><path d="M9.5 15c.7.6 1.5.9 2.5.9s1.8-.3 2.5-.9" /></>),
};
const TABS = [{ to: '/', id: 'today', label: 'היום' }, { to: '/plan', id: 'plan', label: 'תוכנית' }, { to: '/journal', id: 'journal', label: 'יומן' }, { to: '/library', id: 'library', label: 'ספרייה' }];
export default function TabBar() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 border-t border-[var(--line)] bg-[var(--bg-elev)]/92 backdrop-blur-xl" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} aria-label="ניווט ראשי">
      <ul className="flex max-w-[520px] mx-auto">
        {TABS.map(t => (
          <li key={t.to} className="flex-1">
            <NavLink to={t.to} end={t.to === '/'} className={({ isActive }) => `flex flex-col items-center justify-center gap-0.5 min-h-[66px] text-[0.82rem] font-medium transition-colors ${isActive ? 'text-[var(--accent)]' : 'text-[var(--fg-soft)]'}`}>
              {({ isActive }) => <><span className={`grid place-items-center w-14 h-8 rounded-full transition-colors ${isActive ? 'bg-[var(--accent)]/12' : ''}`}>{ICONS[t.id]!(isActive)}</span><span>{t.label}</span></>}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
