-- email_signups: catch-all table for non-booking email captures.
-- Used by the "notify me when the agenda is announced" form on /agenda and
-- any similar pre-content signup the site adds later. One row per
-- (email, source). Re-submitting via the same source updates the consent
-- flags rather than creating a duplicate.

create table public.email_signups (
  id uuid primary key default gen_random_uuid(),
  email citext not null,
  source text not null,
  wants_agenda_alert boolean not null default false,
  wants_marketing boolean not null default false,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint email_signups_email_source_unique unique (email, source)
);

comment on table public.email_signups is
  'Pre-content email captures (e.g. /agenda "notify me" form). Not a bookings record; unrelated to the auth users or bookings tables. One row per (email, source).';

comment on column public.email_signups.source is
  'Identifier of the page/context where the signup happened, e.g. ''agenda_page''. Lets a single email opt in via multiple surfaces independently.';

create index email_signups_email_idx on public.email_signups (email);
create index email_signups_source_idx on public.email_signups (source);

create trigger email_signups_set_updated_at
before update on public.email_signups
for each row execute function public.set_updated_at();

-- Row Level Security.
-- Default deny; no anon/authenticated policies. Writes happen exclusively
-- via the service-role client from server actions, which bypasses RLS.
-- Super admins retain read access for the future admin dashboard.
alter table public.email_signups enable row level security;

create policy email_signups_admin_all on public.email_signups
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());
