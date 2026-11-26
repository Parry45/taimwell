// Pre-written messages: warn people early, decline kindly, hand over cleanly.
import type { Commitment, Source } from './types';
import { fmtDue } from './time';

const first = (name?: string) => (name ? name.trim().split(/\s+/)[0] : '');
const lc = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s);

export function renegotiateMsg(c: Commitment, newDue: Date): string {
  const hi = first(c.forWhom) ? `Hi ${first(c.forWhom)}!` : 'Hi!';
  const was = c.due ? ` instead of ${fmtDue(c.due)}` : '';
  return `${hi} Quick heads-up: ${lc(c.title)} will be ready ${fmtDue(newDue.toISOString())}${was}. I want to get it right rather than rush it. Does that still work for you?`;
}

export function declineMsg(c: Commitment): string {
  const hi = first(c.forWhom) ? `Hi ${first(c.forWhom)},` : 'Hi,';
  return `${hi} thank you for thinking of me! I can't take on "${c.title}" right now without doing a rushed job. Could we revisit it in a couple of weeks?`;
}

export function delegateMsg(c: Commitment, to: string): string {
  const due = c.due ? ` (due ${fmtDue(c.due)})` : '';
  const ctx = c.sourceText ? `\n\nContext: "${c.sourceText.slice(0, 280)}"` : '';
  return `Hi ${first(to) || 'there'}, could you take "${c.title}"${due}?${ctx}\n\nShout if anything's unclear. Thank you!`;
}

/** Opens the right app with the text pre-filled. The person still presses send. */
export async function shareText(text: string, source?: Source): Promise<'whatsapp' | 'shared' | 'copied' | 'failed'> {
  if (source === 'whatsapp') {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    return 'whatsapp';
  }
  try {
    if (navigator.share) {
      await navigator.share({ text });
      return 'shared';
    }
  } catch {
    /* user cancelled */
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}
