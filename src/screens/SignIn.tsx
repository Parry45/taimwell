import { FormEvent, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Sticker } from '../components/ui';

type Mode = 'signin' | 'signup' | 'link' | 'code';

// Email + password is the default because iPhone home-screen apps can't receive email links
// (links open in Safari, which keeps a separate login). Supabase free projects can't customise
// email templates, so the 6-digit code option only works once custom SMTP is set up.
export default function SignIn() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const friendly = (m: string) =>
    /invalid login/i.test(m)
      ? 'Email or password is wrong.'
      : /not confirmed/i.test(m)
        ? 'Confirm your email first — tap the link we sent, then come back and sign in.'
        : /rate limit/i.test(m)
          ? 'Too many emails just now (Supabase allows a few per hour). Try again shortly or use your password.'
          : m;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setErr(null);
    setInfo(null);
    const em = email.trim();
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: em, password });
        if (error) throw error;
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email: em, password, options: { emailRedirectTo: location.origin } });
        if (error) throw error;
        if (!data.session) {
          setInfo('Check your email and tap the confirmation link. Then come back here and sign in with your password.');
          setMode('signin');
        }
      } else if (mode === 'link') {
        const { error } = await supabase.auth.signInWithOtp({ email: em, options: { emailRedirectTo: location.origin, shouldCreateUser: true } });
        if (error) throw error;
        setInfo('Sign-in link sent. Open it on this device. (On iPhone it opens in Safari — use your password for the home-screen app.)');
      } else {
        const { error } = await supabase.auth.verifyOtp({ email: em, token: code.trim(), type: 'email' });
        if (error) throw error;
      }
    } catch (e2) {
      setErr(friendly(e2 instanceof Error ? e2.message : String(e2)));
    } finally {
      setBusy(false);
    }
  }

  const needsPw = mode === 'signin' || mode === 'signup';
  const cta = { signin: 'Sign in', signup: 'Create account', link: 'Email me a sign-in link', code: 'Sign in with code' }[mode];

  return (
    <div className="page no-tab" style={{ justifyContent: 'center', gap: 20 }}>
      <div className="row">
        <Sticker emoji="⏳" color="#BFFB57" solid size={48} />
        <span className="heading">Taimwell</span>
      </div>
      <h1 className="display-xl">Give what matters your time.</h1>
      <p className="muted" style={{ margin: 0 }}>
        Two jobs, your businesses, the gigs — one honest view of your week.
      </p>

      <div className="row gap-8">
        <button className={`pill ${mode === 'signin' ? 'on' : 'bg-surface'}`} onClick={() => setMode('signin')}>
          Sign in
        </button>
        <button className={`pill ${mode === 'signup' ? 'on' : 'bg-surface'}`} onClick={() => setMode('signup')}>
          New here
        </button>
      </div>

      <form className="col gap-12" onSubmit={submit}>
        <input className="input" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required aria-label="Email" />
        {needsPw && (
          <input
            className="input"
            type="password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            placeholder={mode === 'signup' ? 'Choose a password (8+ characters)' : 'Password'}
            minLength={mode === 'signup' ? 8 : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            aria-label="Password"
          />
        )}
        {mode === 'code' && (
          <input
            className="input big mono"
            style={{ fontSize: 26, letterSpacing: 8, textAlign: 'center' }}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="••••••"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            required
            aria-label="Code"
          />
        )}
        <button className="btn primary block" disabled={busy}>
          {busy ? 'One moment…' : cta}
        </button>
      </form>

      {info && <div className="panel bg-lime-soft small">{info}</div>}
      {err && <div className="notice">{err}</div>}

      <div className="row center gap-12 small">
        {mode !== 'link' && (
          <button className="c-mark" onClick={() => setMode('link')}>
            Email me a link instead
          </button>
        )}
        {mode !== 'code' && (
          <button className="muted" onClick={() => setMode('code')}>
            I have a code
          </button>
        )}
      </div>
    </div>
  );
}
