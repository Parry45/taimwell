import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { finishGoogleConnect } from '../lib/google';
import { useToast } from '../components/ui';

export default function OAuthGoogle() {
  const nav = useNavigate();
  const toast = useToast();
  const [err, setErr] = useState<string | null>(null);
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    finishGoogleConnect()
      .then(({ account, returnTo }) => {
        toast(`📅 ${account} connected`);
        nav(returnTo || '/settings', { replace: true });
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)));
  }, [nav, toast]);
  return (
    <div className="page no-tab center" style={{ justifyContent: 'center' }}>
      {err ? (
        <>
          <div className="notice">{err}</div>
          <button className="btn primary" onClick={() => nav('/settings', { replace: true })}>
            Back to settings
          </button>
        </>
      ) : (
        <>
          <div className="spin" />
          <span className="muted small">Reading your calendars…</span>
        </>
      )}
    </div>
  );
}
