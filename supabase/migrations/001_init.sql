-- Taimwell: one generic, per-user synced table.
-- Every object (hat, commitment, settings, calendar, event) is a row; the app syncs
-- local-first (IndexedDB) and uses last-write-wins on updated_at.
-- Run this once in Supabase → SQL Editor → New query → Run.

create table if not exists public.records (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind        text not null,
  data        jsonb not null,
  deleted     boolean not null default false,
  updated_at  timestamptz not null default now()
);

create index if not exists records_user_updated_idx on public.records (user_id, updated_at);

alter table public.records enable row level security;

drop policy if exists "Users manage their own records" on public.records;
create policy "Users manage their own records"
  on public.records
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Server clock decides updated_at, so devices with a wrong clock can't break sync.
create or replace function public.records_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists records_set_updated_at on public.records;
create trigger records_set_updated_at
  before insert or update on public.records
  for each row execute function public.records_set_updated_at();
