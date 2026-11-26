import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { putMany, uid, put } from '../lib/db';
import { saveSettings, useTaim } from '../lib/hooks';
import type { Hat } from '../lib/types';
import { HAT_COLORS } from '../lib/types';
import { isGoogleConfigured } from '../lib/config';
import { startGoogleConnect } from '../lib/google';
import { Bar, HatChip, Icon, Sheet, Steps, Sticker } from '../components/ui';
import HatEditor, { Stepper } from '../components/HatEditor';
import ShortcutGuide from '../components/ShortcutGuide';

const DEFAULT_HATS: Omit<Hat, 'id' | 'order' | 'color'>[] = [
  { name: 'Job 1 · Lead', emoji: '💼', kind: 'job', budgetH: 24 },
  { name: 'Job 2', emoji: '🧾', kind: 'job', budgetH: 16 },
  { name: 'Studio', emoji: '🎨', kind: 'business', budgetH: 8 },
  { name: 'Store', emoji: '🛍️', kind: 'business', budgetH: 5 },
  { name: 'Gigs', emoji: '⚡', kind: 'gig', budgetH: 4 }
];

function Brand() {
  return (
    <div className="row gap-8">
      <Sticker emoji="⏳" color="#BFFB57" solid size={28} />
      <span className="heading">Taimwell</span>
      <span className="small faint">· Give what matters your time.</span>
    </div>
  );
}

export function WelcomeHats() {
  const t = useTaim();
  const nav = useNavigate();
  const seeded = useRef(false);
  const [editing, setEditing] = useState<Hat | null>(null);

  useEffect(() => {
    if (!t.ready || seeded.current || t.hats.length) return;
    seeded.current = true;
    void putMany(
      'hat',
      DEFAULT_HATS.map((h, i) => ({ ...h, id: uid(), order: i, color: HAT_COLORS[i % HAT_COLORS.length], people: [] }))
    );
  }, [t.ready, t.hats.length]);

  const total = t.hats.reduce((a, h) => a + h.budgetH, 0);
  return (
    <div className="page no-tab">
      <Brand />
      <Steps n={1} />
      <h1 className="display">Which hats do you wear? 🎩</h1>
      <div className="col gap-8">
        {t.hats.map((h) => (
          <button key={h.id} className="card tight row" style={{ flexDirection: 'row', textAlign: 'left' }} onClick={() => setEditing(h)}>
            <Sticker emoji={h.emoji} color={h.color} />
            <span className="strong fill">{h.name}</span>
            <span className="pill mono">{h.budgetH}h</span>
          </button>
        ))}
        <button
          className="row center"
          style={{ border: '1.5px dashed var(--text3)', borderRadius: 22, padding: 14, color: 'var(--text2)' }}
          onClick={() =>
            setEditing({ id: uid(), name: '', emoji: '✨', kind: 'other', budgetH: 4, order: t.hats.length, color: HAT_COLORS[t.hats.length % HAT_COLORS.length], people: [] })
          }
        >
          <Icon name="plus" size={18} /> <span className="strong">Add a hat</span>
        </button>
      </div>
      <div className="panel bg-lime-soft row between">
        <span className="strong">Total</span>
        <span className="mono">{total}h / week</span>
      </div>
      <div className="grow" />
      <button className="btn primary block" disabled={!t.hats.length} onClick={() => nav('/welcome/week')}>
        Next
      </button>
      <HatEditor hat={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

export function WelcomeWeek() {
  const t = useTaim();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const fromSettings = params.get('from') === 'settings';
  const s = t.settings;
  const jobs = t.hats.filter((h) => h.kind === 'job');
  const job1 = t.hats.find((h) => h.id === s.job1HatId) || jobs[0];
  const job2 = t.hats.find((h) => h.id === s.job2HatId) || jobs[1];
  const [pct, setPct] = useState(s.splitPct);
  const [eve, setEve] = useState(s.eveningHours);
  const [sat, setSat] = useState(s.saturdayHours);
  const [sun, setSun] = useState(s.sundayHours);
  const workWeekH = (s.workEnd - s.workStart) * s.workdays.length;
  const j1h = Math.round((workWeekH * pct) / 100);
  const j2h = workWeekH - j1h;

  async function next() {
    await saveSettings(s, {
      splitPct: pct,
      eveningHours: eve,
      saturdayHours: sat,
      sundayHours: sun,
      job1HatId: job1?.id || null,
      job2HatId: job2?.id || null
    });
    if (job1 && job2) {
      await put('hat', { ...job1, budgetH: j1h });
      await put('hat', { ...job2, budgetH: j2h });
    }
    nav(fromSettings ? '/settings' : '/welcome/sources');
  }

  return (
    <div className="page no-tab">
      {!fromSettings && <Steps n={2} />}
      <h1 className="display">{job1 && job2 ? 'Two jobs, one 9–5. Split it. ✂️' : 'Your real week 🗓️'}</h1>
      {job1 && job2 && (
        <div className="card">
          <div className="row between">
            <span className="strong">Weekday 9–5</span>
            <span className="mono muted">{workWeekH}h</span>
          </div>
          <Bar height={18} segs={[[pct / 100, job1.color], [1 - pct / 100, job2.color]]} />
          <input type="range" min={10} max={90} step={5} value={pct} onChange={(e) => setPct(parseInt(e.target.value, 10))} aria-label="Split between jobs" />
          <div className="row between">
            <HatChip hat={job1} label={`${job1.name} · ${j1h}h`} />
            <HatChip hat={job2} label={`${job2.name} · ${j2h}h`} />
          </div>
        </div>
      )}
      <div className="card gap-12">
        {[
          ['🌙', 'Weeknights (from 7pm)', eve, setEve, 5],
          ['🌤️', 'Saturday', sat, setSat, 10],
          ['☕', 'Sunday morning', sun, setSun, 3]
        ].map(([e, l, v, set, max]) => (
          <div key={l as string} className="row between">
            <span className="row">
              <Sticker emoji={e as string} size={36} alpha={0.08} />
              <span>{l as string}</span>
            </span>
            <Stepper value={v as number} max={max as number} onChange={set as (n: number) => void} />
          </div>
        ))}
      </div>
      <div className="panel bg-lime-soft">
        <span>🌴</span>
        <span className="strong">Sunday after 1pm is yours. Untouchable.</span>
      </div>
      <div className="card tight row" style={{ flexDirection: 'row' }}>
        <Icon name="cal" size={20} color="var(--mark)" />
        <span className="fill">{t.calendars.length ? `${t.calendars.filter((c) => c.enabled).length} calendars connected` : 'Google Calendar'}</span>
        {t.calendars.length ? (
          <Icon name="check" size={18} color="var(--ok)" stroke={2.4} />
        ) : isGoogleConfigured ? (
          <button className="pill on" onClick={() => startGoogleConnect({ returnTo: '/welcome/week' })}>
            Connect
          </button>
        ) : (
          <span className="small faint">Set up later</span>
        )}
      </div>
      <div className="grow" />
      <button className="btn primary block" onClick={next}>
        {fromSettings ? 'Save' : 'Next'}
      </button>
    </div>
  );
}

export function WelcomeSources() {
  const t = useTaim();
  const nav = useNavigate();
  const [guide, setGuide] = useState(false);
  const calOk = t.calendars.length > 0;
  const tiles: [string, string, string, string, 'ready' | 'soon' | 'connect', () => void][] = [
    ['💬', '#25D366', 'WhatsApp', 'Copy or share', 'ready', () => setGuide(true)],
    ['📞', '#D946A8', 'Calls', 'Speak after', 'ready', () => {}],
    ['📅', '#14A39A', 'Calendar', calOk ? 'Synced' : 'Busy times', calOk ? 'ready' : 'connect', () => isGoogleConfigured && startGoogleConnect({ returnTo: '/welcome/sources' })],
    ['✉️', '#0C79BA', 'Email', 'Share to Taimwell', 'ready', () => setGuide(true)],
    ['🗨️', '#4338CA', 'Slack', 'Coming soon', 'soon', () => {}],
    ['📋', '#F97316', 'Monday', 'Coming soon', 'soon', () => {}]
  ];
  return (
    <div className="page no-tab">
      <Steps n={3} />
      <h1 className="display">Catch promises where you make them 🎣</h1>
      <div className="grid2">
        {tiles.map(([e, c, n, how, st, on]) => (
          <button key={n} className="tile" style={{ textAlign: 'left' }} onClick={on}>
            <div className="row between">
              <Sticker emoji={e} color={c} />
              {st === 'ready' ? <Icon name="check" size={18} color="var(--ok)" stroke={2.4} /> : st === 'connect' ? <span className="pill on">Connect</span> : <span className="pill">Soon</span>}
            </div>
            <div className="col gap-4">
              <span className="strong">{n}</span>
              <span className="small muted">{how}</span>
            </div>
          </button>
        ))}
      </div>
      <div className="grow" />
      <button
        className="btn primary block"
        onClick={async () => {
          await saveSettings(t.settings, { onboarded: true });
          nav('/');
        }}
      >
        Let's go 🚀
      </button>
      <Sheet open={guide} onClose={() => setGuide(false)}>
        <ShortcutGuide />
      </Sheet>
    </div>
  );
}
