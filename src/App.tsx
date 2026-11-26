import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { isSupabaseConfigured } from './lib/config';
import { startSyncLoop, syncNow } from './lib/db';
import { useTaim } from './lib/hooks';
import { ToastProvider } from './components/ui';
import SignIn from './screens/SignIn';
import { WelcomeHats, WelcomeSources, WelcomeWeek } from './screens/Onboarding';
import Today from './screens/Today';
import Capture from './screens/Capture';
import Inbox from './screens/Inbox';
import Focus from './screens/Focus';
import Done from './screens/Done';
import Week from './screens/Week';
import Resolve from './screens/Resolve';
import AtRisk from './screens/AtRisk';
import Review from './screens/Review';
import Timeline from './screens/Timeline';
import SettingsScreen from './screens/Settings';
import OAuthGoogle from './screens/OAuthGoogle';

function Loading({ label = 'Putting your day in order…' }: { label?: string }) {
  return (
    <div className="page no-tab center" style={{ justifyContent: 'center' }}>
      <div className="spin" />
      <div className="muted small">{label}</div>
    </div>
  );
}

function Shell() {
  const t = useTaim();
  const loc = useLocation();
  if (!t.ready) return <Loading />;
  const inWelcome = loc.pathname.startsWith('/welcome') || loc.pathname.startsWith('/oauth');
  if (!t.settings.onboarded && !inWelcome) return <Navigate to="/welcome/hats" replace />;
  return (
    <Routes>
      <Route path="/" element={<Today />} />
      <Route path="/welcome/hats" element={<WelcomeHats />} />
      <Route path="/welcome/week" element={<WelcomeWeek />} />
      <Route path="/welcome/sources" element={<WelcomeSources />} />
      <Route path="/capture" element={<Capture />} />
      <Route path="/inbox" element={<Inbox />} />
      <Route path="/focus/:id" element={<Focus />} />
      <Route path="/done/:id" element={<Done />} />
      <Route path="/week" element={<Week />} />
      <Route path="/week/resolve" element={<Resolve />} />
      <Route path="/risk/:id" element={<AtRisk />} />
      <Route path="/review" element={<Review />} />
      <Route path="/timeline" element={<Timeline />} />
      <Route path="/settings" element={<SettingsScreen />} />
      <Route path="/oauth/google" element={<OAuthGoogle />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) return;
    startSyncLoop();
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        setSynced(true);
      }
    };
    const t = setTimeout(finish, 6000); // never block the app on a slow network
    void syncNow().finally(() => {
      clearTimeout(t);
      finish();
    });
  }, [userId]);

  if (!isSupabaseConfigured) {
    return (
      <div className="page no-tab">
        <h1 className="display">Taimwell needs its Supabase keys</h1>
        <p className="muted">Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see README).</p>
      </div>
    );
  }
  return (
    <ToastProvider>
      <div className="app">
        {session === undefined ? <Loading /> : !session ? <SignIn /> : !synced ? <Loading label="Syncing your promises…" /> : <Shell />}
      </div>
    </ToastProvider>
  );
}
