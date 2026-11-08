import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { planDownload, downloadAll, cachedCount, formatMB, type DownloadPlan } from '../lib/offline';
import TopBar from '../components/TopBar';
export default function Download() {
  const nav = useNavigate();
  const [plan, setPlan] = useState<DownloadPlan | null>(null);
  const [have, setHave] = useState(0);
  const [prog, setProg] = useState<{ done: number; total: number; failed: number } | null>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => { planDownload().then(async p => { setPlan(p); setHave(await cachedCount(p.urls)); }); }, []);
  async function start() { if (!plan) return; abort.current = new AbortController(); setProg({ done: 0, total: plan.urls.length, failed: 0 }); await downloadAll(plan.urls, (done, total, failed) => setProg({ done, total, failed }), abort.current.signal); setHave(await cachedCount(plan.urls)); }
  const pct = prog ? Math.round((prog.done / prog.total) * 100) : plan ? Math.round((have / Math.max(1, plan.urls.length)) * 100) : 0;
  return (
    <section className="flex flex-col gap-5 pb-6 min-h-[70dvh]">
      <TopBar title="תוכן בלי רשת" exitTo="/settings" />
      <h1 className="text-[1.8rem]">הכול עובד גם בלי אינטרנט</h1>
      <p className="soft">וידאו, קריינות, מוזיקה ומודל הפנים נשמרים בטלפון.</p>
      {plan && <p className="soft text-sm">{plan.urls.length} קבצים, כ-{formatMB(plan.bytes)}. כבר בטלפון: {have}.</p>}
      <div className="card p-5"><div className="h-3 rounded-full bg-[var(--ring-track)] overflow-hidden"><div className="h-full bg-[var(--accent)] transition-[width] duration-500" style={{ width: `${pct}%` }} /></div><div className="mt-2 flex justify-between soft text-sm"><span>{pct}%</span>{prog && <span>{prog.done}/{prog.total}{prog.failed ? ` · ${prog.failed} נכשלו` : ''}</span>}</div></div>
      {!prog || prog.done === prog.total ? <button className="btn-primary mt-auto" onClick={start} disabled={!plan}>{plan && have >= plan.urls.length ? 'הכול כבר בטלפון' : 'הורדה עכשיו'}</button> : <button className="btn-stop w-full mt-auto" onClick={() => abort.current?.abort()}>עצירה</button>}
      <button className="btn-secondary" onClick={() => nav('/')}>אחר כך</button>
    </section>
  );
}
