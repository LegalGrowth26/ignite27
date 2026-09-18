-- Homepage announcements ("Latest from IGNITE!"): admin-posted cards
-- with headline, short body, optional link and optional image, shown
-- as a rotating strip on the homepage. Hidden entirely while nothing
-- is published.
--
-- published_at doubles as the publish flag (null = draft/unpublished);
-- sort_order drives the strip order (lower first), managed by the
-- admin reorder actions. Writes go through the service role from the
-- audit-logged admin actions; the public site reads published rows via
-- the anon-capable policy below.
--
-- Column names follow the repo conventions verified against the
-- existing schema: snake_case, created_by references users(id) (as in
-- scheduled_emails), sort_order integer (as in confirmed_exhibitors),
-- id/created_at/updated_at with the shared set_updated_at trigger.
--
-- Apply per convention: dev first via the Supabase SQL Editor, then
-- production before the PR merges.

begin;

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  headline text not null
    constraint announcements_headline_chk
    check (length(btrim(headline)) between 1 and 120),
  body text not null
    constraint announcements_body_chk
    check (length(btrim(body)) between 1 and 500),
  link_url text,
  image_url text,
  sort_order integer not null default 100,
  published_at timestamptz,
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger announcements_set_updated_at
before update on public.announcements
for each row execute function public.set_updated_at();

create index announcements_published_idx
  on public.announcements (published_at, sort_order);

alter table public.announcements enable row level security;

-- The public strip: anyone can read PUBLISHED announcements only.
create policy announcements_public_select on public.announcements
  for select to anon, authenticated
  using (published_at is not null);

create policy announcements_admin_all on public.announcements
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

commit;
