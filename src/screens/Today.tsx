import { useNavigate } from 'react-router-dom';
import { useTaim } from '../lib/hooks';
import { remaining, streak, todayView, weekDots } from '../lib/capacity';
import { DAY_SHORT, fmtDate, fmtDue, fmtDur, fmtTime, greeting, isSameDay } from '../lib/time';
import { Icon, Ring, Sticker, TabBar, TaskRow } from '../components/ui';

const DOT: Record<string, string> = { ok: 'var(--ok)', warn: 'var(--warn)', risk: 'var(--risk)', none: 'transparent', rest: 'var(--text3)' };

export default function Today() {
  const t = useTaim();
  const nav = useNavigate();
  const { ctx, rk } = t;
  const v = todayView(ctx, rk);
  const dots = weekDots(ctx, rk);
  const st = streak(t.commitments, ctx.now);
  const firstRisk = [...rk.entries()].find(([, r]) => r.atRisk)?.[0];
  const openCount = t.commitments.filter((c) => c.status === 'open').length;
  const breakUntil = t.settings.breakUntil ? new Date(t.settings.breakUntil) : null;
  const onBreak = breakUntil && breakUntil > ctx.now;
  const allDone = v.doneCount > 0 && v.list.every((c) => c.status === 'done');

  return (
    <div className="page">
      <div className="row">
        <Sticker emoji="😎" color="#BFFB57" solid />
        <div className="col gap-4 fill" style={{ gap: 0 }}>
          <span className="small muted">
            {greeting(ctx.now)}
            {t.settings.name ? `, ${t.settings.name}` : ''}
          </span>
          <span className="heading">{fmtDate(ctx.now)}</span>
        </div>
        <button className="icon-btn" aria-label="Settings" onClick={() => nav('/settings')}>
          <Icon name="gear" size={20} />
        </button>
      </div>

      <div className="strip">
        {dots.map(({ date, dot }) => {
          const on = isSameDay(date, ctx.now);
          return (
            <div key={date.toISOString()} className={`day ${on ? 'on' : ''}`}>
              <span className="d">{date.getDate()}</span>
              <span className="w">{DAY_SHORT[date.getDay()].slice(0, 1)}</span>
              <span className="dot" style={{ background: on && dot === 'none' ? 'var(--lime)' : DOT[dot] }} />
            </div>
          );
        })}
      </div>

      {onBreak && (
        <div className="panel bg-lime-soft">
          <span>🌴</span>
          <span className="strong fill">Break until {fmtTime(breakUntil!)}. Phone down, shoulders down.</span>
        </div>
      )}

      <div className="hero bg-lime row" style={{ gap: 12 }}>
        <span className="bubble" style={{ width: 160, height: 160, right: -30, top: -50 }} />
        <div className="col fill" style={{ gap: 8, position: 'relative' }}>
          {openCount === 0 && v.doneCount === 0 ? (
            <>
              <span className="display" style={{ fontSize: 28 }}>Nothing on.<br />Enjoy it.</span>
              <span>Tap ＋ when a promise comes in 🌴</span>
            </>
          ) : allDone ? (
            <>
              <span className="display" style={{ fontSize: 28 }}>All 3 done.<br />You're free.</span>
              <span>Go touch grass 🌿</span>
            </>
          ) : (
            <>
              <span className="display" style={{ fontSize: 28 }}>3 things.<br />That's it.</span>
              <span>Then you're free 🌴</span>
            </>
          )}
          {st > 0 && <span className="pill ink" style={{ alignSelf: 'flex-start' }}>🔥 {st}-day on-time streak</span>}
        </div>
        <div className="col center" style={{ gap: 4, position: 'relative' }}>
          <Ring pct={v.doneCount / 3} />
          <span className="label">{v.doneCount} of 3</span>
        </div>
      </div>

      <div className="row gap-8">
        <div className="panel bg-surface fill" style={{ boxShadow: 'var(--shadow-soft)' }}>
          <span>⏱️</span>
          <span className={`strong ${v.slackMin >= 0 ? 'c-ok' : 'c-risk'}`}>{v.slackMin >= 0 ? `${fmtDur(v.slackMin)} free` : `${fmtDur(-v.slackMin)} over`}</span>
        </div>
        {v.riskCount > 0 ? (
          <button className="panel bg-warn-soft fill" onClick={() => firstRisk && nav(`/risk/${firstRisk}`)}>
            <span>⚠️</span>
            <span className="strong c-warn fill" style={{ textAlign: 'left' }}>{v.riskCount} at risk</span>
            <Icon name="chev" size={16} color="var(--warn)" stroke={2} />
          </button>
        ) : (
          <div className="panel bg-lime-soft fill">
            <span>✅</span>
            <span className="strong">On track</span>
          </div>
        )}
      </div>

      {t.settings.experiment && (
        <div className="panel bg-mark-soft">
          <span>💡</span>
          <span className="small fill">This week: {t.settings.experiment}</span>
        </div>
      )}

      <div className="row between">
        <span className="heading">Top 3</span>
        <span className="mono muted">{fmtDur(v.list.filter((c) => c.status === 'open').reduce((a, c) => a + remaining(c, ctx.factor), 0))}</span>
      </div>
      {v.list.length === 0 && <div className="empty small">No promises yet. Capture the next one with ＋</div>}
      {v.list.map((c) => {
        const hat = t.hatById(c.hatId);
        const r = rk.get(c.id);
        const meta = c.status === 'done' ? `${hat?.name || 'No hat'} · done` : `${hat?.name || 'No hat'} · ${fmtDue(c.due, ctx.now)}${r?.atRisk ? ' · ⚠️ at risk' : ''}`;
        return (
          <TaskRow
            key={c.id}
            c={c}
            hat={hat}
            meta={meta}
            right={<span className="mono muted">{c.status === 'done' ? '✓' : fmtDur(remaining(c, ctx.factor))}</span>}
            onClick={() => (c.status === 'open' ? nav(r?.atRisk ? `/risk/${c.id}` : `/focus/${c.id}`) : undefined)}
          />
        );
      })}
      {openCount > 3 && <span className="small muted">+ {openCount - 3} more open promises this week</span>}

      <button className="row between" onClick={() => nav('/timeline')}>
        <span className="strong c-mark">See today's timeline</span>
        <Icon name="chev" size={18} color="var(--mark)" stroke={2} />
      </button>
      <TabBar />
    </div>
  );
}
