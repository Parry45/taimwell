import { useEffect, useMemo, useState } from 'react';
import { put, uid, useRows } from './db';
import { Ctx, Risk, makeCtx, risks } from './capacity';
import type { CalendarRec, Commitment, EventRec, Hat, Settings } from './types';
import { DEFAULT_SETTINGS } from './types';

export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export interface Taim {
  ready: boolean;
  hats: Hat[];
  commitments: Commitment[];
  settings: Settings;
  calendars: CalendarRec[];
  events: EventRec[];
  ctx: Ctx;
  rk: Map<string, Risk>;
  hatById: (id?: string | null) => Hat | undefined;
}

export function pickSettings(rows: Settings[] | undefined): Settings | undefined {
  if (!rows || !rows.length) return undefined;
  return [...rows].sort((a, b) => Number(b.onboarded) - Number(a.onboarded))[0];
}

export function useTaim(): Taim {
  const hatsR = useRows<Hat>('hat');
  const csR = useRows<Commitment>('commitment');
  const stR = useRows<Settings>('settings');
  const calR = useRows<CalendarRec>('calendar');
  const evR = useRows<EventRec>('event');
  const now = useNow();
  const ready = !!(hatsR && csR && stR && calR && evR);
  const hats = useMemo(() => [...(hatsR || [])].sort((a, b) => a.order - b.order), [hatsR]);
  const commitments = useMemo(() => csR || [], [csR]);
  const settings = useMemo(() => pickSettings(stR) || ({ id: 'pending', ...DEFAULT_SETTINGS } as Settings), [stR]);
  const calendars = useMemo(() => calR || [], [calR]);
  const events = useMemo(() => evR || [], [evR]);
  const ctx = useMemo(
    () => makeCtx({ now, settings, hats, commitments, events, calendars }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [now, settings, hats, commitments, events, calendars]
  );
  const rk = useMemo(() => risks(ctx), [ctx]);
  return {
    ready,
    hats,
    commitments,
    settings,
    calendars,
    events,
    ctx,
    rk,
    hatById: (id) => hats.find((h) => h.id === id)
  };
}

export async function saveSettings(s: Settings, patch: Partial<Settings>) {
  const id = s.id && s.id !== 'pending' ? s.id : uid();
  await put('settings', { ...s, ...patch, id });
}

export async function saveCommitment(c: Commitment, patch: Partial<Commitment> = {}) {
  await put('commitment', { ...c, ...patch });
}

export function newCommitment(p: Partial<Commitment>): Commitment {
  return {
    id: uid(),
    title: 'New promise',
    hatId: null,
    source: 'manual',
    estimateMin: 60,
    status: 'inbox',
    createdAt: new Date().toISOString(),
    actualMin: 0,
    interruptions: [],
    slot: null,
    due: null,
    ...p
  };
}
