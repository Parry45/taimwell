// Google Calendar (read-only) via OAuth implicit flow — no server needed.
// Busy events are copied into Taimwell records, so they sync to every device.
import { GOOGLE_CLIENT_ID } from './config';
import { getAll, put, putMany, removeMany, uid } from './db';
import type { CalendarRec, EventRec } from './types';
import { addDays, startOfWeek } from './time';

const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly email';
const TOKENS_KEY = 'tw_google_tokens';

interface Tok {
  token: string;
  exp: number;
}
type Tokens = Record<string, Tok>;

function readTokens(): Tokens {
  try {
    return JSON.parse(localStorage.getItem(TOKENS_KEY) || '{}');
  } catch {
    return {};
  }
}
function writeTokens(t: Tokens) {
  localStorage.setItem(TOKENS_KEY, JSON.stringify(t));
}

export function redirectUri(): string {
  return `${location.origin}/oauth/google`;
}

export function startGoogleConnect(opts: { hint?: string; silent?: boolean; returnTo?: string } = {}) {
  const state = Math.random().toString(36).slice(2);
  localStorage.setItem('tw_g_state', state);
  localStorage.setItem('tw_g_return', opts.returnTo || location.pathname);
  const p = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: 'token',
    scope: SCOPE,
    include_granted_scopes: 'true',
    state,
    prompt: opts.silent ? 'none' : 'consent select_account'
  });
  if (opts.hint) p.set('login_hint', opts.hint);
  location.href = `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
}

/** Called on /oauth/google. Returns the account email after importing calendars. */
export async function finishGoogleConnect(): Promise<{ account: string; returnTo: string }> {
  const h = new URLSearchParams(location.hash.replace(/^#/, ''));
  const returnTo = localStorage.getItem('tw_g_return') || '/settings';
  if (h.get('error')) throw new Error(h.get('error') === 'access_denied' ? 'Google access was declined.' : `Google said: ${h.get('error')}`);
  const token = h.get('access_token');
  if (!token) throw new Error('No token came back from Google.');
  const expected = localStorage.getItem('tw_g_state');
  if (expected && h.get('state') !== expected) throw new Error('Sign-in state mismatch — please try again.');
  const exp = Date.now() + (parseInt(h.get('expires_in') || '3600', 10) - 60) * 1000;
  const me = await gget<{ email: string }>(token, 'https://www.googleapis.com/oauth2/v3/userinfo');
  const tokens = readTokens();
  tokens[me.email] = { token, exp };
  writeTokens(tokens);
  await importAccount(me.email, token);
  history.replaceState(null, '', '/oauth/google');
  return { account: me.email, returnTo };
}

async function gget<T>(token: string, url: string): Promise<T> {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (r.status === 401) throw new Error('expired');
  if (!r.ok) throw new Error(`Google API error ${r.status}`);
  return r.json() as Promise<T>;
}

interface GCal {
  id: string;
  summary: string;
  backgroundColor?: string;
  primary?: boolean;
  selected?: boolean;
}
interface GEvent {
  id: string;
  summary?: string;
  status?: string;
  transparency?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  attendees?: { self?: boolean; responseStatus?: string }[];
}

async function importAccount(account: string, token: string) {
  const list = await gget<{ items: GCal[] }>(token, 'https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader');
  const existing = await getAll<CalendarRec>('calendar');
  const mine: CalendarRec[] = [];
  for (const g of list.items || []) {
    const cur = existing.find((c) => c.account === account && c.googleId === g.id);
    const rec: CalendarRec = cur
      ? { ...cur, summary: g.primary ? account : g.summary, color: g.backgroundColor }
      : {
          id: uid(),
          googleId: g.id,
          account,
          summary: g.primary ? account : g.summary,
          color: g.backgroundColor,
          hatId: null,
          // holidays/birthdays calendars start switched off
          enabled: !!(g.primary || g.selected) && !/holiday|birthday|#contacts|#holiday/i.test(g.id)
        };
    mine.push(rec);
  }
  await putMany('calendar', mine);
  await importEvents(token, mine.filter((c) => c.enabled));
}

async function importEvents(token: string, cals: CalendarRec[]) {
  const timeMin = startOfWeek(new Date()).toISOString();
  const timeMax = addDays(new Date(), 21).toISOString();
  const allEvents = await getAll<EventRec>('event');
  for (const cal of cals) {
    const url =
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.googleId)}/events?` +
      new URLSearchParams({ timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime', maxResults: '250' }).toString();
    const data = await gget<{ items: GEvent[] }>(token, url);
    const fresh: EventRec[] = (data.items || [])
      .filter((e) => e.status !== 'cancelled' && e.transparency !== 'transparent' && e.start.dateTime && e.end.dateTime)
      .filter((e) => !(e.attendees || []).some((a) => a.self && a.responseStatus === 'declined'))
      .map((e) => ({ id: uid(), calendarId: cal.id, title: e.summary || 'Busy', start: e.start.dateTime!, end: e.end.dateTime! }));
    const old = allEvents.filter((e) => e.calendarId === cal.id).map((e) => e.id);
    await removeMany(old);
    await putMany('event', fresh);
  }
}

export function connectedAccounts(): string[] {
  return Object.keys(readTokens());
}

/** Refresh every account whose token is still valid. Returns accounts that need a fresh sign-in. */
export async function refreshCalendars(): Promise<string[]> {
  const tokens = readTokens();
  const cals = await getAll<CalendarRec>('calendar');
  const accounts = [...new Set(cals.map((c) => c.account))];
  const expired: string[] = [];
  for (const acc of accounts) {
    const t = tokens[acc];
    if (!t || t.exp < Date.now()) {
      expired.push(acc);
      continue;
    }
    try {
      await importEvents(t.token, cals.filter((c) => c.account === acc && c.enabled));
    } catch (e) {
      if (e instanceof Error && e.message === 'expired') expired.push(acc);
      else throw e;
    }
  }
  return expired;
}

export async function setCalendar(rec: CalendarRec) {
  await put('calendar', rec);
}
