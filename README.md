# Crictera — Supabase Setup

This app now uses **Supabase** for authentication and match storage instead
of browser localStorage. Matches you create are tied to your real account
and load automatically on any device you sign into.

## 1. Create a Supabase project

Go to [supabase.com](https://supabase.com), create a free project, and wait
for it to finish provisioning.

## 2. Run the SQL schema

Open **SQL Editor** in your Supabase project → **New query** → paste the
entire contents of `supabase_schema.sql` → **Run**.

This creates:
- `profiles` — one row per user, auto-created on signup
- `matches` — every match, with `owner_id`, `viewer_code`, `editor_code`,
  `visibility`, `status`, and the full match data as JSON
- `series`, `players`, `teams` — supporting tables, same ownership model
- Row Level Security policies on all tables
- Realtime enabled on `matches` and `series`

## 3. Configure Auth

In your Supabase dashboard:

- **Authentication → Providers** → make sure **Email** is enabled.
- **Authentication → URL Configuration** → set:
  - **Site URL** to your deployed app's URL (e.g. `https://crictera.vercel.app`)
  - Add that same URL to **Redirect URLs** (required for password-reset
    email links to work)
- Optional: **Authentication → Providers → Email** → toggle **Confirm
  email** off if you want signups to log users in immediately without an
  email confirmation step. Leave it on for stricter signups.

## 4. Get your API keys

**Project Settings → API**:
- Copy the **Project URL**
- Copy the **anon public** key (NOT the service_role key — that one must
  never be exposed in client-side code)

## 5. Set environment variables

Copy `.env.example` to `.env` and fill in the two values from step 4:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

## 6. Install and run

```bash
npm install
npm run dev
```

For production:

```bash
npm run build
```

This outputs a static `dist/` folder you can deploy to Vercel, Netlify, or
any static host. Remember to set the same two environment variables in
your hosting provider's dashboard (not just locally).

## What changed from the old version

- **Auth**: real email/password accounts via Supabase Auth, not
  localStorage. Forgot-password sends a real email with a reset link.
- **Matches**: stored in Postgres, not the browser. Every ball you score
  writes to Supabase immediately. Logging in on a different device loads
  all your matches automatically.
- **Sharing**: viewer/editor codes are looked up via a real database query,
  so they work across any device or browser — not just the one that
  created the match.
- **Realtime**: anyone viewing a match (via its viewer or editor code)
  sees score updates live, pushed from Supabase, without refreshing.
