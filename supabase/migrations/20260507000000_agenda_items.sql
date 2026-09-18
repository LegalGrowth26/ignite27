-- Agenda items (Workshops Part 2): the main-stage running order that
-- the /my-day planner shows to everyone alongside their booked
-- workshops. Admin-entered from /admin/agenda (Tom supplies the data);
-- draft/published via published_at like workshops and announcements.
--
-- These are display-only rows: nothing books onto an agenda item, the
-- planner just merges published items with the caller's workshop
-- bookings and flags overlaps ("You'll miss part of X").
--
-- Apply per convention: dev first via the Supabase SQL Editor, then
-- production before the PR merges. Requires the 20260506 workshops
-- migration to have been applied first (this PR stacks on Part 1).

begin;

create table public.agenda_items (
  id uuid primary key default gen_random_uuid(),
  title text not null
    constraint agenda_items_title_chk check (length(btrim(title)) between 1 and 200),
  description text not null default ''
    constraint agenda_items_description_chk check (length(description) <= 2000),
  speaker_name text
    constraint agenda_items_speaker_chk check (speaker_name is null or length(speaker_name) <= 120),
  location text
    constraint agenda_items_location_chk check (location is null or length(location) <= 120),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  constraint agenda_items_times_chk check (ends_at > starts_at),
  -- null = draft. Published items show on /my-day (and any future
  -- public agenda rendering).
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger agenda_items_set_updated_at
before update on public.agenda_items
for each row execute function public.set_updated_at();

create index agenda_items_published_starts_idx
  on public.agenda_items (published_at, starts_at);

alter table public.agenda_items enable row level security;

create policy agenda_items_public_select on public.agenda_items
  for select to anon, authenticated
  using (published_at is not null);

create policy agenda_items_admin_all on public.agenda_items
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

commit;
