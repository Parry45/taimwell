import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { saveCommitment, useTaim } from '../lib/hooks';
import { GiveAction, GiveOption, giveOptions, nextWeekDue, weekSummary } from '../lib/capacity';
import { declineMsg, delegateMsg, renegotiateMsg, shareText } from '../lib/drafts';
import { addDays, fmtDue, fmtDur } from '../lib/time';
import type { Source } from '../lib/types';
import { Back, Bar, Icon, Sheet, Sticker, useToast } from '../components/ui';

const META: Record<GiveAction, [string, string, string, string]> = {
  move: ['➡️', '#4338CA', 'Move', 'var(--mark)'],
  delegate: ['🤝', '#14A39A', 'Delegate', '#14A39A'],
  renegotiate: ['💬', '#D97706', 'Ask for more time', 'var(--warn)'],
  drop: ['🗑️', '#EF4444', 'Drop', 'var(--risk)']
};

interface Outbox {
  to: string;
  text: string;
  source?: Source;
}

export default function Resolve() {
  const t = useTaim();
  const nav = useNavigate();
  const toast = useToast();
  const w = weekSummary(t.ctx);
  const opts = useMemo(() => giveOptions(t.ctx).slice(0, 8), [t.ctx]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [outbox, setOutbox] = useState<Outbox[] | null>(null);
  const [delegateTo, setDelegateTo] = useState('');

  const freed = opts.filter((o) => sel.has(o.c.id)).reduce((a, o) => a + o.gain, 0);
  const still = Math.max(0, w.over - freed);
  const needsName = opts.some((o) => sel.has(o.c.id) && o.action === 'delegate');

  function detail(o: GiveOption): string {
    const c = o.c;
    if (o.action === 'move') return `${c.title} → next week`;
    if (o.action === 'delegate') return `${c.title} → someone else`;
    if (o.action === 'renegotiate') return `${c.title} → ${fmtDue(addDays(new Date(c.due!), 7).toISOString())}`;
    return c.title;
  }
  function sub(o: GiveOption): string {
    if (o.action === 'move') return c(o).due ? `Due ${fmtDue(c(o).due)}` : 'No deadline';
    if (o.action === 'delegate') return 'Handover note drafted';
    if (o.action === 'renegotiate') return `Message to ${c(o).forWhom} drafted`;
    return c(o).forWhom ? 'Polite no drafted' : 'Nobody is waiting on it';
  }
  const c = (o: GiveOption) => o.c;

  async function apply() {
    const msgs: Outbox[] = [];
    for (const o of opts.filter((x) => sel.has(x.c.id))) {
      const it = o.c;
      if (o.action === 'move') await saveCommitment(it, { due: nextWeekDue(t.ctx.now).toISOString(), slot: null });
      if (o.action === 'renegotiate') {
        const nd = addDays(new Date(it.due!), 7);
        msgs.push({ to: it.forWhom || 'them', text: renegotiateMsg(it, nd), source: it.source });
        await saveCommitment(it, { due: nd.toISOString(), slot: null });
      }
      if (o.action === 'delegate') {
        msgs.push({ to: delegateTo || 'your teammate', text: delegateMsg(it, delegateTo) });
        await saveCommitment(it, { status: 'delegated', delegatedTo: delegateTo || undefined, slot: null });
      }
      if (o.action === 'drop') {
        if (it.forWhom) msgs.push({ to: it.forWhom, text: declineMsg(it), source: it.source });
        await saveCommitment(it, { status: 'dropped', slot: null });
      }
    }
    if (msgs.length) setOutbox(msgs);
    else {
      toast('Week rebalanced ✓');
      nav('/week');
    }
  }

  return (
    <div className="page no-tab">
      <Back label="Week" to="/week" />
      <h1 className="display">What gives? 🤔</h1>
      {w.over <= 0 && !sel.size ? (
        <div className="panel bg-lime-soft">
          <span>✅</span>
          <span className="strong">Your week already fits. Nothing has to give.</span>
        </div>
      ) : (
        <div className={`card ${still > 0 ? 'bg-warn-soft' : 'bg-lime-soft'}`} style={{ boxShadow: 'none' }}>
          <div className="row between">
            <span className={`strong ${still > 0 ? 'c-warn' : 'c-ok'}`}>{still > 0 ? 'Still over' : 'Back in the green ✓'}</span>
            <span className={`mono ${still > 0 ? 'c-warn' : 'c-ok'}`}>{still > 0 ? fmtDur(still) : `+${fmtDur(freed - w.over)} spare`}</span>
          </div>
          <Bar bg="#fff" segs={[[w.over ? Math.min(1, freed / w.over) : 1, 'var(--ok)']]} />
        </div>
      )}
      {opts.map((o) => {
        const [e, col, label, tc] = META[o.action];
        const on = sel.has(o.c.id);
        return (
          <button
            key={o.c.id}
            className={`card tight row ${on ? 'selected' : ''}`}
            style={{ flexDirection: 'row', textAlign: 'left', gap: 12 }}
            onClick={() => {
              const n = new Set(sel);
              if (on) n.delete(o.c.id);
              else n.add(o.c.id);
              setSel(n);
            }}
          >
            <Sticker emoji={e} color={col} />
            <span className="col fill" style={{ gap: 1 }}>
              <span className="overline" style={{ color: tc }}>
                {label}
              </span>
              <span className="strong">{detail(o)}</span>
              <span className="small muted">{sub(o)}</span>
            </span>
            <span className="col" style={{ alignItems: 'flex-end', gap: 6 }}>
              <span className="mono c-ok">+{fmtDur(o.gain)}</span>
              <span className="sticker" style={{ width: 22, height: 22, background: on ? 'var(--mark)' : 'var(--sunken)' }}>
                {on && <Icon name="check" size={13} stroke={2.6} color="#fff" />}
              </span>
            </span>
          </button>
        );
      })}
      {!opts.length && <div className="empty small">Nothing this week can move. Time to say no to the next new ask.</div>}
      {needsName && <input className="input" placeholder="🤝 Delegate to (name)" value={delegateTo} onChange={(e) => setDelegateTo(e.target.value)} />}
      <div className="grow" />
      <button className="btn primary block" disabled={!sel.size} onClick={apply}>
        Apply {sel.size || ''} change{sel.size === 1 ? '' : 's'}
      </button>

      <Sheet
        open={!!outbox}
        onClose={() => {
          setOutbox(null);
          nav('/week');
        }}
      >
        <span className="heading">Send the heads-ups ✉️</span>
        <span className="small muted">Early warnings keep trust. Each opens your messaging app with the text ready — you press send.</span>
        {(outbox || []).map((m, i) => (
          <div key={i} className="col gap-8">
            <span className="field-label">To {m.to}</span>
            <div className="bubble-msg">{m.text}</div>
            <button className="btn secondary" onClick={async () => {
              const r = await shareText(m.text, m.source);
              if (r === 'copied') toast('Copied — paste it in your chat');
            }}>
              <Icon name="share" size={18} /> {m.source === 'whatsapp' ? 'Open in WhatsApp' : 'Share'}
            </button>
          </div>
        ))}
        <button
          className="btn primary block"
          onClick={() => {
            setOutbox(null);
            nav('/week');
          }}
        >
          Done
        </button>
      </Sheet>
    </div>
  );
}
