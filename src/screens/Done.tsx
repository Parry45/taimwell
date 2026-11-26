import { useNavigate, useParams } from 'react-router-dom';
import { saveSettings, useTaim } from '../lib/hooks';
import { adjusted, dayKept, streak } from '../lib/capacity';
import { addDays, addMin, fmtDur, startOfDay, startOfWeek } from '../lib/time';
import { Confetti, Icon } from '../components/ui';

export default function Done() {
  const { id = '' } = useParams();
  const t = useTaim();
  const nav = useNavigate();
  const c = t.commitments.find((x) => x.id === id);
  if (!c) return null;
  const now = t.ctx.now;
  const st = streak(t.commitments, now);
  const ahead = adjusted(c, t.ctx.factor) - (c.actualMin || 0);
  const first = c.forWhom?.split(/\s+/)[0];
  let early = '';
  if (c.due && c.doneAt) {
    const days = Math.round((startOfDay(new Date(c.due)).getTime() - startOfDay(new Date(c.doneAt)).getTime()) / 86_400_000);
    early = days >= 2 ? `${days} days early` : days === 1 ? 'a day early' : new Date(c.doneAt) <= new Date(c.due) ? 'right on time' : 'done — late, but done';
  }
  const line = first ? `${first} gets ${c.title.toLowerCase().startsWith('send') ? 'it' : 'this'} ${early || 'done'}.` : early ? `Finished ${early}.` : 'One less thing on your mind.';
  const wk = startOfWeek(now);

  return (
    <div className="page violet no-tab" style={{ position: 'relative', overflow: 'hidden' }}>
      <Confetti />
      <div className="grow" />
      <div className="col center gap-12" style={{ position: 'relative' }}>
        <div className="sticker pop" style={{ width: 128, height: 128, background: 'var(--lime)', fontSize: 60, boxShadow: 'var(--shadow-float)' }}>
          🎉
        </div>
        <h1 className="display-xl" style={{ fontSize: 40 }}>
          Promise kept!
        </h1>
        <span style={{ maxWidth: 300 }}>{line}</span>
      </div>
      <div className="card" style={{ color: 'var(--text)', position: 'relative' }}>
        <div className="row between">
          <span className="heading">🔥 {st}-day streak</span>
          <span className="mono muted">this week</span>
        </div>
        <div className="row between">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => {
            const k = dayKept(t.commitments, addDays(wk, i), now);
            return (
              <div key={i} className="col center gap-4">
                <span className="sticker" style={{ width: 32, height: 32, background: k === 'kept' ? 'var(--lime)' : k === 'missed' ? 'var(--risk-soft)' : 'var(--sunken)' }}>
                  {k === 'kept' ? <Icon name="check" size={16} stroke={2.6} /> : k === 'missed' ? '·' : ''}
                </span>
                <span className="label muted">{d}</span>
              </div>
            );
          })}
        </div>
        <div className="panel bg-lime-soft center">
          <span className="strong">
            {ahead >= 5 ? `⏱️ You're ${fmtDur(ahead)} ahead of plan` : ahead > -5 ? '🎯 Right on plan' : `🐢 Took ${fmtDur(-ahead)} longer — noted for next time`}
          </span>
        </div>
      </div>
      <div className="grow" />
      {ahead >= 10 && (
        <button
          className="btn accent block"
          style={{ position: 'relative' }}
          onClick={async () => {
            await saveSettings(t.settings, { breakUntil: addMin(new Date(), 15).toISOString() });
            nav('/', { replace: true });
          }}
        >
          Take a 15-min break 🌴
        </button>
      )}
      <button className="btn secondary block" style={{ position: 'relative' }} onClick={() => nav('/', { replace: true })}>
        Next thing
      </button>
    </div>
  );
}
