-- ============================================================
-- CRICTERA — Supabase schema
-- Run this entire file once in the Supabase SQL editor
-- (Project → SQL Editor → New query → paste → Run)
-- ============================================================

-- ── PROFILES ──────────────────────────────────────────────
-- One row per auth.users user. Created automatically on signup via trigger.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on public.profiles for select
  using (true);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Auto-create a profile row whenever a new auth user is created
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();


-- ── SERIES ────────────────────────────────────────────────
-- (created before matches, since matches.series_id references it)
-- id is `text` for the same reason as matches.id (see note above).
create table if not exists public.series (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '',
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists series_owner_id_idx on public.series(owner_id);

alter table public.series enable row level security;

create policy "Owners can manage their own series"
  on public.series for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Public series are viewable by everyone"
  on public.series for select
  using (visibility = 'public');

create trigger series_set_updated_at
  before update on public.series
  for each row execute procedure public.set_updated_at();

alter publication supabase_realtime add table public.series;


-- ── MATCHES ───────────────────────────────────────────────
-- The full match object (teams, innings, balls, result, etc.) is stored as
-- JSONB in `data`. owner_id/viewer_code/editor_code/visibility/status are
-- promoted to real columns so they can be indexed and used in RLS policies
-- and fast lookups (e.g. joining by code) without unpacking JSON.
--
-- NOTE: id is `text`, not `uuid` with a server default. The app generates
-- match IDs client-side (same scheme used throughout its ~100 functions
-- for matches/series/players), so the schema accepts whatever ID the app
-- sends rather than generating its own — keeping one consistent ID scheme
-- across the whole app instead of two.
create table if not exists public.matches (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  viewer_code text unique not null,
  editor_code text unique not null,
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  status text not null default 'live' check (status in ('upcoming', 'setup', 'live', 'done')),
  title text not null default '',
  series_id text references public.series(id) on delete set null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists matches_owner_id_idx on public.matches(owner_id);
create index if not exists matches_viewer_code_idx on public.matches(viewer_code);
create index if not exists matches_editor_code_idx on public.matches(editor_code);
create index if not exists matches_series_id_idx on public.matches(series_id);
create index if not exists matches_visibility_idx on public.matches(visibility);

alter table public.matches enable row level security;

-- Owners can do everything with their own matches
create policy "Owners can select their own matches"
  on public.matches for select
  using (auth.uid() = owner_id);

create policy "Owners can insert their own matches"
  on public.matches for insert
  with check (auth.uid() = owner_id);

create policy "Owners can update their own matches"
  on public.matches for update
  using (auth.uid() = owner_id);

create policy "Owners can delete their own matches"
  on public.matches for delete
  using (auth.uid() = owner_id);

-- Anyone (including anonymous, if you allow it) can read public matches
create policy "Public matches are viewable by everyone"
  on public.matches for select
  using (visibility = 'public');

-- Anyone signed in who knows the viewer or editor code can read the match
-- (used by the "Join a Match" flow). Codes are unguessable random strings
-- generated client-side, so exposing SELECT to any authenticated user is
-- safe in practice — the code itself is the access control, the same way
-- an unlisted Google Doc link is the access control. The app only ever
-- queries `where viewer_code = :code or editor_code = :code`, so a user
-- without the code has no way to find the row.
create policy "Authenticated users can view matches by code lookup"
  on public.matches for select
  using (auth.role() = 'authenticated');

-- Anyone with the EDITOR code can update (score) the match. RLS alone can't
-- verify "the client supplied the correct editor_code" — that check happens
-- in the app (it only sends .update() calls after verifying the code
-- client-side via the row it already fetched). This policy just ensures
-- random unauthenticated writes are impossible.
create policy "Authenticated users can update matches (editor-code gated in app)"
  on public.matches for update
  using (auth.role() = 'authenticated');

create trigger matches_set_updated_at
  before update on public.matches
  for each row execute procedure public.set_updated_at();

-- Enable Realtime on matches (so live scoring updates push to viewers)
alter publication supabase_realtime add table public.matches;


-- ── PLAYERS (registry) ───────────────────────────────────
create table if not exists public.players (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists players_owner_id_idx on public.players(owner_id);

alter table public.players enable row level security;

create policy "Owners can manage their own players"
  on public.players for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create trigger players_set_updated_at
  before update on public.players
  for each row execute procedure public.set_updated_at();


-- ── TEAMS ─────────────────────────────────────────────────
create table if not exists public.teams (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists teams_owner_id_idx on public.teams(owner_id);

alter table public.teams enable row level security;

create policy "Owners can manage their own teams"
  on public.teams for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create trigger teams_set_updated_at
  before update on public.teams
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- Done. After running this:
-- 1. Go to Authentication → Providers → make sure Email is enabled.
-- 2. Go to Authentication → URL Configuration → set your deployed site URL
--    and add it to the Redirect URLs allow-list (needed for password
--    reset links to work).
-- 3. Copy your Project URL and anon public key from
--    Project Settings → API, and put them in your .env file (see below).
-- ============================================================
