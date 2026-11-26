import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { saveCommitment, useTaim } from '../lib/hooks';
import { remaining } from '../lib/capacity';
import { addMin, fmtTime } from '../lib/time';
import { playVibe, stopVibe, Vibe } from '../lib/sound';
import { HatChip, Icon, Sheet } from '../components/ui';

interface TimerState {
  plannedMin: number;
  startedAt: number | null;
  accMs: number;
}

const key = (id: string) => `tw_focus_${id}`;
function load(id: string): TimerState | null {
  try {
    return JSON.parse(localStorage.getItem(key(id)) || 'null');
  } catch {
    return null;
  }
}

const VIBES: [Vibe, string][] = [
  ['rain', '🌧️ Rain'],
  ['cafe', '☕ Café'],
  ['lofi', '🎧 Lo-fi'],
  ['quiet', '🤫 Quiet']
];
const INTERRUPTS = ['🗨️ Slack', '💬 WhatsApp', '📞 Call', '🙋 Someone came by', '📧 Email', '🧠 My own mind'];

export default function Focus() {
  const { id = '' } = useParams();
  const t = useTaim();
  const nav = useNavigate();
  const c = t.commitments.find((x) => x.id === id);
  const [st, setSt] = useState<TimerState | null>(() => load(id));
  const [, tick] = useState(0);
  const [vibe, setVibe] = useState<Vibe>('quiet');
  const [sheet, setSheet] = useState(false);

  useEffect(() => {
    if (!c || st) return;
    const planned = Math.min(120, Math.max(15, remaining(c, t.ctx.factor)));
    const s = { plannedMin: planned, startedAt: Date.now(), accMs: 0 };
    setSt(s);
    localStorage.setItem(key(id), JSON.stringify(s));
  }, [c, st, id, t.ctx.factor]);

  useEffect(() => {
    const i = setInterval(() => tick((n) => n + 1), 1000);
    return () => {
      clearInterval(i);
      stopVibe();
    };
  }, []);

  if (!c || !st) return null;
  const save = (s: TimerState) => {
    setSt(s);
    localStorage.setItem(key(id), JSON.stringify(s));
  };
  const elapsedMs = st.accMs + (st.startedAt ? Date.now() - st.startedAt : 0);
  const leftMs = st.plannedMin * 60_000 - elapsedMs;
  const over = leftMs < 0;
  const abs = Math.abs(leftMs);
  const mm = Math.floor(abs / 60_000);
  const ss = Math.floor((abs % 60_000) / 1000);
  const endsAt = addMin(new Date(), Math.max(0, leftMs / 60_000));
  const pct = Math.min(1, elapsedMs / (st.plannedMin * 60_000));
  const running = !!st.startedAt;
  const hat = t.hatById(c.hatId);
  const interruptions = c.interruptions || [];

  async function finish(done: boolean) {
    const mins = Math.round(elapsedMs / 60_000);
    localStorage.removeItem(key(id));
    stopVibe();
    if (done) {
      await saveCommitment(c!, { actualMin: (c!.actualMin || 0) + mins, status: 'done', doneAt: new Date().toISOString() });
      nav(`/done/${id}`, { replace: true });
    } else {
      await saveCommitment(c!, { actualMin: (c!.actualMin || 0) + mins });
      nav('/', { replace: true });
    }
  }

  return (
    <div className="page dark no-tab" style={{ position: 'relative', overflow: 'hidden', gap: 18 }}>
      <span className="glow" style={{ width: 340, height: 340, left: '50%', marginLeft: -170, top: 140, background: 'rgba(67,56,202,0.75)' }} />
      <span className="glow" style={{ width: 180, height: 180, right: -10, top: 330, background: 'rgba(191,251,87,0.35)' }} />
      <div className="row between" style={{ position: 'relative' }}>
        <button className="icon-btn sm" style={{ background: 'rgba(255,255,255,.1)', boxShadow: 'none', color: '#fff' }} aria-label="Save and leave" onClick={() => finish(false)}>
          <Icon name="x" size={16} />
        </button>
        <HatChip hat={hat} />
        <span className="label faint">🔕 other hats muted</span>
      </div>
      <div className="grow" />
      <div className="col center" style={{ position: 'relative', gap: 6 }}>
        <span className="timer" style={{ color: over ? 'var(--lime)' : '#fff' }}>
          {over ? '+' : ''}
          {String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}
        </span>
        <span className="mono faint">{over ? 'overtime — wrap up when ready' : `of ${st.plannedMin}m · ${running ? `ends ${fmtTime(endsAt)}` : 'paused'}`}</span>
      </div>
      <h1 className="display" style={{ textAlign: 'center', position: 'relative' }}>
        {c.title}
      </h1>
      <div className="bar" style={{ height: 8, background: 'rgba(255,255,255,.15)', position: 'relative' }}>
        <span style={{ width: `${pct * 100}%`, background: 'var(--lime)' }} />
      </div>
      <div className="row center wrap gap-8" style={{ position: 'relative' }}>
        {VIBES.map(([v, l]) => (
          <button
            key={v}
            className={`pill ${vibe === v ? 'lime' : 'glass'}`}
            onClick={() => {
              setVibe(v);
              playVibe(v);
            }}
          >
            {l}
          </button>
        ))}
      </div>
      <span className="small faint" style={{ textAlign: 'center', position: 'relative' }}>
        ⚡ {interruptions.length} interruption{interruptions.length === 1 ? '' : 's'} so far
      </span>
      <div className="grow" />
      <button className="btn warn block" style={{ position: 'relative' }} onClick={() => setSheet(true)}>
        <Icon name="bolt" size={18} stroke={2} /> I got interrupted
      </button>
      <div className="row gap-8" style={{ position: 'relative' }}>
        <button
          className="btn secondary fill"
          onClick={() => (running ? save({ ...st, accMs: elapsedMs, startedAt: null }) : save({ ...st, startedAt: Date.now() }))}
        >
          {running ? 'Pause' : 'Resume'}
        </button>
        <button className="btn accent fill" onClick={() => finish(true)}>
          Done 🎉
        </button>
      </div>
      <Sheet open={sheet} onClose={() => setSheet(false)}>
        <span className="heading" style={{ color: 'var(--text)' }}>
          What pulled you away?
        </span>
        <div className="chips">
          {INTERRUPTS.map((l) => (
            <button
              key={l}
              className="pill"
              style={{ padding: '10px 14px', fontSize: 14 }}
              onClick={async () => {
                await saveCommitment(c, { interruptions: [...interruptions, { at: new Date().toISOString(), label: l }] });
                setSheet(false);
              }}
            >
              {l}
            </button>
          ))}
        </div>
        <span className="small muted">Logged, not judged. Sunday's review will spot the pattern.</span>
      </Sheet>
    </div>
  );
}
