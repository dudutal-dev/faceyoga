import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/TopBar';
import FaceMap from '../components/FaceMap';
import { getProfile, saveProfile, getSettings, saveSettings, applyDisplaySettings, exportAll, importAll, deletePhotos, resetAll, todayISO, addDaysISO, type Profile, type Settings as S, type Zone, type Treatment } from '../db';
import { SCREENING } from '../lib/adapt';
import { ZONE_HE } from '../content/exercises';
import { BUILD } from '../pwa';
import { contentUrl } from '../content/manifest';

const DAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
export default function Settings() {
  const nav = useNavigate();
  const [p, setP] = useState<Profile | null>(null);
  const [s, setS] = useState<S | null>(null);
  const [tz, setTz] = useState<Zone[]>([]); const [td, setTd] = useState(todayISO()); const [tt, setTt] = useState<Treatment['type']>('botox');
  useEffect(() => { getProfile().then(setP); getSettings().then(setS); }, []);
  if (!p || !s) return null;
  const up = async (x: Partial<Profile>) => { const n = { ...p, ...x }; setP(n); await saveProfile(n); };
  const us = async (x: Partial<S>) => { const n = { ...s, ...x }; setS(n); await saveSettings(n); applyDisplaySettings(n); };
  async function addTreatment() { if (!tz.length) return; await up({ treatments: [...p!.treatments, { id: String(Date.now()), type: tt, zones: tz, date: td, until: addDaysISO(td, tt === 'botox' ? 42 : 28) }] }); setTz([]); }
  async function doExport() { const blob = new Blob([await exportAll()], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `faceyoga-${todayISO()}.json`; a.click(); }
  async function doImport(f: File) { await importAll(await f.text()); location.reload(); }
  const Toggle = ({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) => <button className="chip w-full !justify-between" aria-pressed={on} onClick={onClick}><span>{label}</span><span className="soft text-sm">{on ? 'פועל' : 'כבוי'}</span></button>;

  return (
    <section className="flex flex-col gap-6 pb-8">
      <TopBar title="הגדרות" />
      <Group title="תרגול">
        <div className="flex gap-2">{(['full', 'light', 'aftercare'] as const).map(t => <button key={t} className="chip flex-1 justify-center" aria-pressed={p.track === t} onClick={() => up({ track: t })}>{t === 'full' ? 'מלא' : t === 'light' ? 'קליל' : 'אחרי טיפול'}</button>)}</div>
        <div className="flex gap-1.5 justify-between">{DAYS.map((d, n) => <button key={n} className="chip !px-0 w-11 justify-center" aria-pressed={p.practiceDays.includes(n)} onClick={() => up({ practiceDays: p.practiceDays.includes(n) ? p.practiceDays.filter(x => x !== n) : [...p.practiceDays, n].sort() })}>{d}</button>)}</div>
        <label className="flex items-center justify-between">שעת תזכורת <input type="time" value={p.reminderTime} onChange={e => up({ reminderTime: e.target.value })} /></label>
        <Toggle on={p.hasGuaSha} label="יש לי אבן גואשה" onClick={() => up({ hasGuaSha: !p.hasGuaSha })} />
      </Group>
      <Group title="מראה, מאמנת וקול">
        <Toggle on={s.mirror} label="מראה (מצלמה קדמית) בנגן" onClick={() => us({ mirror: !s.mirror })} />
        <Toggle on={s.coach} label="מאמנת פנים: ספירה והתרעת קימוט" onClick={() => us({ coach: !s.coach })} />
        <Toggle on={s.music === 'on'} label="מוזיקת רקע" onClick={() => us({ music: s.music === 'on' ? 'off' : 'on' })} />
        {s.music === 'on' && <label className="flex flex-col text-sm">עוצמת מוזיקה<input type="range" min={0.1} max={1} step={0.05} value={s.musicVolume} onChange={e => us({ musicVolume: +e.target.value })} /></label>}
        <p className="soft text-xs">המצלמה מעובדת בטלפון בלבד. אין הקלטה, אין שליחה.</p>
      </Group>
      <Group title="טיפולים">
        {p.treatments.filter(t => t.until >= todayISO()).map(t => <div key={t.id} className="flex items-center justify-between card-tint px-4 py-3 rounded-2xl text-sm"><span>{t.type === 'botox' ? 'בוטוקס' : t.type === 'filler' ? 'מילוי' : t.type === 'threads' ? 'חוטים' : 'ניתוח'}: {t.zones.map(z => ZONE_HE[z]).join(', ')} · עד {t.until}</span><button className="soft" onClick={() => up({ treatments: p.treatments.filter(x => x.id !== t.id) })}>הסרה</button></div>)}
        <div className="flex gap-2 flex-wrap">{(['botox', 'filler', 'threads'] as const).map(t => <button key={t} className="chip" aria-pressed={tt === t} onClick={() => setTt(t)}>{t === 'botox' ? 'בוטוקס' : t === 'filler' ? 'מילוי' : 'חוטים'}</button>)}</div>
        <div className="flex justify-center"><FaceMap selected={tz} onToggle={z => setTz(x => x.includes(z) ? x.filter(y => y !== z) : [...x, z])} size={170} /></div>
        <label className="flex items-center justify-between">תאריך <input type="date" value={td} max={todayISO()} onChange={e => setTd(e.target.value)} /></label>
        <button className="btn-secondary" onClick={addTreatment} disabled={!tz.length}>הוספת טיפול</button>
      </Group>
      <Group title="בטיחות">
        {SCREENING.map(q => <button key={q.key} className="chip w-full !justify-between !text-start !rounded-2xl !py-2" aria-pressed={!!p.screening[q.key]} onClick={() => up({ screening: { ...p.screening, [q.key]: !p.screening[q.key] } })}><span className="text-sm">{q.text}</span><span className="soft text-sm">{p.screening[q.key] ? 'כן' : 'לא'}</span></button>)}
      </Group>
      <Group title="תצוגה">
        <div className="flex gap-2">{(['normal', 'large', 'xl'] as const).map(f => <button key={f} className="chip flex-1 justify-center" aria-pressed={s.fontScale === f} onClick={() => us({ fontScale: f })}>{f === 'normal' ? 'א' : f === 'large' ? 'א+' : 'א++'}</button>)}</div>
        <div className="flex gap-2">{(['auto', 'light', 'dark'] as const).map(d => <button key={d} className="chip flex-1 justify-center" aria-pressed={s.darkMode === d} onClick={() => us({ darkMode: d })}>{d === 'auto' ? 'אוטומטי' : d === 'light' ? 'בהיר' : 'כהה'}</button>)}</div>
      </Group>
      <Group title="נתונים">
        <button className="btn-secondary" onClick={() => nav('/download')}>הורדת התוכן לשימוש בלי רשת</button>
        <button className="btn-secondary" onClick={doExport}>גיבוי לקובץ (בלי תמונות)</button>
        <label className="btn-secondary cursor-pointer">שחזור מגיבוי<input type="file" accept="application/json" className="hidden" onChange={e => e.target.files?.[0] && doImport(e.target.files[0])} /></label>
        <button className="btn-secondary" onClick={async () => { if (confirm('למחוק את כל הצילומים מהטלפון?')) await deletePhotos(); }}>מחיקת כל הצילומים</button>
        <button className="btn-stop w-full" onClick={async () => { if (confirm('למחוק את כל הנתונים ולהתחיל מחדש?')) { await resetAll(); nav('/onboarding', { replace: true }); } }}>מחיקת הכול</button>
      </Group>
      <Group title="אודות">
        <div className="card overflow-hidden">
          <div className="grad-teal px-5 py-4 flex items-center gap-3">
            <img src={contentUrl('icons/icon-192.png')} alt="" className="w-12 h-12 rounded-2xl ring-1 ring-white/30" />
            <div><div className="display text-xl leading-tight">פָּנִים 12</div><div className="text-white/80 text-sm">יוגה לפנים בעברית</div></div>
          </div>
          <div className="p-5 flex flex-col gap-2 text-sm">
            <p>תוכנית של 12 שבועות עם מדריכה בווידאו, קריינות בעברית, מראה ומאמנת פנים שפועלת בתוך הטלפון.</p>
            <p className="soft">בלי שרת, בלי חשבון ובלי מעקב. כל הנתונים והצילומים נשמרים רק במכשיר שלך.</p>
            <div className="h-px bg-[var(--line)] my-1" />
            <div className="flex justify-between"><span className="soft">פיתוח</span><span className="font-semibold">דודו טל</span></div>
            <div className="flex justify-between"><span className="soft">גרסה</span><span className="tabular-nums">{BUILD}</span></div>
            <p className="soft text-xs mt-1">זו לא אפליקציה רפואית, והיא לא מחליפה ייעוץ רפואי או דרמטולוגי.</p>
          </div>
        </div>
      </Group>
    </section>
  );
}
function Group({ title, children }: { title: string; children: React.ReactNode }) { return <div className="flex flex-col gap-3"><div className="eyebrow">{title}</div>{children}</div>; }
