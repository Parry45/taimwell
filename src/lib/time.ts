export const MIN = 60_000;
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
export function endOfDay(d: Date): Date {
  return addDays(startOfDay(d), 1);
}
export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
export function addMin(d: Date, n: number): Date {
  return new Date(d.getTime() + n * MIN);
}
/** Monday 00:00 of the week containing d */
export function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  const diff = (x.getDay() + 6) % 7;
  return addDays(x, -diff);
}
/** exclusive: next Monday 00:00 */
export function endOfWeek(d: Date): Date {
  return addDays(startOfWeek(d), 7);
}
export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
export function atHour(d: Date, hour: number): Date {
  const x = startOfDay(d);
  return new Date(x.getTime() + hour * 60 * MIN);
}
export function minutesBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / MIN;
}

export function fmtDur(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r}m`;
  if (r === 0) return `${h}h`;
  return `${h}h ${String(r).padStart(2, '0')}`;
}
export function fmtHours(min: number): string {
  const h = min / 60;
  return `${h >= 10 ? Math.round(h) : Math.round(h * 10) / 10}h`;
}
export function fmtTime(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  const ap = h >= 12 ? 'pm' : 'am';
  const hh = h % 12 || 12;
  return m ? `${hh}:${String(m).padStart(2, '0')}${ap}` : `${hh}${ap}`;
}
export function fmtRange(a: Date, b: Date): string {
  const sa = fmtTime(a);
  const sb = fmtTime(b);
  if (sa.slice(-2) === sb.slice(-2)) return `${sa.slice(0, -2)}–${sb}`;
  return `${sa}–${sb}`;
}
export function fmtDate(d: Date): string {
  return `${DAY_LONG[d.getDay()]}, ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
}
export function fmtShortDate(d: Date): string {
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
}
/** "today 4pm", "tomorrow", "Fri 6pm", "12 Dec" */
export function fmtDue(iso?: string | null, now = new Date()): string {
  if (!iso) return 'no date';
  const d = new Date(iso);
  const hasTime = !(d.getHours() === 18 && d.getMinutes() === 0);
  const t = hasTime ? ` ${fmtTime(d)}` : '';
  if (isSameDay(d, now)) return `today${t}`;
  if (isSameDay(d, addDays(now, 1))) return `tomorrow${t}`;
  const diffDays = (startOfDay(d).getTime() - startOfDay(now).getTime()) / (24 * 60 * MIN);
  if (diffDays > 0 && diffDays < 7) return `${DAY_SHORT[d.getDay()]}${t}`;
  if (diffDays < 0) return `${fmtShortDate(d)} (late)`;
  return fmtShortDate(d);
}
export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 12) return 'Morning 🌤️';
  if (h < 17) return 'Afternoon ☀️';
  return 'Evening 🌙';
}
/** ISO week number, for "Week 48" */
export function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - y.getTime()) / 86400000 + 1) / 7);
}
export function toLocalInput(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
