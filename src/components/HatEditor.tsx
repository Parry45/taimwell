import { useEffect, useState } from 'react';
import type { Hat, HatKind } from '../lib/types';
import { HAT_COLORS } from '../lib/types';
import { put, remove } from '../lib/db';
import { Sheet, Sticker } from './ui';

export function Stepper({ value, onChange, step = 1, min = 0, max = 80, suffix = 'h' }: { value: number; onChange: (n: number) => void; step?: number; min?: number; max?: number; suffix?: string }) {
  return (
    <div className="row gap-8">
      <button className="icon-btn sm" aria-label="Less" onClick={() => onChange(Math.max(min, value - step))}>
        −
      </button>
      <span className="mono" style={{ minWidth: 44, textAlign: 'center' }}>
        {value}
        {suffix}
      </span>
      <button className="icon-btn sm" aria-label="More" onClick={() => onChange(Math.min(max, value + step))}>
        +
      </button>
    </div>
  );
}

const KINDS: [HatKind, string][] = [
  ['job', '💼 Job'],
  ['business', '🏪 Business'],
  ['gig', '⚡ Gig'],
  ['other', '✨ Other']
];

export default function HatEditor({ hat, onClose, canDelete = true }: { hat: Hat | null; onClose: () => void; canDelete?: boolean }) {
  const [h, setH] = useState<Hat | null>(hat);
  useEffect(() => setH(hat), [hat]);
  if (!h) return null;
  const set = (p: Partial<Hat>) => setH({ ...h, ...p });
  return (
    <Sheet open={!!hat} onClose={onClose}>
      <div className="row between">
        <span className="heading">Edit hat</span>
        <Sticker emoji={h.emoji || '🎩'} color={h.color} size={44} />
      </div>
      <div className="row gap-8">
        <input className="input" style={{ width: 72, textAlign: 'center', fontSize: 22 }} value={h.emoji} maxLength={4} onChange={(e) => set({ emoji: e.target.value })} aria-label="Emoji" />
        <input className="input big" value={h.name} onChange={(e) => set({ name: e.target.value })} placeholder="Name" aria-label="Name" />
      </div>
      <div className="chips">
        {KINDS.map(([k, l]) => (
          <button key={k} className={`pill ${h.kind === k ? 'on' : ''}`} onClick={() => set({ kind: k })}>
            {l}
          </button>
        ))}
      </div>
      <div className="row between">
        <span className="strong">Hours per week</span>
        <Stepper value={h.budgetH} onChange={(n) => set({ budgetH: n })} />
      </div>
      <div className="chips">
        {HAT_COLORS.map((c) => (
          <button
            key={c}
            aria-label={`Colour ${c}`}
            onClick={() => set({ color: c })}
            style={{ width: 32, height: 32, borderRadius: 999, background: c, boxShadow: h.color === c ? `0 0 0 3px #fff, 0 0 0 5px ${c}` : 'none' }}
          />
        ))}
      </div>
      <div className="row gap-8">
        {canDelete && (
          <button
            className="btn danger"
            onClick={async () => {
              await remove(h.id);
              onClose();
            }}
          >
            Delete
          </button>
        )}
        <button
          className="btn primary fill"
          onClick={async () => {
            await put('hat', { ...h, name: h.name.trim() || 'Untitled hat' });
            onClose();
          }}
        >
          Save
        </button>
      </div>
    </Sheet>
  );
}
