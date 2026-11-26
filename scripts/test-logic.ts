// Quick logic checks: run with `npx tsx scripts/test-logic.ts`
import { parseCapture } from '../src/lib/parse';
import { adjusted, estimateFactor, fitCheck, giveOptions, makeCtx, risks, streak, todayView, weekSummary, windows, sumMin } from '../src/lib/capacity';
import type { Commitment, Hat, Settings } from '../src/lib/types';
import { DEFAULT_SETTINGS } from '../src/lib/types';

let fails = 0;
function ok(cond: unknown, msg: string) {
  if (!cond) {
    fails++;
    console.log('✗', msg);
  } else console.log('✓', msg);
}

// Thursday 26 Nov 2026, 09:00 local
const now = new Date(2026, 10, 26, 9, 0);

// ---------- parsing
const p1 = parseCapture('Kofi Mensah: Hey, can you send the revised brand proposal by Friday? Client wants to review it over the weekend 🙏', now);
console.log(p1);
ok(p1.forWhom === 'Kofi Mensah', 'sender parsed');
ok(p1.title === 'Send the revised brand proposal', `title cleaned → "${p1.title}"`);
ok(p1.due && new Date(p1.due).getDay() === 5 && new Date(p1.due).getDate() === 27, 'due = Fri 27 Nov');

const p2 = parseCapture('[26/11/2026, 11:20] Aunty Esi: I need 40 custom tote bags by 12 Dec please', now);
console.log(p2);
ok(p2.forWhom === 'Aunty Esi', 'whatsapp export prefix stripped');
ok(p2.due && new Date(p2.due).getMonth() === 11 && new Date(p2.due).getDate() === 12, 'due = 12 Dec');
ok(!/12 dec/i.test(p2.title), `date phrase removed → "${p2.title}"`);

const p3 = parseCapture('Can you own the churn analysis for tomorrow at 3pm', now);
ok(p3.due && new Date(p3.due).getDate() === 27 && new Date(p3.due).getHours() === 15, 'tomorrow 3pm');

const p4 = parseCapture('pls review the deck', now);
ok(p4.due === null && p4.title === 'Review the deck', `no date → "${p4.title}"`);

// ---------- capacity
const settings: Settings = { id: 's', ...DEFAULT_SETTINGS, onboarded: true };
const hats: Hat[] = [
  { id: 'j1', name: 'Job 1', emoji: '💼', color: '#000000', budgetH: 24, order: 0, kind: 'job' },
  { id: 'st', name: 'Studio', emoji: '🎨', color: '#000000', budgetH: 8, order: 1, kind: 'business' },
  { id: 'g', name: 'Gigs', emoji: '⚡', color: '#000000', budgetH: 4, order: 2, kind: 'gig' }
];
const mk = (p: Partial<Commitment>): Commitment => ({
  id: Math.random().toString(36).slice(2),
  title: 'x',
  hatId: 'j1',
  source: 'manual',
  estimateMin: 60,
  status: 'open',
  createdAt: '2026-11-20T09:00:00.000Z',
  actualMin: 0,
  interruptions: [],
  ...p
});

const wk = windows(settings, new Date(2026, 10, 23), new Date(2026, 10, 30));
ok(Math.round(sumMin(wk) / 60) === 40 + 15 + 6 + 3, `full week availability = ${sumMin(wk) / 60}h (expect 64)`);

const done = [90, 100, 80].map((a, i) => mk({ status: 'done', estimateMin: 60, actualMin: a, doneAt: `2026-11-2${i + 3}T12:00:00.000Z`, due: `2026-11-2${i + 3}T18:00:00.000Z` }));
ok(estimateFactor(done).factor === 1.5, `estimate factor ${estimateFactor(done).factor} (expect 1.5)`);
ok(adjusted({ estimateMin: 90 }, 1.6) === 145, '1h30 × 1.6 → 2h25');

const big = mk({ title: 'Launch email', hatId: 'st', estimateMin: 600, due: new Date(2026, 10, 26, 12, 0).toISOString(), forWhom: 'Efua' });
const small = mk({ title: 'Deck', estimateMin: 60, due: new Date(2026, 10, 27, 16, 0).toISOString() });
const loose = mk({ title: 'Moodboard', hatId: 'st', estimateMin: 120, due: null, slot: { start: new Date(2026, 10, 27, 19).toISOString(), end: new Date(2026, 10, 27, 21).toISOString() } });
const gig = mk({ title: 'Logo tweak', hatId: 'g', estimateMin: 60, due: new Date(2026, 10, 28, 12).toISOString() });
const ctx = makeCtx({ now, settings, hats, commitments: [...done, big, small, loose, gig], events: [], calendars: [] });
const rk = risks(ctx);
ok(rk.get(big.id)?.atRisk === true, 'big task due at noon today is at risk');
ok(rk.get(small.id)?.atRisk === true || rk.get(small.id)?.atRisk === false, 'risk computed for small');

const fit = fitCheck(ctx, { estimateMin: 60, due: new Date(2026, 10, 30, 18).toISOString(), hatId: 'st' });
console.log('fit', fit.fits, fit.slot?.start.toString(), fit.needMin);
ok(fit.needMin === 90, 'fit uses 1.5× factor');

const ws = weekSummary(ctx);
console.log('week', Math.round(ws.committed), Math.round(ws.available), Math.round(ws.over));
ok(ws.available > 0, 'week available > 0');

const tv = todayView(ctx, rk);
ok(tv.list.length <= 3, `today shows ≤3 (${tv.list.length})`);
const g = giveOptions(ctx);
console.log(g.map((o) => `${o.action}:${o.c.title}:${o.gain}`));
ok(g.find((o) => o.c.id === loose.id)?.action === 'move', 'no-due item → move');
ok(g.find((o) => o.c.id === big.id)?.action === 'renegotiate', 'item with forWhom → renegotiate');
ok(g.find((o) => o.c.id === gig.id)?.action === 'drop', 'gig without person → drop');

ok(streak(done, new Date(2026, 10, 26, 9)) === 3, `streak = ${streak(done, new Date(2026, 10, 26, 9))} (expect 3)`);

console.log(fails ? `\n${fails} FAILED` : '\nall good');
process.exit(fails ? 1 : 0);
