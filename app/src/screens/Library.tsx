import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import FaceMap from '../components/FaceMap';
import Evidence from '../components/Evidence';
import TopBar from '../components/TopBar';
import { EXERCISES, EX, PHASE_HE, ZONE_HE } from '../content/exercises';
import { QUICK } from '../content/plan';
import { loadManifest, mediaFor, contentUrl, type Manifest } from '../content/manifest';
import { loadState, type UserState } from '../lib/state';
import { unlockIntroAudio } from '../components/Intro';
import type { Zone } from '../db';

export default function Library() {
  const { id } = useParams();
  const nav = useNavigate();
  const [m, setM] = useState<Manifest | null>(null);
  const [s, setS] = useState<UserState | null>(null);
  const [zone, setZone] = useState<Zone | null>(null);
  useEffect(() => { loadManifest().then(setM); loadState().then(setS); }, []);
  if (!m || !s) return null;

  if (id && EX[id]) {
    const e = EX[id]!; const med = mediaFor(m, id); const blocked = s.filter.excluded.has(id);
    return (
      <section className="flex flex-col gap-4 pb-4">
        <TopBar title={e.nameHe} exitTo="/library" exitLabel="לספרייה" />
        <div className="relative -mx-4 aspect-[4/5] overflow-hidden bg-[var(--bg-tint)]">
          {med.clip ? <video src={contentUrl(med.clip)} autoPlay loop muted playsInline className="w-full h-full object-cover object-[50%_25%]" /> : <img src={contentUrl(med.still ?? m.character.front)} alt="" className="w-full h-full object-cover object-[50%_25%]" />}
        </div>
        <div className="flex items-center gap-2 flex-wrap"><span className="chip !min-h-8 !text-sm">{PHASE_HE[e.phase]}</span>{e.zones.map(z => <span key={z} className="chip !min-h-8 !text-sm">{ZONE_HE[z]}</span>)}<Evidence level={e.evidence} /></div>
        <p className="soft">{e.muscle}</p>
        <ol className="flex flex-col gap-2">{e.steps.map((x, i) => <li key={i} className="flex gap-3"><span className="w-7 h-7 shrink-0 rounded-full grid place-items-center text-sm" style={{ background: 'var(--bg-tint)' }}>{i + 1}</span><span>{x}</span></li>)}</ol>
        <div className="card-tint p-4"><div className="font-semibold text-sm">מה סביר לצפות</div><p className="mt-1">{e.expect}</p></div>
        {blocked ? <div className="card p-4 soft">התרגיל הזה לא מתאים לך כרגע לפי הסינון או הטיפולים שסימנת.</div>
          : <button className="btn-primary" onClick={() => nav(`/session/single?ex=${id}`)}>תרגיל אחד עכשיו</button>}
      </section>
    );
  }

  const list = EXERCISES.filter(e => !zone || e.zones.includes(zone));
  return (
    <section className="flex flex-col gap-5">
      <header className="pt-2 rise"><div className="eyebrow">{EXERCISES.length} תרגילים</div><h1 className="text-[1.9rem]">הספרייה</h1></header>
      <div className="grid grid-cols-2 gap-3">{Object.entries(QUICK).map(([k, q]) => <button key={k} className="card p-4 text-start" onClick={() => nav(`/session/${k}`)}><div className="font-semibold">{q.nameHe}</div><div className="soft text-sm">{q.sub}</div></button>)}</div>
      <div className="card p-4 flex flex-col items-center gap-2">
        <div className="soft text-sm">לחצי על אזור כדי לסנן</div>
        <FaceMap selected={zone ? [zone] : []} onToggle={z => setZone(c => (c === z ? null : z))} size={190} />
        {zone && <button className="chip !min-h-9 !text-sm" onClick={() => setZone(null)}>כל האזורים</button>}
      </div>
      <ul className="flex flex-col gap-2">
        {list.map(e => {
          const med = mediaFor(m, e.id); const blocked = s.filter.excluded.has(e.id);
          return (
            <li key={e.id}>
              <button className="card w-full p-3 flex items-center gap-3 text-start" onClick={() => nav(`/library/${e.id}`)} style={{ opacity: blocked ? 0.5 : 1 }}>
                <span className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 bg-[var(--bg-tint)]">{med.still ? <img src={contentUrl(med.still)} alt="" className="w-full h-full object-cover object-top" loading="lazy" /> : <span className="w-full h-full grid place-items-center soft">{PHASE_HE[e.phase].slice(0, 1)}</span>}</span>
                <span className="flex-1 min-w-0"><span className="font-semibold block">{e.nameHe}{med.clip ? ' ▸' : ''}</span><span className="soft text-sm block truncate">{PHASE_HE[e.phase]} · {e.zones.map(z => ZONE_HE[z]).join(', ') || 'כללי'}</span></span>
                <Evidence level={e.evidence} compact />
              </button>
            </li>
          );
        })}
      </ul>
      <button className="btn-secondary" onClick={() => { unlockIntroAudio(); nav('/intro'); }}>ההקדמה: מה זה יוגה לפנים ואיך זה עובד</button>
      <button className="btn-secondary" onClick={() => nav('/science')}>מה המדע אומר על יוגה לפנים</button>
    </section>
  );
}
