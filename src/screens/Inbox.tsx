import { ReactNode, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { saveCommitment, useTaim } from '../lib/hooks';
import { adjusted, findSlot } from '../lib/capacity';
import type { Commitment, Source } from '../lib/types';
import { fmtDur } from '../lib/time';
import { HatChip, SOURCE_EMOJI, SOURCE_LABEL, Sticker, TabBar, useToast } from '../components/ui';

function SwipeCard({ children, onRight, onLeft, onTap }: { children: ReactNode; onRight: () => void; onLeft: () => void; onTap: () => void }) {
  const [dx, setDx] = useState(0);
  const [drag, setDrag] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);
  return (
    <div className="swipe">
      <div className="under" style={{ background: dx >= 0 ? 'var(--ok)' : 'var(--risk)' }}>
        <span>✓ Commit</span>
        <span>Decline ✕</span>
      </div>
      <div
        className={`front ${drag ? 'dragging' : ''}`}
        style={{ transform: `translateX(${dx}px) rotate(${dx / 60}deg)` }}
        onPointerDown={(e) => {
          start.current = { x: e.clientX, y: e.clientY };
          moved.current = false;
          setDrag(true);
        }}
        onPointerMove={(e) => {
          if (!start.current) return;
          const x = e.clientX - start.current.x;
          if (Math.abs(x) > 6) moved.current = true;
          setDx(x);
        }}
        onPointerUp={() => {
          setDrag(false);
          start.current = null;
          if (dx > 90) onRight();
          else if (dx < -90) onLeft();
          else if (!moved.current) onTap();
          setDx(0);
        }}
        onPointerCancel={() => {
          setDrag(false);
          start.current = null;
          setDx(0);
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default function Inbox() {
  const t = useTaim();
  const nav = useNavigate();
  const toast = useToast();
  const [filter, setFilter] = useState<Source | 'all'>('all');
  const items = t.commitments.filter((c) => c.status === 'inbox').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const sources = [...new Set(items.map((c) => c.source))];
  const shown = items.filter((c) => filter === 'all' || c.source === filter);
  const minutes = Math.max(1, Math.round((items.length * 15) / 60));

  async function commit(c: Commitment) {
    if (!c.hatId) {
      nav(`/capture?id=${c.id}`);
      return;
    }
    const slot = findSlot(t.ctx, adjusted(c, t.ctx.factor), c.due ? new Date(c.due) : null, c.id);
    await saveCommitment(c, {
      status: 'open',
      committedAt: new Date().toISOString(),
      slot: slot && !slot.partial ? { start: slot.start.toISOString(), end: slot.end.toISOString() } : null
    });
    toast('Committed ✓');
  }
  async function decline(c: Commitment) {
    await saveCommitment(c, { status: 'dropped' });
    toast('Declined — not your promise');
  }

  return (
    <div className="page">
      <div className="row between">
        <div className="row gap-8">
          <h1 className="display">Inbox</h1>
          <span className="pill on">{items.length}</span>
        </div>
        {items.length > 0 && <span className="pill bg-lime-soft">⏱️ ~{minutes} min to zero</span>}
      </div>
      {items.length > 0 && (
        <div className="scroll-x">
          <button className={`pill ${filter === 'all' ? 'on' : 'bg-surface'}`} onClick={() => setFilter('all')}>
            All
          </button>
          {sources.map((s) => (
            <button key={s} className={`pill ${filter === s ? 'on' : 'bg-surface'}`} onClick={() => setFilter(s)}>
              {SOURCE_LABEL[s]} {items.filter((c) => c.source === s).length}
            </button>
          ))}
        </div>
      )}
      {shown.length === 0 && (
        <div className="empty">
          <div style={{ fontSize: 48 }}>🎉</div>
          <div className="heading">Inbox zero</div>
          <div className="small">Nothing waiting. Captured promises land here until you decide.</div>
        </div>
      )}
      {shown.map((c) => {
        const hat = t.hatById(c.hatId);
        const [e, col] = SOURCE_EMOJI[c.source] || SOURCE_EMOJI.manual;
        return (
          <SwipeCard key={c.id} onRight={() => commit(c)} onLeft={() => decline(c)} onTap={() => nav(`/capture?id=${c.id}`)}>
            <div className="card tight row" style={{ flexDirection: 'row', gap: 12 }}>
              <Sticker emoji={e} color={col} />
              <div className="col fill" style={{ gap: 6 }}>
                <span className="strong">{c.title}</span>
                <span className="row gap-8">
                  <HatChip hat={hat} label={hat ? hat.name : 'Pick a hat'} />
                  {c.forWhom && <span className="small muted ellipsis">for {c.forWhom}</span>}
                </span>
              </div>
              <span className="mono muted">{fmtDur(adjusted(c, t.ctx.factor))}</span>
            </div>
          </SwipeCard>
        );
      })}
      {shown.length > 0 && <div className="small faint" style={{ textAlign: 'center' }}>Swipe → commit · ← decline · tap for more</div>}
      <TabBar />
    </div>
  );
}
