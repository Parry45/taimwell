export type Source = 'whatsapp' | 'slack' | 'email' | 'monday' | 'call' | 'manual';
export type Status = 'inbox' | 'open' | 'done' | 'dropped' | 'delegated';
export type SlipReason = 'underestimated' | 'interrupted' | 'never_captured' | 'too_much';
export type HatKind = 'job' | 'business' | 'gig' | 'other';
export type Kind = 'hat' | 'commitment' | 'settings' | 'calendar' | 'event';

export interface Hat {
  id: string;
  name: string;
  emoji: string;
  color: string;
  budgetH: number;
  order: number;
  kind: HatKind;
  /** people this hat usually works with — used to suggest the hat on capture */
  people?: string[];
}

export interface Interruption {
  at: string;
  label: string;
}

export interface Slot {
  start: string;
  end: string;
}

export interface Commitment {
  id: string;
  title: string;
  hatId: string | null;
  forWhom?: string;
  source: Source;
  sourceText?: string;
  due?: string | null;
  estimateMin: number;
  status: Status;
  createdAt: string;
  committedAt?: string;
  doneAt?: string;
  actualMin: number;
  interruptions: Interruption[];
  slot?: Slot | null;
  slipReason?: SlipReason | null;
  delegatedTo?: string;
}

export interface Settings {
  /** random uuid per user (ids must be globally unique in Supabase) */
  id: string;
  onboarded: boolean;
  name?: string;
  job1HatId?: string | null;
  job2HatId?: string | null;
  /** share of the shared 9–5 that goes to Job 1 (0–100) */
  splitPct: number;
  workStart: number;
  workEnd: number;
  /** JS day numbers, 0 = Sunday */
  workdays: number[];
  eveningStart: number;
  eveningHours: number;
  saturdayStart: number;
  saturdayHours: number;
  sundayStart: number;
  sundayHours: number;
  /** Sunday hour after which nothing is ever planned */
  restSundayAfter: number;
  experiment?: string | null;
  breakUntil?: string | null;
  googleHint?: string | null;
}

export interface CalendarRec {
  id: string;
  googleId: string;
  summary: string;
  account: string;
  hatId: string | null;
  enabled: boolean;
  color?: string;
}

export interface EventRec {
  id: string;
  calendarId: string;
  title: string;
  start: string;
  end: string;
}

export interface Row<T = unknown> {
  id: string;
  kind: Kind;
  data: T;
  deleted: 0 | 1;
  dirty: 0 | 1;
  updatedAt?: string;
}

export const DEFAULT_SETTINGS: Omit<Settings, 'id'> = {
  onboarded: false,
  splitPct: 60,
  workStart: 9,
  workEnd: 17,
  workdays: [1, 2, 3, 4, 5],
  eveningStart: 19,
  eveningHours: 3,
  saturdayStart: 9,
  saturdayHours: 6,
  sundayStart: 10,
  sundayHours: 3,
  restSundayAfter: 13,
  experiment: null,
  breakUntil: null
};

export const HAT_COLORS = ['#0C79BA', '#14A39A', '#F97316', '#D946A8', '#4D7C0F', '#4338CA', '#CA8A04', '#0F766E'];
