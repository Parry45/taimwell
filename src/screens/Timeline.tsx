import { useNavigate } from 'react-router-dom';
import { useTaim } from '../lib/hooks';
import { subtract, windows } from '../lib/capacity';
import { endOfDay, fmtDur, fmtRange, isSameDay, startOfDay } from '../lib/time';
import { Back } from '../components/ui';

interface Item {
  s: number;
  e: number;
  label: string;
  color: string;
  kind: 'meeting' | 'plan' | 'free';
  id?: string;
}

export default function Timeline() {
  const t = useTaim();
  const nav = useNavigate();
  const now = t.ctx.now;
  const day0 = startOfDay(now).getTime();
  const day1 = endOfDay(now).getTime();
  const enabled = new Set(t.calendars.filter((c) => c.enabled).map((c) => c.id));
  const items: Item[] = [];
  for (const e of t.events) {
    const s = new Date(e.start).getTime();
    const en = new Date(e.end).getTime();
    if (!enabled.has(e.calendarId) || en <= day0 || s >= day1) continue;
    const cal = t.calendars.find((c) => c.id === e.calendarId);
    const hat = t.hatById(cal?.hatId);
    items.push({ s, e: en, label: e.title, color: hat?.color || cal?.color || '#94A3B7', kind: 'meeting' });
  }
  for (const c of t.commitments) {
    if (c.status !== 'open' || !c.slot || !isSameDay(new Date(c.slot.start), now)) continue;
    const hat = t.hatById(c.hatId);
    items.push({ s: new Date(c.slot.start).getTime(), e: new Date(c.slot.end).getTime(), label: c.title, color: hat?.color || '#4338CA', kind: 'plan', id: c.id });
  }
  const busy = items.map((i) => ({ s: i.s, e: i.e }));
  const free = subtract(windows(t.settings, startOfDay(now), endOfDay(now)), busy).filter((f) => f.e - f.s >= 15 * 60_000);
  for (const f of free) items.push({ s: f.s, e: f.e, label: 'Free', color: 'var(--lime)', kind: 'free' });
  items.sort((a, b) => a.s - b.s);

  return (
    <div className="page no-tab">
      <Back label="Today" to="/" />
      <h1 className="display">Today's timeline</h1>
      <div className="card gap-12">
        {items.length === 0 && <span className="muted">Nothing planned and no availability set for today. Rest day? 🌴</span>}
        {items.map((i, k) => (
          <button key={k} className="row" style={{ textAlign: 'left', opacity: i.e < now.getTime() ? 0.45 : 1 }} onClick={() => i.id && nav(`/focus/${i.id}`)}>
            <span className="mono muted" style={{ width: 92, flex: 'none' }}>
              {fmtRange(new Date(i.s), new Date(i.e))}
            </span>
            <span style={{ width: 3, alignSelf: 'stretch', minHeight: 20, borderRadius: 2, background: i.color, flex: 'none' }} />
            <span className={`fill ${i.kind === 'free' ? 'c-ok strong' : ''}`}>
              {i.kind === 'meeting' ? '📅 ' : i.kind === 'plan' ? '🎯 ' : '🌿 '}
              {i.label}
              {i.kind === 'free' ? ` · ${fmtDur((i.e - i.s) / 60_000)}` : ''}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
