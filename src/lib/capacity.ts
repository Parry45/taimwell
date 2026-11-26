// The maths behind Taimwell: real free time, honest estimates, fit checks and risk.
import type { CalendarRec, Commitment, EventRec, Hat, Settings, SlipReason } from './types';
import { MIN, addDays, addMin, atHour, endOfDay, endOfWeek, isSameDay, startOfDay, startOfWeek } from './time';

export interface Interval {
  s: number;
  e: number;
}

export interface Ctx {
  now: Date;
  settings: Settings;
  hats: Hat[];
  commitments: Commitment[];
  busy: Interval[];
  factor: number;
  samples: number;
}

// ------------------------------------------------------------ estimates

export function estimateFactor(cs: Commitment[]): { factor: number; samples: number } {
  const done = cs
    .filter((c) => c.status === 'done' && c.actualMin > 0 && c.estimateMin > 0)
    .sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || ''))
    .slice(0, 20);
  if (done.length < 3) return { factor: 1, samples: done.length };
  const est = done.reduce((a, c) => a + c.estimateMin, 0);
  const act = done.reduce((a, c) => a + c.actualMin, 0);
  const f = Math.min(3, Math.max(0.75, act / est));
  return { factor: Math.round(f * 10) / 10, samples: done.length };
}

export function adjusted(c: Pick<Commitment, 'estimateMin'>, f: number): number {
  return Math.max(5, Math.round((c.estimateMin * f) / 5) * 5);
}

export function remaining(c: Commitment, f: number): number {
  return Math.max(0, adjusted(c, f) - (c.actualMin || 0));
}

// ------------------------------------------------------------ free time

/** The hours you are actually available (9–5, evenings, weekend blocks), clipped to [from, to). */
export function windows(st: Settings, from: Date, to: Date): Interval[] {
  const out: Interval[] = [];
  const f = from.getTime();
  const t = to.getTime();
  let d = startOfDay(from);
  while (d.getTime() < t) {
    const dow = d.getDay();
    const day = d;
    const push = (h1: number, h2: number) => {
      const s = Math.max(atHour(day, h1).getTime(), f);
      const e = Math.min(atHour(day, h2).getTime(), t);
      if (e > s) out.push({ s, e });
    };
    if (st.workdays.includes(dow)) {
      push(st.workStart, st.workEnd);
      if (st.eveningHours > 0) push(st.eveningStart, st.eveningStart + st.eveningHours);
    } else if (dow === 6) {
      if (st.saturdayHours > 0) push(st.saturdayStart, st.saturdayStart + st.saturdayHours);
    } else if (dow === 0) {
      if (st.sundayHours > 0) push(st.sundayStart, Math.min(st.sundayStart + st.sundayHours, st.restSundayAfter));
    }
    d = addDays(d, 1);
  }
  return out;
}

export function subtract(ws: Interval[], busy: Interval[]): Interval[] {
  const b = [...busy].sort((x, y) => x.s - y.s);
  const out: Interval[] = [];
  for (const w of ws) {
    let segs: Interval[] = [w];
    for (const x of b) {
      if (x.e <= w.s || x.s >= w.e) continue;
      const next: Interval[] = [];
      for (const sg of segs) {
        if (x.e <= sg.s || x.s >= sg.e) {
          next.push(sg);
          continue;
        }
        if (x.s > sg.s) next.push({ s: sg.s, e: x.s });
        if (x.e < sg.e) next.push({ s: x.e, e: sg.e });
      }
      segs = next;
    }
    out.push(...segs);
  }
  return out;
}

export function sumMin(iv: Interval[]): number {
  return iv.reduce((a, i) => a + (i.e - i.s) / MIN, 0);
}

export function busyFromEvents(events: EventRec[], calendars: CalendarRec[]): Interval[] {
  const on = new Set(calendars.filter((c) => c.enabled).map((c) => c.id));
  return events
    .filter((e) => on.has(e.calendarId))
    .map((e) => ({ s: new Date(e.start).getTime(), e: new Date(e.end).getTime() }))
    .filter((i) => i.e > i.s);
}

export function meetingMin(ctx: Ctx, from: Date, to: Date): number {
  const f = from.getTime();
  const t = to.getTime();
  return ctx.busy.reduce((a, b) => a + Math.max(0, Math.min(b.e, t) - Math.max(b.s, f)) / MIN, 0);
}

export function freeBetween(ctx: Ctx, from: Date, to: Date): number {
  if (to <= from) return 0;
  return sumMin(subtract(windows(ctx.settings, from, to), ctx.busy));
}

export function makeCtx(p: {
  now: Date;
  settings: Settings;
  hats: Hat[];
  commitments: Commitment[];
  events: EventRec[];
  calendars: CalendarRec[];
}): Ctx {
  const { factor, samples } = estimateFactor(p.commitments);
  return {
    now: p.now,
    settings: p.settings,
    hats: p.hats,
    commitments: p.commitments,
    busy: busyFromEvents(p.events, p.calendars),
    factor,
    samples
  };
}

// ------------------------------------------------------------ risk

export interface Risk {
  needed: number;
  free: number;
  late: boolean;
  atRisk: boolean;
}

/** Earliest-deadline-first feasibility: is there enough free time for each promise, given the ones due before it? */
export function risks(ctx: Ctx): Map<string, Risk> {
  const res = new Map<string, Risk>();
  const open = ctx.commitments
    .filter((c) => c.status === 'open' && c.due)
    .sort((a, b) => a.due!.localeCompare(b.due!));
  let cum = 0;
  for (const c of open) {
    const due = new Date(c.due!);
    const need = remaining(c, ctx.factor);
    if (due <= ctx.now) {
      res.set(c.id, { needed: need, free: 0, late: true, atRisk: need > 0 });
      cum += need;
      continue;
    }
    const free = freeBetween(ctx, ctx.now, due);
    const forThis = Math.max(0, free - cum);
    cum += need;
    res.set(c.id, { needed: need, free: forThis, late: false, atRisk: need > forThis });
  }
  return res;
}

// ------------------------------------------------------------ slots & fit

export interface SlotResult {
  start: Date;
  end: Date;
  partial: boolean;
}

export function findSlot(ctx: Ctx, needMin: number, due?: Date | null, excludeId?: string): SlotResult | null {
  const horizon = due && due > ctx.now ? due : addDays(ctx.now, 14);
  const taken: Interval[] = ctx.commitments
    .filter((c) => c.status === 'open' && c.slot && c.id !== excludeId)
    .map((c) => ({ s: new Date(c.slot!.start).getTime(), e: new Date(c.slot!.end).getTime() }));
  const free = subtract(windows(ctx.settings, ctx.now, horizon), [...ctx.busy, ...taken]).filter((i) => i.e - i.s >= 10 * MIN);
  const whole = free.find((i) => (i.e - i.s) / MIN >= needMin);
  if (whole) return { start: new Date(whole.s), end: addMin(new Date(whole.s), needMin), partial: false };
  if (sumMin(free) >= needMin && free.length) return { start: new Date(free[0].s), end: new Date(free[0].e), partial: true };
  return null;
}

export interface Fit {
  fits: boolean;
  needMin: number;
  slot: SlotResult | null;
  freeMin: number;
  hatLoadMin: number;
  hatBudgetMin: number;
}

export function fitCheck(ctx: Ctx, draft: { estimateMin: number; due?: string | null; hatId?: string | null; id?: string }): Fit {
  const needMin = adjusted(draft, ctx.factor);
  const due = draft.due ? new Date(draft.due) : null;
  let freeMin: number;
  if (due) {
    const ahead = ctx.commitments
      .filter((c) => c.status === 'open' && c.id !== draft.id && c.due && new Date(c.due) <= due)
      .reduce((a, c) => a + remaining(c, ctx.factor), 0);
    freeMin = Math.max(0, freeBetween(ctx, ctx.now, due) - ahead);
  } else {
    freeMin = freeBetween(ctx, ctx.now, addDays(ctx.now, 7));
  }
  const slot = findSlot(ctx, needMin, due, draft.id);
  const wk = weekSummary(ctx);
  const hw = wk.perHat.find((h) => h.hat.id === draft.hatId);
  return {
    fits: needMin <= freeMin && !!slot,
    needMin,
    slot,
    freeMin,
    hatLoadMin: (hw?.committed || 0) + needMin,
    hatBudgetMin: hw?.budget || 0
  };
}

// ------------------------------------------------------------ week

export interface HatWeek {
  hat: Hat;
  committed: number;
  budget: number;
}

export interface WeekSummary {
  start: Date;
  end: Date;
  available: number;
  committed: number;
  over: number;
  meetings: number;
  perHat: HatWeek[];
}

function inWeekLoad(c: Commitment, ctx: Ctx, start: Date, end: Date): number {
  if (c.status === 'open') {
    const due = c.due ? new Date(c.due) : null;
    const slotIn = c.slot && new Date(c.slot.start) < end && new Date(c.slot.start) >= start;
    if ((due && due < end) || slotIn) return remaining(c, ctx.factor);
    return 0;
  }
  if (c.status === 'done' && c.doneAt) {
    const d = new Date(c.doneAt);
    if (d >= start && d < end) return c.actualMin || adjusted(c, ctx.factor);
  }
  return 0;
}

export function weekSummary(ctx: Ctx, ref?: Date): WeekSummary {
  const start = startOfWeek(ref || ctx.now);
  const end = endOfWeek(ref || ctx.now);
  const available = freeBetween(ctx, start, end);
  const perHat: HatWeek[] = ctx.hats.map((hat) => ({
    hat,
    budget: hat.budgetH * 60,
    committed: ctx.commitments.filter((c) => c.hatId === hat.id).reduce((a, c) => a + inWeekLoad(c, ctx, start, end), 0)
  }));
  const unassigned = ctx.commitments.filter((c) => !c.hatId).reduce((a, c) => a + inWeekLoad(c, ctx, start, end), 0);
  const committed = perHat.reduce((a, h) => a + h.committed, 0) + unassigned;
  return {
    start,
    end,
    available,
    committed,
    over: Math.max(0, committed - available),
    meetings: meetingMin(ctx, start, end),
    perHat
  };
}

// ------------------------------------------------------------ today

export interface TodayView {
  list: Commitment[];
  doneCount: number;
  freeMin: number;
  loadMin: number;
  slackMin: number;
  riskCount: number;
}

export function sortOpen(ctx: Ctx, rk: Map<string, Risk>): Commitment[] {
  return ctx.commitments
    .filter((c) => c.status === 'open')
    .sort((a, b) => {
      const ra = rk.get(a.id)?.atRisk ? 0 : 1;
      const rb = rk.get(b.id)?.atRisk ? 0 : 1;
      if (ra !== rb) return ra - rb;
      const da = a.due || a.slot?.start || '9999';
      const dbb = b.due || b.slot?.start || '9999';
      if (da !== dbb) return da.localeCompare(dbb);
      return a.createdAt.localeCompare(b.createdAt);
    });
}

export function todayView(ctx: Ctx, rk: Map<string, Risk>): TodayView {
  const now = ctx.now;
  const eod = endOfDay(now);
  const doneToday = ctx.commitments.filter((c) => c.status === 'done' && c.doneAt && isSameDay(new Date(c.doneAt), now));
  const open = sortOpen(ctx, rk);
  const list = [...doneToday.slice(0, 3), ...open].slice(0, Math.max(3, Math.min(doneToday.length, 3)));
  const todays = open.filter(
    (c) => (c.due && new Date(c.due) < eod) || (c.slot && isSameDay(new Date(c.slot.start), now))
  );
  const loadMin = todays.reduce((a, c) => a + remaining(c, ctx.factor), 0);
  const freeMin = freeBetween(ctx, now, eod);
  return {
    list,
    doneCount: Math.min(3, doneToday.length),
    freeMin,
    loadMin,
    slackMin: freeMin - loadMin,
    riskCount: [...rk.values()].filter((r) => r.atRisk).length
  };
}

export type DayDot = 'ok' | 'warn' | 'risk' | 'none' | 'rest';

export function weekDots(ctx: Ctx, rk: Map<string, Risk>): { date: Date; dot: DayDot }[] {
  const start = startOfWeek(ctx.now);
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i);
    const next = addDays(date, 1);
    const due = ctx.commitments.filter((c) => c.status === 'open' && c.due && new Date(c.due) >= date && new Date(c.due) < next);
    let dot: DayDot = 'none';
    if (due.some((c) => rk.get(c.id)?.atRisk)) dot = 'risk';
    else if (due.length) {
      const load = due.reduce((a, c) => a + remaining(c, ctx.factor), 0);
      const free = freeBetween(ctx, date < ctx.now ? ctx.now : date, next);
      dot = load > free ? 'warn' : 'ok';
    } else if (date.getDay() === 0) dot = 'rest';
    return { date, dot };
  });
}

// ------------------------------------------------------------ what gives

export type GiveAction = 'move' | 'delegate' | 'renegotiate' | 'drop';
export interface GiveOption {
  c: Commitment;
  action: GiveAction;
  gain: number;
}

export function giveOptions(ctx: Ctx): GiveOption[] {
  const wk = weekSummary(ctx);
  const hatOf = (id: string | null) => ctx.hats.find((h) => h.id === id);
  return ctx.commitments
    .filter((c) => c.status === 'open')
    .map((c) => ({ c, gain: inWeekLoad(c, ctx, wk.start, wk.end) }))
    .filter((x) => x.gain > 0)
    .map(({ c, gain }) => {
      const hat = hatOf(c.hatId);
      let action: GiveAction;
      if (!c.due) action = 'move';
      else if (c.forWhom) action = 'renegotiate';
      else if (hat?.kind === 'gig') action = 'drop';
      else if (hat?.kind === 'job') action = 'delegate';
      else action = 'move';
      return { c, action, gain };
    })
    .sort((a, b) => {
      const order: Record<GiveAction, number> = { move: 0, delegate: 1, renegotiate: 2, drop: 3 };
      return order[a.action] - order[b.action] || b.gain - a.gain;
    });
}

/** Next Monday at 6pm — the default "move it to next week" date. */
export function nextWeekDue(now: Date): Date {
  return atHour(endOfWeek(now), 18);
}

// ------------------------------------------------------------ streaks & review

export function dayKept(cs: Commitment[], day: Date, now: Date): 'kept' | 'missed' | 'empty' | 'future' {
  const s = startOfDay(day);
  const e = addDays(s, 1);
  if (s > now) return 'future';
  const dueThatDay = cs.filter((c) => c.due && new Date(c.due) >= s && new Date(c.due) < e && (c.status === 'open' || c.status === 'done'));
  const missed = dueThatDay.some((c) =>
    c.status === 'open' ? new Date(c.due!) < now : !!c.doneAt && new Date(c.doneAt) > new Date(c.due!)
  );
  if (missed) return 'missed';
  const done = cs.some((c) => c.status === 'done' && c.doneAt && new Date(c.doneAt) >= s && new Date(c.doneAt) < e);
  return done ? 'kept' : 'empty';
}

export function streak(cs: Commitment[], now: Date): number {
  let n = 0;
  for (let i = 0; i < 90; i++) {
    const k = dayKept(cs, addDays(now, -i), now);
    if (k === 'missed') break;
    if (k === 'kept') n++;
  }
  return n;
}

export interface ReviewData {
  start: Date;
  end: Date;
  kept: Commitment[];
  onTimePct: number;
  interruptions: number;
  slipped: { c: Commitment; reason: SlipReason }[];
  topReason: SlipReason | null;
}

export function autoReason(c: Commitment): SlipReason {
  if (c.slipReason) return c.slipReason;
  if (c.actualMin > c.estimateMin * 1.3) return 'underestimated';
  if ((c.interruptions || []).length >= 2) return 'interrupted';
  if (c.due && c.createdAt > c.due) return 'never_captured';
  return 'too_much';
}

export function review(ctx: Ctx): ReviewData {
  const now = ctx.now;
  const thisWeek = startOfWeek(now);
  const start = now.getDay() === 1 || now.getDay() === 2 ? addDays(thisWeek, -7) : thisWeek;
  const end = new Date(Math.min(addDays(start, 7).getTime(), now.getTime()));
  const inR = (iso?: string | null) => !!iso && new Date(iso) >= start && new Date(iso) < end;
  const kept = ctx.commitments.filter((c) => c.status === 'done' && inR(c.doneAt));
  const onTime = kept.filter((c) => !c.due || new Date(c.doneAt!) <= new Date(c.due));
  const interruptions = ctx.commitments.reduce((a, c) => a + (c.interruptions || []).filter((i) => inR(i.at)).length, 0);
  const slippedCs = ctx.commitments.filter(
    (c) =>
      (c.status === 'open' && inR(c.due) && new Date(c.due!) < now) ||
      (c.status === 'done' && inR(c.doneAt) && c.due && new Date(c.doneAt!) > new Date(c.due))
  );
  const slipped = slippedCs.map((c) => ({ c, reason: autoReason(c) }));
  const counts = new Map<SlipReason, number>();
  slipped.forEach((s) => counts.set(s.reason, (counts.get(s.reason) || 0) + 1));
  const topReason = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  return {
    start,
    end,
    kept,
    onTimePct: kept.length ? Math.round((onTime.length / kept.length) * 100) : 100,
    interruptions,
    slipped,
    topReason
  };
}

export const REASON_LABEL: Record<SlipReason, string> = {
  underestimated: '🐢 Underestimated',
  interrupted: '⚡ Interrupted',
  never_captured: '🫥 Never captured',
  too_much: '🧱 Too much on'
};

export function experimentFor(reason: SlipReason | null, ctx: Ctx): string | null {
  if (!reason) return null;
  if (reason === 'interrupted') {
    const byHat = new Map<string, number>();
    ctx.commitments.forEach((c) => {
      if (c.hatId) byHat.set(c.hatId, (byHat.get(c.hatId) || 0) + (c.interruptions || []).length);
    });
    const top = [...byHat.entries()].sort((a, b) => b[1] - a[1])[0];
    const hat = ctx.hats.find((h) => h.id === top?.[0]);
    return `A 2–2:30pm ping window for ${hat ? hat.name : 'your noisiest hat'}`;
  }
  if (reason === 'underestimated') return `Trust the ${ctx.factor}× estimates — plan at your real pace`;
  if (reason === 'never_captured') return 'Capture every promise the moment you make it';
  return 'Say no to one new ask — keep 10% slack';
}

export { startOfWeek, endOfWeek };
