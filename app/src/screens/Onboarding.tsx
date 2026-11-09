// פתיחה מודרכת: הבטחה כנה → סינון בטיחות → מסלול → ימים ושעה → טיפולים → צילום שבוע 0.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/TopBar';
import FaceMap from '../components/FaceMap';
import { saveProfile, blankProfile, todayISO, addDaysISO, type Profile, type Track, type Zone, type Treatment } from '../db';
import { SCREENING, stopKeys } from '../lib/adapt';
import { requestReminderPermission, scheduleReminderCheck } from '../lib/reminders';
import { Welcome, IntroStories } from '../components/Intro';

const DAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const STEPS = ['welcome', 'intro', 'screen', 'track', 'treat', 'days', 'done'] as const;

export default function Onboarding() {
  const nav = useNavigate();
  const [i, setI] = useState(0);
  const [p, setP] = useState<Profile>(blankProfile());
  const [botoxZones, setBotoxZones] = useState<Zone[]>([]);
  const [botoxDate, setBotoxDate] = useState('');
  const [filler, setFiller] = useState(false);
  const step = STEPS[i]!;
  const next = () => setI(n => Math.min(STEPS.length - 1, n + 1));
  const back = i > 0 ? () => setI(n => n - 1) : undefined;
  const stops = stopKeys(p.screening);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [i]);

  async function finish(photo: boolean) {
    const treatments: Treatment[] = [];
    if (botoxZones.length && botoxDate) treatments.push({ id: 'b1', type: 'botox', zones: botoxZones, date: botoxDate, until: addDaysISO(botoxDate, 42) });
    if (filler) treatments.push({ id: 'f1', type: 'filler', zones: ['cheeks', 'lips', 'jaw'], date: todayISO(), until: addDaysISO(todayISO(), 28) });
    await saveProfile({ ...p, treatments, startDate: todayISO(), onboarded: true, eyesAcknowledged: !p.screening.eyelid });
    if (await requestReminderPermission()) scheduleReminderCheck();
    nav(photo ? '/photo/0?first=1' : '/', { replace: true });
  }

  return (
    <section className="flex flex-col gap-5 min-h-[92dvh] pb-6">
      {step !== 'welcome' && step !== 'intro' && <TopBar title="היכרות" onBack={back} step={`${i - 1} מתוך ${STEPS.length - 2}`} exitTo={null} />}

      {step === 'welcome' && <Welcome onIntro={next} onSkip={() => setI(2)} />}
      {step === 'intro' && <IntroStories onDone={next} doneLabel="מתחילות בהרשמה" />}

      {step === 'screen' && (
        <div className="flex flex-col gap-4 rise">
          <h1 className="text-3xl">כמה שאלות בטיחות</h1>
          <p className="soft">סמני מה שנכון לגבייך. התוכנית תותאם בהתאם.</p>
          <div className="flex flex-col gap-2">
            {SCREENING.map(q => (
              <button key={q.key} className="chip !justify-between !text-start !min-h-14 !rounded-2xl !py-2" aria-pressed={!!p.screening[q.key]} onClick={() => setP({ ...p, screening: { ...p.screening, [q.key]: !p.screening[q.key] } })}>
                <span>{q.text}</span><span className="text-sm soft shrink-0">{p.screening[q.key] ? 'כן' : 'לא'}</span>
              </button>
            ))}
          </div>
          {SCREENING.filter(q => p.screening[q.key]).map(q => (
            <div key={q.key} className={`rounded-2xl p-4 text-sm ${q.stop ? 'bg-[var(--color-stop)]/10 border border-[var(--color-stop)]/40' : 'card-tint'}`}>{q.detail}</div>
          ))}
          {stops.includes('palsy')
            ? <p className="font-semibold">במצב הזה אנחנו לא ממליצות להתחיל לבד. כדאי להתייעץ עם פיזיותרפיסטית, ואפשר לחזור לכאן אחר כך.</p>
            : <button className="btn-primary mt-auto" onClick={next}>{stops.includes('eyelid') ? 'הבנתי. ממשיכות בלי תרגילי עיניים' : 'ממשיכות'}</button>}
        </div>
      )}

      {step === 'track' && (
        <div className="flex flex-col gap-4 rise">
          <h1 className="text-3xl">איזה קצב מתאים לך?</h1>
          {([['full', 'מלא', '3–4 מפגשים של 12–18 דקות בשבוע, ועוד בוקר קצר כשבא לך'], ['light', 'קליל', 'רוטינת בוקר של 4 דקות, ועוד 2 מפגשים קצרים בשבוע'], ['aftercare', 'אחרי טיפול', 'כמו המלא, ומדלג אוטומטית על אזורים שטופלו']] as [Track, string, string][]).map(([k, t, d]) => (
            <button key={k} className="card p-5 text-start flex flex-col gap-1 transition-colors" style={{ borderColor: p.track === k ? 'var(--accent)' : undefined, borderWidth: p.track === k ? 2 : 1 }} onClick={() => setP({ ...p, track: k })}>
              <span className="text-xl font-semibold">{t}</span><span className="soft">{d}</span>
            </button>
          ))}
          <button className="chip !justify-between" aria-pressed={p.hasGuaSha} onClick={() => setP({ ...p, hasGuaSha: !p.hasGuaSha })}><span>יש לי אבן גואשה (לא חובה)</span><span>{p.hasGuaSha ? 'כן' : 'לא'}</span></button>
          <button className="btn-primary mt-auto" onClick={next}>ממשיכות</button>
        </div>
      )}

      {step === 'treat' && (
        <div className="flex flex-col gap-4 rise">
          <h1 className="text-3xl">טיפולים אחרונים</h1>
          <p className="soft">בוטוקס בשישה השבועות האחרונים? סמני את האזורים, ונדלג עליהם עד שישה שבועות אחרי התאריך. אין טיפולים? אפשר פשוט להמשיך.</p>
          <div className="flex justify-center"><FaceMap selected={botoxZones} onToggle={z => setBotoxZones(s => s.includes(z) ? s.filter(x => x !== z) : [...s, z])} /></div>
          {botoxZones.length > 0 && <label className="flex items-center justify-between gap-3">תאריך הטיפול <input type="date" value={botoxDate} max={todayISO()} onChange={e => setBotoxDate(e.target.value)} /></label>}
          <button className="chip !justify-between" aria-pressed={filler} onClick={() => setFiller(v => !v)}><span>מילוי, חוטים או ניתוח בחודש האחרון</span><span>{filler ? 'כן' : 'לא'}</span></button>
          <button className="btn-primary mt-auto" onClick={next} disabled={botoxZones.length > 0 && !botoxDate}>ממשיכות</button>
        </div>
      )}

      {step === 'days' && (
        <div className="flex flex-col gap-4 rise">
          <h1 className="text-3xl">מתי נוח לך?</h1>
          <p className="soft">בחרי ימים. עם ימי מנוחה ביניהם עדיף, כמו באימון כוח.</p>
          <div className="flex gap-2 justify-between">{DAYS.map((d, n) => <button key={n} className="chip !px-0 w-11 justify-center" aria-pressed={p.practiceDays.includes(n)} onClick={() => setP({ ...p, practiceDays: p.practiceDays.includes(n) ? p.practiceDays.filter(x => x !== n) : [...p.practiceDays, n].sort() })}>{d}</button>)}</div>
          <label className="flex items-center justify-between gap-3">שעת תזכורת <input type="time" value={p.reminderTime} onChange={e => setP({ ...p, reminderTime: e.target.value })} /></label>
          <label className="flex items-center justify-between gap-3">איך לקרוא לך? <input type="text" value={p.name} placeholder="לא חובה" onChange={e => setP({ ...p, name: e.target.value })} className="w-40" /></label>
          <button className="btn-primary mt-auto" onClick={next} disabled={p.practiceDays.length < 2}>ממשיכות</button>
        </div>
      )}

      {step === 'done' && (
        <div className="flex flex-col gap-4 rise">
          <h1 className="text-3xl">עוד דבר אחד: צילום התחלה</h1>
          <p className="soft text-lg">שתי תמונות, חזית ופרופיל. נצלם שוב בשבוע 6 ובשבוע 12, באותה זווית ובאותו מרחק, כדי שההשוואה תהיה הוגנת.</p>
          <div className="card-tint p-4 text-sm">התמונות נשמרות רק בטלפון. הן לא נשלחות לשום מקום, ואפשר למחוק אותן בכל רגע.</div>
          <button className="btn-primary mt-auto" onClick={() => finish(true)}>לצילום</button>
          <button className="btn-secondary" onClick={() => finish(false)}>אחר כך</button>
        </div>
      )}
    </section>
  );
}

