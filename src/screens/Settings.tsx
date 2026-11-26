import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { clearLocal, onSync, syncNow, uid } from '../lib/db';
import { saveSettings, useTaim } from '../lib/hooks';
import { isGoogleConfigured } from '../lib/config';
import { connectedAccounts, refreshCalendars, setCalendar, startGoogleConnect } from '../lib/google';
import type { Hat } from '../lib/types';
import { HAT_COLORS } from '../lib/types';
import { Back, Icon, Sheet, Sticker, useToast } from '../components/ui';
import HatEditor from '../components/HatEditor';
import ShortcutGuide from '../components/ShortcutGuide';

export default function SettingsScreen() {
  const t = useTaim();
  const nav = useNavigate();
  const toast = useToast();
  const [editing, setEditing] = useState<Hat | null>(null);
  const [guide, setGuide] = useState(false);
  const [email, setEmail] = useState('');
  const [sync, setSync] = useState('');
  const [name, setName] = useState(t.settings.name || '');

  useEffect(() => {
    supabase?.auth.getUser().then(({ data }) => setEmail(data.user?.email || ''));
    return onSync((i) =>
      setSync(i.state === 'syncing' ? 'Syncing…' : i.state === 'offline' ? 'Offline — changes are saved on this device' : i.state === 'error' ? `Sync problem: ${i.error}` : i.at ? `Synced ${i.at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Ready')
    );
  }, []);

  const accounts = [...new Set(t.calendars.map((c) => c.account))];
  const tokens = connectedAccounts();

  async function refresh() {
    try {
      const expired = await refreshCalendars();
      if (expired.length) startGoogleConnect({ hint: expired[0], returnTo: '/settings' });
      else toast('Calendars refreshed ✓');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not refresh');
    }
  }

  return (
    <div className="page no-tab">
      <Back label="Today" to="/" />
      <h1 className="display">Settings</h1>

      <div className="card">
        <span className="overline">You</span>
        <input
          className="input"
          placeholder="What should Taimwell call you?"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => saveSettings(t.settings, { name: name.trim() || undefined })}
        />
        <span className="small muted">{email}</span>
      </div>

      <div className="card">
        <div className="row between">
          <span className="overline">Hats</span>
          <button
            className="pill on"
            onClick={() => setEditing({ id: uid(), name: '', emoji: '✨', kind: 'other', budgetH: 4, order: t.hats.length, color: HAT_COLORS[t.hats.length % HAT_COLORS.length], people: [] })}
          >
            + Add
          </button>
        </div>
        {t.hats.map((h) => (
          <button key={h.id} className="row" style={{ textAlign: 'left' }} onClick={() => setEditing(h)}>
            <Sticker emoji={h.emoji} color={h.color} size={36} />
            <span className="fill strong">{h.name}</span>
            <span className="mono muted">{h.budgetH}h</span>
            <Icon name="chev" size={16} color="var(--text3)" />
          </button>
        ))}
      </div>

      <button className="card row" style={{ flexDirection: 'row', textAlign: 'left' }} onClick={() => nav('/welcome/week?from=settings')}>
        <span className="fill">
          <span className="overline">Your week</span>
          <br />
          <span className="strong">Job split, evenings, weekend, rest</span>
        </span>
        <Icon name="chev" size={16} color="var(--text3)" />
      </button>

      <div className="card">
        <div className="row between">
          <span className="overline">Calendars</span>
          {accounts.length > 0 && (
            <button className="pill" onClick={refresh}>
              ↻ Refresh
            </button>
          )}
        </div>
        {!isGoogleConfigured && <div className="notice">Google Calendar needs a Client ID (VITE_GOOGLE_CLIENT_ID). See the README.</div>}
        {accounts.map((acc) => (
          <div key={acc} className="col gap-8">
            <span className="small muted">
              {acc} {tokens.includes(acc) ? '' : '· sign in again to refresh'}
            </span>
            {t.calendars
              .filter((c) => c.account === acc)
              .map((c) => (
                <div key={c.id} className="row gap-8">
                  <input type="checkbox" checked={c.enabled} onChange={(e) => setCalendar({ ...c, enabled: e.target.checked })} aria-label={`Use ${c.summary}`} style={{ width: 20, height: 20, accentColor: 'var(--mark)' }} />
                  <span className="fill ellipsis">{c.summary}</span>
                  <select className="pill" value={c.hatId || ''} onChange={(e) => setCalendar({ ...c, hatId: e.target.value || null })} aria-label="Hat for this calendar">
                    <option value="">No hat</option>
                    {t.hats.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.emoji} {h.name}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
          </div>
        ))}
        {isGoogleConfigured && (
          <button className="btn secondary" onClick={() => startGoogleConnect({ returnTo: '/settings' })}>
            <Icon name="cal" size={18} /> {accounts.length ? 'Add another Google account' : 'Connect Google Calendar'}
          </button>
        )}
      </div>

      <button className="card row" style={{ flexDirection: 'row', textAlign: 'left' }} onClick={() => setGuide(true)}>
        <span className="sticker" style={{ width: 36, height: 36, background: 'rgba(37,211,102,.14)', fontSize: 18 }}>
          💬
        </span>
        <span className="fill strong">Capture from WhatsApp on iPhone</span>
        <Icon name="chev" size={16} color="var(--text3)" />
      </button>

      <div className="card">
        <span className="overline">Sync</span>
        <span className="small">{sync}</span>
        <div className="row gap-8">
          <button className="btn secondary fill" onClick={() => void syncNow()}>
            Sync now
          </button>
          <button
            className="btn danger fill"
            onClick={async () => {
              await syncNow();
              await supabase?.auth.signOut();
              await clearLocal();
              location.href = '/';
            }}
          >
            Sign out
          </button>
        </div>
      </div>
      <span className="small faint" style={{ textAlign: 'center' }}>
        Taimwell 0.1 · Give what matters your time.
      </span>

      <HatEditor hat={editing} onClose={() => setEditing(null)} canDelete={t.hats.length > 1} />
      <Sheet open={guide} onClose={() => setGuide(false)}>
        <ShortcutGuide />
      </Sheet>
    </div>
  );
}
