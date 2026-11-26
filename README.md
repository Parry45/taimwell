# Taimwell — give what matters your time ⏳

A personal, installable web app (PWA) for people wearing many hats: two jobs, a couple of businesses, side gigs.
It catches promises where you make them, checks they actually fit your real week, warns you **before** you're late,
and makes finishing feel good.

Design: Figma file "Daymark" → page **02 · Screens — v3 light & fun**.

## What's in v0.1

| Screen | What it does |
| --- | --- |
| Sign in | Email + 6-digit code (works inside the installed iPhone app) |
| Set-up (3 steps) | Hats with emoji + weekly hours · your real week (job split, evenings, weekend, protected rest) · capture sources |
| Today | 3 things, progress ring, on-time streak, free-time & risk chips, date strip |
| Quick capture | Paste/share/speak a message → parsed into who/what/when/hat → estimate correction → fit check → commit |
| Inbox | Captured but not promised. Swipe → commit, ← decline |
| Focus | Timer, interruption log, sound vibes (rain / café / lo-fi, generated live) |
| Promise kept! | Confetti, streak, time handed back as a break |
| Week | Committed vs available hours, per hat |
| What gives? | Move / delegate / ask for more time / drop — with drafted messages |
| At risk | Why (needed vs free), make room or ask for a new date — message pre-written |
| Week wrapped | Kept, on-time %, interruptions, why things slipped, one experiment for next week |
| Settings | Hats, week, Google calendars (multiple accounts, per-calendar hat), sync, sign out |

Data is **local-first** (IndexedDB) and syncs to Supabase, so it works offline and on every device.

## Setup

### 1 · Supabase (once)
1. SQL Editor → run [`supabase/migrations/001_init.sql`](supabase/migrations/001_init.sql).
2. Authentication → Emails → Templates → **Magic Link**: make sure the body contains `{{ .Token }}`, e.g.
   `<h2>Your Taimwell code</h2><p style="font-size:28px;letter-spacing:6px"><b>{{ .Token }}</b></p>`
3. Authentication → URL Configuration → add your Vercel URL to **Site URL / Redirect URLs**.

### 2 · Vercel
Import this repo → Framework: **Vite** → Deploy. No env vars are required (the public Supabase URL/anon key are
built in), but you can override them:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_GOOGLE_CLIENT_ID=...   # needed for Google Calendar
```

### 3 · Google Calendar (read-only)
Google Cloud Console → new project → enable **Google Calendar API** → OAuth consent screen (External, Testing; add
your Gmail + work email as test users) → Credentials → **OAuth client ID → Web application**:

- Authorised JavaScript origins: `https://<your-app>.vercel.app`, `http://localhost:5173`
- Authorised redirect URIs: `https://<your-app>.vercel.app/oauth/google`, `http://localhost:5173/oauth/google`

Put the Client ID in Vercel as `VITE_GOOGLE_CLIENT_ID` and redeploy. Scope used: `calendar.readonly` + `email`.
Google tokens last an hour; "Refresh" in Settings re-reads your calendars. Busy times are copied into Taimwell, so
they sync to your phone even if you connected on a laptop.

### 4 · Install on iPhone
Open the Vercel URL in **Safari** → Share → **Add to Home Screen**. Sign in with the emailed code.

**Capturing from WhatsApp:** long-press a message → Copy → Taimwell ＋ → *Paste message*. Or build the
"Send to Taimwell" Shortcut (Settings → *Capture from WhatsApp on iPhone* shows the steps). Shortcuts open in Safari,
so sign in there once as well — everything syncs.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm run build
npx tsx scripts/test-logic.ts   # parsing + capacity maths checks
```

## How the maths works
- **Availability** = your windows (work hours, evenings, weekend blocks; never after Sunday rest) minus calendar events.
- **Estimate factor** = actual ÷ estimated time over your last 20 finished promises (needs 3+; clamped 0.75–3×).
- **Fit check** = adjusted estimate vs free time before the due date, after everything due earlier.
- **At risk** = earliest-deadline-first: cumulative remaining work vs free time up to each deadline.

## Not yet
Slack, Monday.com and email-forward capture (need a small server), push notifications, Outlook calendars.
