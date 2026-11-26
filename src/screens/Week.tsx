import { useNavigate } from 'react-router-dom';
import { useTaim } from '../lib/hooks';
import { weekSummary } from '../lib/capacity';
import { MONTH_SHORT, addDays, fmtHours, isoWeek } from '../lib/time';
import { Bar, Sticker, TabBar } from '../components/ui';

export default function Week() {
  const t = useTaim();
  const nav = useNavigate();
  const w = weekSummary(t.ctx);
  const last = addDays(w.end, -1);
  const range = `${w.start.getDate()}–${last.getDate()} ${MONTH_SHORT[last.getMonth()]}`;
  const max = Math.max(w.committed, w.available, 1);

  return (
    <div className="page">
      <span className="overline">
        Week {isoWeek(t.ctx.now)} · {range}
      </span>
      <h1 className="display">{w.over > 0 ? `${fmtHours(w.over)} too many. Let's fix it 💪` : `You've got room. ${fmtHours(w.available - w.committed)} spare 🌿`}</h1>

      <div className="hero bg-mark col" style={{ gap: 12 }}>
        <span className="bubble" style={{ width: 180, height: 180, right: -40, top: -60, background: 'rgba(255,255,255,.08)' }} />
        <div className="row between" style={{ position: 'relative' }}>
          <span className="strong">This week</span>
          <span className="pill glass">{t.ctx.samples >= 3 ? `✨ Adjusted ${t.ctx.factor}×` : '✨ Learning your pace'}</span>
        </div>
        <div className="row" style={{ alignItems: 'baseline', gap: 6, position: 'relative' }}>
          <span className="mono c-lime" style={{ fontSize: 44, lineHeight: 1 }}>
            {fmtHours(w.committed)}
          </span>
          <span className="mono" style={{ fontSize: 20 }}>
            / {fmtHours(w.available)}
          </span>
        </div>
        <Bar
          height={12}
          bg="rgba(255,255,255,.2)"
          segs={[
            [Math.min(w.committed, w.available) / max, 'var(--lime)'],
            [w.over / max, 'var(--risk)']
          ]}
        />
        <span className="small" style={{ opacity: 0.8, position: 'relative' }}>
          {fmtHours(w.meetings)} of meetings already taken out
        </span>
      </div>

      <div className="card gap-12">
        {w.perHat.map(({ hat, committed, budget }) => {
          const over = committed > budget;
          const mx = Math.max(committed, budget, 1);
          return (
            <div key={hat.id} className="row" style={{ gap: 12 }}>
              <Sticker emoji={hat.emoji} color={hat.color} size={34} />
              <div className="col fill" style={{ gap: 6 }}>
                <div className="row between">
                  <span className="strong">{hat.name}</span>
                  <span className={`mono ${over ? 'c-risk' : 'muted'}`}>
                    {Math.round(committed / 60)}/{hat.budgetH}h
                  </span>
                </div>
                <Bar
                  height={8}
                  segs={
                    over
                      ? [
                          [budget / mx, hat.color],
                          [(committed - budget) / mx, 'var(--risk)']
                        ]
                      : [[committed / mx, hat.color]]
                  }
                />
              </div>
            </div>
          );
        })}
        {!w.perHat.length && <span className="muted small">Add your hats in Settings.</span>}
      </div>
      <div className="grow" />
      {w.over > 0 ? (
        <button className="btn primary block" onClick={() => nav('/week/resolve')}>
          Fix my week
        </button>
      ) : (
        <button className="btn secondary block" onClick={() => nav('/capture')}>
          Capture something new
        </button>
      )}
      <TabBar />
    </div>
  );
}
