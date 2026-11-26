import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { saveCommitment, useTaim } from '../lib/hooks';
import { nextWeekDue, remaining } from '../lib/capacity';
import { renegotiateMsg, shareText } from '../lib/drafts';
import { addDays, fmtDue, fmtDur } from '../lib/time';
import { Back, HatChip, Icon, Sticker, useToast } from '../components/ui';

export default function AtRisk() {
  const { id = '' } = useParams();
  const t = useTaim();
  const nav = useNavigate();
  const toast = useToast();
  const c = t.commitments.find((x) => x.id === id);
  const r = t.rk.get(id);
  const hat = t.hatById(c?.hatId);
  const shortfall = r ? Math.max(0, r.needed - r.free) : 0;

  // a lower-stakes promise we could push to next week to make room
  const movable = useMemo(() => {
    if (!c) return undefined;
    return t.commitments
      .filter((x) => x.status === 'open' && x.id !== c.id && !x.forWhom && (!x.due || new Date(x.due) > new Date(c.due || 0)))
      .map((x) => ({ x, rem: remaining(x, t.ctx.factor) }))
      .filter((o) => o.rem >= Math.min(shortfall, 30))
      .sort((a, b) => b.rem - a.rem)[0];
  }, [t.commitments, t.ctx.factor, c, shortfall]);

  const newDue = c?.due ? addDays(new Date(c.due), Math.max(1, Math.ceil(shortfall / 240)) + 2) : nextWeekDue(t.ctx.now);
  const [choice, setChoice] = useState<'room' | 'ask'>(movable ? 'room' : 'ask');
  const [msg, setMsg] = useState('');
  useEffect(() => {
    if (c) setMsg(renegotiateMsg(c, newDue));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c?.id]);

  if (!c) return null;

  async function go() {
    if (choice === 'room' && movable) {
      await saveCommitment(movable.x, { due: nextWeekDue(t.ctx.now).toISOString(), slot: null });
      toast(`Moved “${movable.x.title}” to next week`);
      nav('/');
      return;
    }
    const res = await shareText(msg, c!.source);
    await saveCommitment(c!, { due: newDue.toISOString(), slot: null });
    toast(res === 'copied' ? 'Message copied · new date saved' : 'New date saved ✓');
    nav('/');
  }

  return (
    <div className="page no-tab">
      <Back label="Today" to="/" />
      <div className="row gap-8">
        {r?.atRisk ? (
          <span className="pill bg-risk-soft c-risk">
            <Icon name="alert" size={14} stroke={2} /> {r.late ? 'Late' : 'At risk'}
          </span>
        ) : (
          <span className="pill bg-lime-soft">✅ On track</span>
        )}
        <HatChip hat={hat} />
      </div>
      <h1 className="display">{c.title}</h1>
      <span className="muted">
        {c.forWhom ? `For ${c.forWhom} · ` : ''}due {fmtDue(c.due, t.ctx.now)}
      </span>
      <div className="row gap-8">
        <div className="card fill" style={{ gap: 2 }}>
          <span className="mono" style={{ fontSize: 30 }}>
            {fmtDur(r?.needed ?? remaining(c, t.ctx.factor))}
          </span>
          <span className="small muted">needed</span>
        </div>
        <div className="card fill bg-risk-soft" style={{ gap: 2, boxShadow: 'none' }}>
          <span className="mono c-risk" style={{ fontSize: 30 }}>
            {fmtDur(r?.free ?? 0)}
          </span>
          <span className="small muted">free before it's due</span>
        </div>
      </div>
      {movable && (
        <button className={`card tight row ${choice === 'room' ? 'selected' : ''}`} style={{ flexDirection: 'row', textAlign: 'left' }} onClick={() => setChoice('room')}>
          <Sticker emoji="📅" color="#0C79BA" size={36} />
          <span className="strong fill">Move “{movable.x.title}” to next week</span>
          {choice === 'room' && <Icon name="check" size={18} stroke={2.4} color="var(--mark)" />}
        </button>
      )}
      <button className={`card tight row ${choice === 'ask' ? 'selected' : ''}`} style={{ flexDirection: 'row', textAlign: 'left' }} onClick={() => setChoice('ask')}>
        <Sticker emoji="💬" color="#4338CA" size={36} />
        <span className="strong fill">
          Ask {c.forWhom?.split(' ')[0] || 'them'} for {fmtDue(newDue.toISOString(), t.ctx.now)}
        </span>
        {choice === 'ask' && <Icon name="check" size={18} stroke={2.4} color="var(--mark)" />}
      </button>
      {choice === 'ask' && (
        <div className="card">
          <span className="overline">Draft · {c.source === 'whatsapp' ? 'WhatsApp' : 'message'}</span>
          <textarea className="input bubble-msg" style={{ border: 0 }} value={msg} onChange={(e) => setMsg(e.target.value)} rows={4} />
          <span className="label c-ok">Sent early = trust kept ✨</span>
        </div>
      )}
      <div className="grow" />
      <div className="row gap-8">
        <button className="btn secondary fill" onClick={() => nav(`/focus/${c.id}`)}>
          Start it now
        </button>
        <button className="btn primary fill" onClick={go}>
          {choice === 'room' ? 'Make room' : c.source === 'whatsapp' ? 'Send on WhatsApp' : 'Send message'}
        </button>
      </div>
    </div>
  );
}
