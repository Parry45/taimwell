// Turns a shared message ("Kofi: can you send the revised proposal by Friday?") into a draft promise.
import type { Hat, Source } from './types';
import { addDays, atHour, startOfDay } from './time';

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_RX = '(sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?)';
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MON_RX = '(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*';

export interface ParsedCapture {
  title: string;
  forWhom?: string;
  due?: string | null;
  quote: string;
}

function dayIndex(word: string): number {
  return DAYS.findIndex((d) => d.startsWith(word.slice(0, 3).toLowerCase()));
}

function applyTime(d: Date, text: string): { date: Date; matched: string | null } {
  const m = text.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s?(am|pm)\b/i);
  if (!m) return { date: atHour(d, 18), matched: null };
  let h = parseInt(m[1], 10) % 12;
  if (m[3].toLowerCase() === 'pm') h += 12;
  const min = m[2] ? parseInt(m[2], 10) : 0;
  return { date: atHour(d, h + min / 60), matched: m[0] };
}

export function parseDue(text: string, now = new Date()): { due: Date | null; phrases: string[] } {
  const t = text.toLowerCase();
  const phrases: string[] = [];
  let day: Date | null = null;
  let m: RegExpMatchArray | null;

  if ((m = t.match(/\b(?:by\s+|before\s+)?(?:end of (?:the )?day|eod|today|tonight)\b/))) {
    day = startOfDay(now);
    phrases.push(m[0]);
    if (/tonight/.test(m[0])) {
      const r = applyTime(day, t);
      return { due: r.matched ? r.date : atHour(day, 21), phrases: r.matched ? [...phrases, r.matched] : phrases };
    }
  } else if ((m = t.match(/\b(?:by\s+|before\s+)?tomorrow\b/))) {
    day = addDays(startOfDay(now), 1);
    phrases.push(m[0]);
  } else if ((m = t.match(/\b(?:by\s+|before\s+)?(?:end of (?:the )?week|eow)\b/))) {
    const diff = (5 - now.getDay() + 7) % 7;
    day = addDays(startOfDay(now), diff);
    phrases.push(m[0]);
  } else if ((m = t.match(/\b(?:by\s+|before\s+)?next week\b/))) {
    const diff = ((8 - now.getDay()) % 7) || 7;
    day = addDays(startOfDay(now), diff);
    phrases.push(m[0]);
  } else if ((m = t.match(new RegExp(`\\b(?:by\\s+|before\\s+|on\\s+|this\\s+|next\\s+)?${DAY_RX}\\b`)))) {
    const target = dayIndex(m[1]);
    let diff = (target - now.getDay() + 7) % 7;
    if (diff === 0 && now.getHours() >= 18) diff = 7;
    if (/next\s/.test(m[0]) && diff < 7) diff += diff === 0 ? 7 : 0;
    day = addDays(startOfDay(now), diff);
    phrases.push(m[0]);
  } else if ((m = t.match(new RegExp(`\\b(?:by\\s+|before\\s+|on\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MON_RX}\\b`)))) {
    day = dateFor(parseInt(m[1], 10), MONTHS.indexOf(m[2].slice(0, 3)), now);
    phrases.push(m[0]);
  } else if ((m = t.match(new RegExp(`\\b(?:by\\s+|before\\s+|on\\s+)?${MON_RX}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`)))) {
    day = dateFor(parseInt(m[2], 10), MONTHS.indexOf(m[1].slice(0, 3)), now);
    phrases.push(m[0]);
  } else if ((m = t.match(/\b(?:by\s+|before\s+|on\s+)?(\d{1,2})\/(\d{1,2})(?:\/\d{2,4})?\b/))) {
    // dd/mm (Ghana, UK)
    day = dateFor(parseInt(m[1], 10), parseInt(m[2], 10) - 1, now);
    phrases.push(m[0]);
  }
  if (!day) return { due: null, phrases };
  const r = applyTime(day, t);
  if (r.matched) phrases.push(r.matched);
  return { due: r.date, phrases };
}

function dateFor(d: number, month: number, now: Date): Date | null {
  if (month < 0 || month > 11 || d < 1 || d > 31) return null;
  let x = new Date(now.getFullYear(), month, d);
  if (x < startOfDay(now)) x = new Date(now.getFullYear() + 1, month, d);
  return x;
}

const FLUFF = [
  /^(hey|hi|hello|yo|morning|good (morning|afternoon|evening))\b[\s,!.]*/i,
  /^(boss|bro|sis|dear|chief|chale)\b[\s,!.]*/i,
  /^(please|pls|plz|kindly)\s+/i,
  /^(can|could|would|will) you( please| pls| kindly)?\s+/i,
  /^(i need you to|i'd like you to|we need you to|need you to)\s+/i,
  /^(i|we) (need|want|would like)\s+/i,
  /^(remember to|don't forget to|dont forget to)\s+/i
];

export function parseCapture(raw: string, now = new Date()): ParsedCapture {
  let text = (raw || '').trim();
  // WhatsApp-style prefix: "[26/11/2026, 01:02] Kofi Mensah: message"
  text = text.replace(/^\[[^\]]{4,30}\]\s*/, '');
  let forWhom: string | undefined;
  const who = text.match(/^([A-Za-zÀ-ÿ'’.\- ]{2,40}):\s+([\s\S]+)$/);
  if (who) {
    forWhom = who[1].trim();
    text = who[2].trim();
  }
  const quote = text;
  const { due, phrases } = parseDue(text, now);

  // first sentence that looks like the ask
  let title = text.split(/[?.!]\s+|\n/)[0] || text;
  for (let i = 0; i < 3; i++) for (const rx of FLUFF) title = title.replace(rx, '');
  for (const p of phrases) title = title.replace(new RegExp(`\\s*${escapeRx(p)}`, 'i'), '');
  title = title
    .replace(/[?!.]+$/, '')
    .replace(/\s*(please|pls|abeg|🙏)+\s*$/i, '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (title.length > 90) title = title.slice(0, 87).trimEnd() + '…';
  if (title) title = title[0].toUpperCase() + title.slice(1);
  return { title: title || 'New promise', forWhom, due: due ? due.toISOString() : null, quote };
}

function escapeRx(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function suggestHat(hats: Hat[], forWhom: string | undefined, text: string, source: Source): Hat | null {
  const who = forWhom?.toLowerCase();
  if (who) {
    const byPerson = hats.find((h) => (h.people || []).some((p) => p.toLowerCase() === who));
    if (byPerson) return byPerson;
  }
  const t = text.toLowerCase();
  const byName = hats.find((h) => h.name.toLowerCase().split(/[\s·]+/).some((w) => w.length > 2 && t.includes(w)));
  if (byName) return byName;
  if (source === 'monday' || source === 'slack') return hats.find((h) => h.kind === 'job') || null;
  return null;
}

export function sourceFrom(param: string | null | undefined, text: string): Source {
  const p = (param || '').toLowerCase();
  if (['whatsapp', 'slack', 'email', 'monday', 'call', 'manual'].includes(p)) return p as Source;
  if (/wa\.me|whatsapp/i.test(text)) return 'whatsapp';
  if (/slack\.com/i.test(text)) return 'slack';
  if (/monday\.com/i.test(text)) return 'monday';
  return 'manual';
}
