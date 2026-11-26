import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import type { Commitment, Hat } from '../lib/types';
import { fmtDur } from '../lib/time';

// ------------------------------------------------------------ icons
const PATHS: Record<string, string> = {
  home: 'M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z',
  cal: 'M3.5 7a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2zM3.5 10h17M8 3v4M16 3v4',
  inbox: 'M3 13h5l1.5 3h5L16 13h5M5.5 5h13L21 13v6H3v-6z',
  review: 'M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5',
  plus: 'M12 5v14M5 12h14',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  chev: 'm9 18 6-6-6-6',
  back: 'm15 18-6-6 6-6',
  bell: 'M6 16v-5a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0',
  mic: 'M9 6a3 3 0 0 1 6 0v5a3 3 0 0 1-6 0zM5 11a7 7 0 0 0 14 0M12 18v3',
  alert: 'M12 3 2 20h20zM12 10v4M12 17v.5',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7z',
  x: 'M6 6l12 12M18 6 6 18',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  sparkle: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6',
  trash: 'M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3',
  play: 'M7 4v16l13-8z',
  pause: 'M9 5v14M15 5v14',
  share: 'M12 3v12M7 8l5-5 5 5M5 13v6h14v-6',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4'
};

export function Icon({ name, size = 22, stroke = 1.8, color = 'currentColor' }: { name: keyof typeof PATHS | string; size?: number; stroke?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATHS[name] || ''} />
    </svg>
  );
}

// ------------------------------------------------------------ small pieces
export function tint(hex: string, alpha: number): string {
  const v = hex.replace('#', '');
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function Sticker({ emoji, color = '#4338CA', size = 44, alpha = 0.14, solid }: { emoji: string; color?: string; size?: number; alpha?: number; solid?: boolean }) {
  return (
    <span className="sticker" style={{ width: size, height: size, background: solid ? color : tint(color, alpha), fontSize: Math.round(size * 0.48) }}>
      {emoji}
    </span>
  );
}

export function HatChip({ hat, label }: { hat?: Hat; label?: string }) {
  return (
    <span className="pill">
      <span className="dot" style={{ background: hat?.color || '#94A3B7' }} />
      {label || hat?.name || 'No hat'}
    </span>
  );
}

export function Bar({ segs, height = 10, bg }: { segs: [number, string][]; height?: number; bg?: string }) {
  return (
    <div className="bar" style={{ height, background: bg }}>
      {segs
        .filter(([f]) => f > 0)
        .map(([f, c], i) => (
          <span key={i} style={{ width: `${Math.min(100, f * 100)}%`, background: c }} />
        ))}
    </div>
  );
}

export function Ring({ pct, size = 76, color = '#4338CA', track = '#fff' }: { pct: number; size?: number; color?: string; track?: string }) {
  const r = size / 2 - 5;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={8} fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={color}
        strokeWidth={8}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${c * Math.max(0.001, Math.min(1, pct))} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

export function Steps({ n, of = 3 }: { n: number; of?: number }) {
  return (
    <div className="steps">
      {Array.from({ length: of }, (_, i) => (
        <span key={i} className={`${i < n ? 'on' : ''} ${i === n - 1 ? 'cur' : ''}`} />
      ))}
    </div>
  );
}

export function Back({ label, to }: { label: string; to?: string }) {
  const nav = useNavigate();
  return (
    <button className="row" onClick={() => (to ? nav(to) : nav(-1))} style={{ alignSelf: 'flex-start' }}>
      <span className="icon-btn sm">
        <Icon name="back" size={18} />
      </span>
      <span className="strong">{label}</span>
    </button>
  );
}

export function TaskRow({ c, hat, meta, onClick, right }: { c: Commitment; hat?: Hat; meta: string; onClick?: () => void; right?: ReactNode }) {
  return (
    <button className={`task ${c.status === 'done' ? 'done' : ''}`} onClick={onClick} style={{ width: '100%', textAlign: 'left' }}>
      <span className="hatbar" style={{ background: hat?.color || '#94A3B7' }} />
      <span className="col gap-4 fill">
        <span className="strong title">{c.title}</span>
        <span className="small muted ellipsis">{meta}</span>
      </span>
      {right ?? <span className="mono muted">{fmtDur(c.estimateMin)}</span>}
    </button>
  );
}

export function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="grabber" />
        {children}
      </div>
    </div>
  );
}

export function TabBar() {
  const nav = useNavigate();
  const link = (to: string, icon: string, label: string) => (
    <NavLink to={to} end={to === '/'} aria-label={label} className={({ isActive }) => (isActive ? 'active' : '')}>
      <Icon name={icon} size={22} />
    </NavLink>
  );
  return (
    <nav className="tabbar">
      <div className="navpill">
        {link('/', 'home', 'Today')}
        {link('/week', 'cal', 'Week')}
        {link('/inbox', 'inbox', 'Inbox')}
        {link('/review', 'review', 'Review')}
      </div>
      <button className="fab" aria-label="Capture a promise" onClick={() => nav('/capture')}>
        <Icon name="plus" size={26} stroke={2.2} />
      </button>
    </nav>
  );
}

export function Confetti({ count = 60 }: { count?: number }) {
  const bits = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.8,
        dur: 2.4 + Math.random() * 2,
        w: 6 + Math.random() * 6,
        h: 4 + Math.random() * 4,
        c: ['#BFFB57', '#FFFFFF', '#F97316', '#D946A8', '#14A39A', '#FEF3C7'][i % 6],
        round: Math.random() > 0.6
      })),
    [count]
  );
  return (
    <div className="confetti">
      {bits.map((b, i) => (
        <i
          key={i}
          style={{
            left: `${b.left}%`,
            width: b.round ? b.w : b.w * 1.8,
            height: b.round ? b.w : b.h,
            borderRadius: b.round ? '50%' : 2,
            background: b.c,
            animationDuration: `${b.dur}s`,
            animationDelay: `${b.delay}s`
          }}
        />
      ))}
    </div>
  );
}

// ------------------------------------------------------------ toast
const ToastCtx = createContext<(msg: string) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2600);
    return () => clearTimeout(t);
  }, [msg]);
  const show = useCallback((m: string) => setMsg(m), []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && <div className="toast">{msg}</div>}
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

export const SOURCE_EMOJI: Record<string, [string, string]> = {
  whatsapp: ['💬', '#25D366'],
  slack: ['🗨️', '#4338CA'],
  email: ['✉️', '#0C79BA'],
  monday: ['📋', '#F97316'],
  call: ['📞', '#D946A8'],
  manual: ['✍️', '#64748A']
};
export const SOURCE_LABEL: Record<string, string> = {
  whatsapp: 'WhatsApp',
  slack: 'Slack',
  email: 'Email',
  monday: 'Monday',
  call: 'Call',
  manual: 'Typed'
};
