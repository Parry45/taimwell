import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { newCommitment, saveCommitment, useTaim } from '../lib/hooks';
import { put } from '../lib/db';
import { adjusted, fitCheck, nextWeekDue } from '../lib/capacity';
import { parseCapture, sourceFrom, suggestHat } from '../lib/parse';
import type { Commitment } from '../lib/types';
import { DAY_SHORT, addDays, atHour, fmtDur, fmtRange, fmtDue, startOfDay, toLocalInput } from '../lib/time';
import { Icon, SOURCE_EMOJI, SOURCE_LABEL, useToast } from '../components/ui';

const ESTIMATES = [15, 30, 60, 120, 240];

type SR = { start: () => void; stop: () => void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; lang: string; interimResults: boolean; continuous: boolean };

export default function Capture() {
  const t = useTaim();
  const nav = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const editId = params.get('id');
  const existing = editId ? t.commitments.find((c) => c.id === editId) : undefined;

  const [draft, setDraft] = useState<Commitment | null>(null);
  const [listening, setListening] = useState(false);
  const recRef = useRef<SR | null>(null);

  // build the initial draft once data is ready
  useEffect(() => {
    if (draft || !t.ready) return;
    if (existing) {
      setDraft({ ...existing });
      return;
    }
    const text = [params.get('title'), params.get('text'), params.get('url')].filter(Boolean).join(' ').trim();
    setDraft(fromText(text, params.get('source')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.ready, existing]);

  function fromText(text: string, src: string | null): Commitment {
    const source = sourceFrom(src, text);
    if (!text) return newCommitment({ source, title: '' });
    const p = parseCapture(text);
    const hat = suggestHat(t.hats, p.forWhom, p.quote, source);
    return newCommitment({ source, title: p.title, forWhom: p.forWhom, due: p.due, sourceText: p.quote, hatId: hat?.id || null });
  }

  const fit = useMemo(() => (draft ? fitCheck(t.ctx, draft) : null), [draft, t.ctx]);
  if (!draft || !fit) return null;
  const set = (p: Partial<Commitment>) => setDraft({ ...draft, ...p });
  const hat = t.hatById(draft.hatId);
  const adj = adjusted(draft, t.ctx.factor);
  const now = t.ctx.now;
  const friday = addDays(startOfDay(now), (5 - now.getDay() + 7) % 7 || 7);
  const dueChips: [string, string | null][] = [
    ['Today', atHour(now, 18).toISOString()],
    ['Tomorrow', atHour(addDays(now, 1), 18).toISOString()],
    [DAY_SHORT[friday.getDay()], atHour(friday, 18).toISOString()],
    ['Next week', nextWeekDue(now).toISOString()],
    ['No date', null]
  ];

  async function paste() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return toast('Clipboard is empty');
      const d = fromText(text, params.get('source') || 'whatsapp');
      setDraft({ ...d, id: draft!.id });
    } catch {
      toast('Allow paste, or long-press the title box → Paste');
    }
  }

  function startMic() {
    const W = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const Ctor = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!Ctor) {
      toast('Tap the title, then the 🎙️ on your keyboard');
      return;
    }
    const rec = new Ctor();
    rec.lang = navigator.language || 'en-GB';
    rec.interimResults = false;
    rec.continuous = true;
    let said = '';
    rec.onresult = (e) => {
      said = Array.from(e.results as ArrayLike<ArrayLike<{ transcript: string }>>)
        .map((r) => r[0].transcript)
        .join(' ');
    };
    rec.onend = () => {
      setListening(false);
      if (said.trim()) {
        const d = fromText(said, 'call');
        setDraft((cur) => ({ ...d, id: cur!.id, sourceText: said }));
      }
    };
    recRef.current = rec;
    setListening(true);
    rec.start();
  }
  function stopMic() {
    recRef.current?.stop();
  }

  async function rememberPerson() {
    if (!hat || !draft!.forWhom) return;
    const people = new Set([...(hat.people || []), draft!.forWhom]);
    await put('hat', { ...hat, people: [...people] });
  }

  async function commit() {
    const slot = fit!.slot && !fit!.slot.partial ? { start: fit!.slot.start.toISOString(), end: fit!.slot.end.toISOString() } : null;
    await saveCommitment(draft!, { title: draft!.title.trim() || 'New promise', status: 'open', committedAt: new Date().toISOString(), slot });
    await rememberPerson();
    toast(slot ? `Committed ✓ Planned ${DAY_SHORT[fit!.slot!.start.getDay()]} ${fmtRange(fit!.slot!.start, fit!.slot!.end)}` : 'Committed ✓');
    nav('/', { replace: true });
  }
  async function later() {
    await saveCommitment(draft!, { title: draft!.title.trim() || 'New promise', status: 'inbox' });
    await rememberPerson();
    toast('Saved to Inbox — not promised yet');
    nav(-1);
  }

  const [emoji] = SOURCE_EMOJI[draft.source] || SOURCE_EMOJI.manual;
  const slotLabel = fit.slot ? `${DAY_SHORT[fit.slot.start.getDay()]} ${fmtRange(fit.slot.start, fit.slot.end)}${fit.slot.partial ? ' + more' : ''}` : '';

  return (
    <div className="overlay" style={{ alignItems: 'flex-end' }} onClick={() => nav(-1)}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="grabber" />
        <div className="row between">
          <span className="heading">{existing ? 'Sort this promise' : 'New promise ✍️'}</span>
          <div className="row gap-8">
            <span className="pill">
              {emoji} {SOURCE_LABEL[draft.source]}
            </span>
            <button className="icon-btn sm" aria-label="Close" onClick={() => nav(-1)}>
              <Icon name="x" size={16} />
            </button>
          </div>
        </div>

        {draft.sourceText ? (
          <div className="panel bg-sunken small muted">
            {draft.forWhom ? `${draft.forWhom}: ` : ''}“{draft.sourceText.length > 140 ? draft.sourceText.slice(0, 137) + '…' : draft.sourceText}”
          </div>
        ) : (
          !existing && (
            <button className="panel bg-sunken" onClick={paste}>
              <span>📋</span>
              <span className="strong fill" style={{ textAlign: 'left' }}>
                Paste message
              </span>
              <span className="small muted">from WhatsApp, Slack…</span>
            </button>
          )
        )}

        <input className="input big" style={{ borderColor: 'var(--mark)' }} placeholder="What are you promising?" value={draft.title} onChange={(e) => set({ title: e.target.value })} autoFocus={!draft.title} />

        <div className="scroll-x">
          {t.hats.map((h) => (
            <button key={h.id} className={`pill ${draft.hatId === h.id ? 'on' : ''}`} onClick={() => set({ hatId: h.id })}>
              <span className="dot" style={{ background: draft.hatId === h.id ? '#fff' : h.color }} />
              {h.emoji} {h.name}
            </button>
          ))}
        </div>

        <div className="col gap-8">
          <span className="field-label">Due {draft.due ? `· ${fmtDue(draft.due, now)}` : ''}</span>
          <div className="scroll-x">
            {dueChips.map(([l, iso]) => (
              <button key={l} className={`pill ${(draft.due || null) === iso ? 'on' : ''}`} onClick={() => set({ due: iso })}>
                📅 {l}
              </button>
            ))}
            <label className="pill" style={{ position: 'relative' }}>
              Pick…
              <input
                type="datetime-local"
                value={toLocalInput(draft.due)}
                onChange={(e) => set({ due: e.target.value ? new Date(e.target.value).toISOString() : null })}
                style={{ position: 'absolute', inset: 0, opacity: 0 }}
              />
            </label>
          </div>
        </div>

        <input className="input" placeholder="👤 For whom? (optional)" value={draft.forWhom || ''} onChange={(e) => set({ forWhom: e.target.value })} />

        <div className="col gap-8">
          <span className="field-label">How long will it take?</span>
          <div className="row wrap gap-8">
            {ESTIMATES.map((m) => (
              <button key={m} className={`pill ${draft.estimateMin === m ? 'on' : ''}`} onClick={() => set({ estimateMin: m })}>
                {fmtDur(m)}
              </button>
            ))}
            {t.ctx.factor !== 1 && (
              <span className="pill bg-mark-soft c-mark">
                <span className="strike muted">{fmtDur(draft.estimateMin)}</span> → {fmtDur(adj)} ✨
              </span>
            )}
          </div>
        </div>

        {fit.fits ? (
          <div className="panel bg-lime-soft">
            <Icon name="check" size={18} color="var(--ok)" stroke={2.4} />
            <span className="strong c-ok">Fits · {slotLabel}</span>
          </div>
        ) : (
          <button className="panel bg-risk-soft" onClick={() => nav('/week/resolve')}>
            <Icon name="alert" size={18} color="var(--risk)" stroke={2} />
            <span className="strong c-risk fill" style={{ textAlign: 'left' }}>
              Tight · {fmtDur(fit.freeMin)} free{draft.due ? ' before it’s due' : ' this week'}
            </span>
            <span className="small c-risk">What gives?</span>
          </button>
        )}
        {hat && fit.hatBudgetMin > 0 && fit.hatLoadMin > fit.hatBudgetMin && (
          <span className="small c-warn">
            {hat.emoji} {hat.name} would be at {fmtDur(fit.hatLoadMin)} of {fmtDur(fit.hatBudgetMin)} this week
          </span>
        )}

        <div className="row gap-8">
          <button className="btn secondary fill" onClick={later}>
            Later
          </button>
          <button className="btn primary fill" onClick={commit} disabled={!draft.title.trim()}>
            Commit ✓
          </button>
        </div>
        <div className="col center gap-4">
          <button
            className="fab"
            style={{ transform: listening ? 'scale(1.12)' : undefined, transition: 'transform .2s' }}
            aria-label="Hold to speak"
            onPointerDown={startMic}
            onPointerUp={stopMic}
            onPointerLeave={() => listening && stopMic()}
            onContextMenu={(e) => e.preventDefault()}
          >
            <Icon name="mic" size={26} stroke={2} />
          </button>
          <span className="label muted">{listening ? 'Listening… let go when done' : 'Hold to speak'}</span>
        </div>
      </div>
    </div>
  );
}
