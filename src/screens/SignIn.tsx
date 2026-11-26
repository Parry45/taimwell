import { FormEvent, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Sticker } from '../components/ui';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setErr(null);
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) setErr(error.message);
    else setStep('code');
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setErr(null);
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) setErr(error.message.includes('expired') ? 'That code expired — send a new one.' : error.message);
  }

  return (
    <div className="page no-tab" style={{ justifyContent: 'center', gap: 22 }}>
      <div className="row">
        <Sticker emoji="⏳" color="#BFFB57" solid size={48} />
        <span className="heading">Taimwell</span>
      </div>
      <h1 className="display-xl">Give what matters your time.</h1>
      <p className="muted" style={{ margin: 0 }}>
        Two jobs, your businesses, the gigs — one honest view of your week.
      </p>
      {step === 'email' ? (
        <form className="col gap-12" onSubmit={sendCode}>
          <label className="field-label" htmlFor="email">
            Your email
          </label>
          <input
            id="email"
            className="input"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button className="btn primary block" disabled={busy || !email}>
            {busy ? 'Sending…' : 'Send me a code'}
          </button>
        </form>
      ) : (
        <form className="col gap-12" onSubmit={verify}>
          <label className="field-label" htmlFor="code">
            Enter the code we emailed to {email}
          </label>
          <input
            id="code"
            className="input big mono"
            style={{ fontSize: 28, letterSpacing: 8, textAlign: 'center' }}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={10}
            placeholder="••••••"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            required
          />
          <button className="btn primary block" disabled={busy || code.length < 6}>
            {busy ? 'Checking…' : 'Sign in'}
          </button>
          <button type="button" className="btn secondary block" onClick={() => setStep('email')}>
            Use a different email
          </button>
        </form>
      )}
      {err && <div className="notice">{err}</div>}
    </div>
  );
}
