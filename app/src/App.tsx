import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Today from './screens/Today';
import Player from './screens/Player';
import Finish from './screens/Finish';
import Onboarding from './screens/Onboarding';
import Plan from './screens/Plan';
import Journal from './screens/Journal';
import Photo from './screens/Photo';
import Library from './screens/Library';
import Science from './screens/Science';
import Settings from './screens/Settings';
import Download from './screens/Download';
import { IntroStories } from './components/Intro';
import { useNavigate } from 'react-router-dom';
import UpdateBanner from './components/UpdateBanner';
import TabBar from './components/TabBar';
import { getProfile, getSettings, applyDisplaySettings } from './db';
import { scheduleReminderCheck } from './lib/reminders';

export default function App() {
  const loc = useLocation();
  const [ready, setReady] = useState<null | boolean>(null);
  const [checked, setChecked] = useState(''); // הנתיב שעבורו נבדק הפרופיל (מונע הפניה לפתיחה לפני שהפרופיל החדש נקרא)
  const immersive = /^\/(session|onboarding|photo|intro)/.test(loc.pathname);
  // מעבר בין מסכים מתחיל תמיד מראש המסך
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior }); }, [loc.pathname]);
  useEffect(() => {
    (async () => {
      const p = await getProfile();
      applyDisplaySettings(await getSettings());
      setReady(!!p?.onboarded); setChecked(loc.pathname);
      if (p?.onboarded && 'Notification' in window && Notification.permission === 'granted') scheduleReminderCheck();
    })();
  }, [loc.pathname]);
  if (ready === null || (!ready && checked !== loc.pathname)) return <div className="min-h-dvh grid place-items-center soft">רגע…</div>;
  if (!ready && !/^\/(onboarding|photo)/.test(loc.pathname)) return <Navigate to="/onboarding" replace />;
  return (
    <div className="min-h-dvh flex flex-col">
      <UpdateBanner />
      <main className={loc.pathname.startsWith('/session') ? 'flex-1' : 'flex-1 w-full max-w-[520px] mx-auto px-4 pb-28 pt-3'}>
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/session/:kind" element={<Player />} />
          <Route path="/finish" element={<Finish />} />
          <Route path="/plan" element={<Plan />} />
          <Route path="/journal" element={<Journal />} />
          <Route path="/photo/:week" element={<Photo />} />
          <Route path="/library" element={<Library />} />
          <Route path="/library/:id" element={<Library />} />
          <Route path="/science" element={<Science />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/download" element={<Download />} />
          <Route path="/intro" element={<IntroRoute />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!immersive && <TabBar />}
    </div>
  );
}

function IntroRoute() { const nav = useNavigate(); return <IntroStories onDone={() => nav('/library', { replace: true })} doneLabel="לספרייה" />; }
