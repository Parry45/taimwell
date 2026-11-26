import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { saveCommitment, saveSettings, useTaim } from '../lib/hooks';
import { REASON_LABEL, experimentFor, review } from '../lib/capacity';
import type { SlipReason } from '../lib/types';
import { TabBar, useToast } from '../components/ui';

const ORDER: SlipReason[] = ['underestimated', 'interrupted', 'never_captured', 'too_much'];
const BG: Record<SlipReason, string> = {
  underestimated: 'var(--warn-soft)',
  interrupted: 'var(--warn-soft)',
  never_captured: 'var(--risk-soft)',
  too_much: 'var(--sunken)'
};

export default function Review() {
  const t = useTaim();
  const nav = useNavigate();
  const toast = useToast();
  const r = review(t.ctx);
  const idea = experimentFor(r.topReason, t.ctx);
  const dots = useMemo(
    () => Array.from({ length: 18 }, (_, i) => ({ l: 52 + Math.random() * 46, t: Math.random() * 90, rot: Math.random() * 180, c: ['#BFFB57', '#FFFFFF', '#F97316', '#D946A8'][i % 4] })),
    []
  );

  return (
    <div className="page">
      <div className="steps">
        <span className="on cur" />
        <span className="on cur" />
        <span />
        <span />
      </div>
      <div className="hero bg-mark col" style={{ gap: 8 }}>
        {dots.map((d, i) => (
          <span key={i} style={{ position: 'absolute', left: `${d.l}%`, top: `${d.t}%`, width: 8, height: 4, borderRadius: 2, background: d.c, transform: `rotate(${d.rot}deg)`, opacity: 0.85 }} />
        ))}
        <span className="overline c-lime" style={{ position: 'relative' }}>
          Your week, wrapped 🎁
        </span>
        <span className="mono" style={{ fontSize: 64, lineHeight: 1, position: 'relative' }}>
          {r.kept.length}
        </span>
        <span className="display" style={{ position: 'relative' }}>
          promise{r.kept.length === 1 ? '' : 's'} kept
        </span>
        <div className="row gap-8 wrap" style={{ position: 'relative' }}>
          <span className="pill lime">✅ {r.onTimePct}% on time</span>
          <span className="pill glass">⚡ {r.interruptions} interruptions</span>
        </div>
      </div>

      <span className="heading">{r.slipped.length ? `${r.slipped.length} slipped. Here's why` : 'Nothing slipped. Legend 🏆'}</span>
      {r.slipped.length > 0 && (
        <div className="card gap-12">
          {r.slipped.map(({ c, reason }) => {
            const hat = t.hatById(c.hatId);
            return (
              <div key={c.id} className="row between">
                <span className="row gap-8 fill" style={{ minWidth: 0 }}>
                  <span style={{ width: 4, height: 22, borderRadius: 2, background: hat?.color || '#94A3B7', flex: 'none' }} />
                  <span className="strong ellipsis">{c.title}</span>
                </span>
                <button
                  className="pill"
                  style={{ background: BG[reason] }}
                  onClick={() => saveCommitment(c, { slipReason: ORDER[(ORDER.indexOf(reason) + 1) % ORDER.length] })}
                  aria-label="Change reason"
                >
                  {REASON_LABEL[reason]}
                </button>
              </div>
            );
          })}
          <span className="small faint">Tap a reason to change it.</span>
        </div>
      )}

      {idea && (
        <div className="panel bg-lime-soft" style={{ padding: 16, borderRadius: 24 }}>
          <div className="col fill" style={{ gap: 2 }}>
            <span className="label muted">💡 Try this week</span>
            <span className="strong">{idea}</span>
          </div>
          <button
            className="pill on"
            onClick={async () => {
              await saveSettings(t.settings, { experiment: idea });
              toast('Added to next week ✓');
            }}
          >
            {t.settings.experiment === idea ? 'Added ✓' : 'Add +'}
          </button>
        </div>
      )}
      <div className="grow" />
      <button className="btn primary block" onClick={() => nav('/week')}>
        Plan next week →
      </button>
      <TabBar />
    </div>
  );
}
