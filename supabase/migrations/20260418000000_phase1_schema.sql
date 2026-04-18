-- Phase 1 schema for Ignite 27.
-- See SPEC.md for business rules and CLAUDE.md for conventions.
-- Conventions: every table has id (uuid pk), created_at, updated_at (trigger),
-- RLS enabled with default deny, then allow per role.

-- -----------------------------------------------------------------------------
-- Extensions
-- -----------------------------------------------------------------------------
create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.user_role as enum ('super_admin', 'scanner_staff', 'attendee');

create type public.ticket_type as enum ('regular', 'vip', 'exhibitor');

create type public.booking_type as enum ('delegate', 'exhibitor');

create type public.payment_status as enum (
  'pending',
  'paid',
  'failed',
  'refunded',
  'partially_refunded'
);

create type public.booking_status as enum (
  'active',
  'cancellation_requested',
  'cancelled'
);

create type public.dietary_requirement as enum (
  'none',
  'vegetarian',
  'vegan',
  'gluten_free',
  'dairy_free',
  'nut_allergy',
  'other'
);

create type public.pricing_window as enum (
  'window_1',
  'window_2',
  'window_3',
  'christmas_drop',
  'window_4',
  'event_day'
);

create type public.cancellation_status as enum ('pending', 'actioned', 'rejected');

create type public.correction_status as enum ('pending', 'actioned', 'rejected');

-- -----------------------------------------------------------------------------
-- Shared updated_at trigger function
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- users: one row per human in the platform, linked to Supabase auth.users.
-- -----------------------------------------------------------------------------
create table public.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  email citext unique not null,
  first_name text,
  surname text,
  mobile text,
  company text,
  job_title text,
  role public.user_role not null default 'attendee',
  marketing_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index users_auth_user_id_idx on public.users (auth_user_id);

create trigger users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

-- Helpers used in RLS policies. security definer so they can read users.role
-- without tripping the users RLS policy (which would recurse).
create or replace function public.current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.users where auth_user_id = auth.uid()
$$;

create or replace function public.current_app_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.users where auth_user_id = auth.uid()
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'super_admin' from public.users where auth_user_id = auth.uid()),
    false
  )
$$;

-- -----------------------------------------------------------------------------
-- previous_bookers: seeded from the Ignite 26 CSV for Window 1 eligibility.
-- -----------------------------------------------------------------------------
create table public.previous_bookers (
  id uuid primary key default gen_random_uuid(),
  email citext unique not null,
  first_name text,
  surname text,
  company text,
  original_booking_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger previous_bookers_set_updated_at
before update on public.previous_bookers
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- eligibility_overrides: manual Window 1 grants.
-- -----------------------------------------------------------------------------
create table public.eligibility_overrides (
  id uuid primary key default gen_random_uuid(),
  email citext not null,
  granted_by uuid not null references public.users(id),
  reason text not null,
  granted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index eligibility_overrides_email_idx on public.eligibility_overrides (email);

create trigger eligibility_overrides_set_updated_at
before update on public.eligibility_overrides
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- magic_links: hashed tokens for Window 1 eligibility sessions.
-- -----------------------------------------------------------------------------
create table public.magic_links (
  id uuid primary key default gen_random_uuid(),
  email citext not null,
  token_hash text unique not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  purpose text not null default 'window_1_eligibility',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index magic_links_email_idx on public.magic_links (email);
create index magic_links_expires_at_idx on public.magic_links (expires_at);

create trigger magic_links_set_updated_at
before update on public.magic_links
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- bookings: one row per purchase (delegate or exhibitor).
-- -----------------------------------------------------------------------------
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  booking_type public.booking_type not null,
  ticket_type public.ticket_type not null,
  pricing_window public.pricing_window not null,

  -- Exhibitor-only company fields.
  company_name text,
  company_contact_name text,
  company_contact_email citext,
  company_contact_mobile text,
  company_website text,
  company_logo_path text,

  -- Pricing snapshot at time of checkout (all pence, VAT-inclusive gross).
  gross_amount_pence integer not null,
  vat_amount_pence integer not null,
  charity_uplift_pence integer not null default 0,
  currency text not null default 'gbp',

  -- Delegate-only flag.
  lunch_included boolean not null default false,

  -- Stripe identifiers.
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,

  -- Status.
  payment_status public.payment_status not null default 'pending',
  booking_status public.booking_status not null default 'active',

  -- Terms acceptance audit.
  terms_accepted_at timestamptz,
  terms_accepted_ip inet,

  -- Exhibitor ops.
  stand_allocation text,

  -- Soft delete for bookings per CLAUDE.md.
  deleted_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bookings_user_id_idx on public.bookings (user_id);
create index bookings_booking_type_idx on public.bookings (booking_type);
create index bookings_pricing_window_idx on public.bookings (pricing_window);
create index bookings_payment_status_idx on public.bookings (payment_status);

create trigger bookings_set_updated_at
before update on public.bookings
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- booking_attendees: one row per attending person (delegate = 1, exhibitor = 2).
-- -----------------------------------------------------------------------------
create table public.booking_attendees (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  user_id uuid references public.users(id),
  first_name text not null,
  surname text not null,
  email citext not null,
  mobile text,
  company text,
  job_title text,
  dietary_requirement public.dietary_requirement not null default 'none',
  dietary_other text,
  lunch_entitlement boolean not null default false,
  badge_qr_url text,
  is_primary_contact boolean not null default false,
  attendee_index smallint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_attendees_dietary_other_chk check (
    (dietary_requirement = 'other' and dietary_other is not null and length(btrim(dietary_other)) > 0)
    or (dietary_requirement <> 'other')
  )
);

create index booking_attendees_booking_id_idx on public.booking_attendees (booking_id);
create index booking_attendees_user_id_idx on public.booking_attendees (user_id);
create index booking_attendees_email_idx on public.booking_attendees (email);

create trigger booking_attendees_set_updated_at
before update on public.booking_attendees
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- cancellation_requests
-- -----------------------------------------------------------------------------
create table public.cancellation_requests (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id),
  requested_by uuid not null references public.users(id),
  reason text not null,
  notes text,
  status public.cancellation_status not null default 'pending',
  actioned_by uuid references public.users(id),
  actioned_at timestamptz,
  outcome_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cancellation_requests_booking_id_idx on public.cancellation_requests (booking_id);
create index cancellation_requests_status_idx on public.cancellation_requests (status);

create trigger cancellation_requests_set_updated_at
before update on public.cancellation_requests
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- correction_requests
-- -----------------------------------------------------------------------------
create table public.correction_requests (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id),
  booking_attendee_id uuid references public.booking_attendees(id),
  requested_by uuid not null references public.users(id),
  requested_changes text not null,
  status public.correction_status not null default 'pending',
  actioned_by uuid references public.users(id),
  actioned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index correction_requests_booking_id_idx on public.correction_requests (booking_id);
create index correction_requests_status_idx on public.correction_requests (status);

create trigger correction_requests_set_updated_at
before update on public.correction_requests
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- waiting_list: non-eligible Window 1 emails capturing interest.
-- -----------------------------------------------------------------------------
create table public.waiting_list (
  id uuid primary key default gen_random_uuid(),
  email citext unique not null,
  first_name text,
  surname text,
  company text,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger waiting_list_set_updated_at
before update on public.waiting_list
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- email_allowlist: guardrail for non-prod sends.
-- -----------------------------------------------------------------------------
create table public.email_allowlist (
  id uuid primary key default gen_random_uuid(),
  email citext unique not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger email_allowlist_set_updated_at
before update on public.email_allowlist
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Row Level Security.
-- Default deny on every table. Explicit allow policies below.
-- The service role key bypasses RLS and is used for webhook writes and
-- magic-link issuance server-side.
-- -----------------------------------------------------------------------------

alter table public.users enable row level security;
alter table public.previous_bookers enable row level security;
alter table public.eligibility_overrides enable row level security;
alter table public.magic_links enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_attendees enable row level security;
alter table public.cancellation_requests enable row level security;
alter table public.correction_requests enable row level security;
alter table public.waiting_list enable row level security;
alter table public.email_allowlist enable row level security;

-- users --------------------------------------------------------------
create policy users_self_select on public.users
  for select to authenticated
  using (auth_user_id = auth.uid());

create policy users_self_update on public.users
  for update to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid() and role = (select role from public.users where auth_user_id = auth.uid()));

create policy users_admin_all on public.users
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- previous_bookers ---------------------------------------------------
create policy previous_bookers_admin_all on public.previous_bookers
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- eligibility_overrides ----------------------------------------------
create policy eligibility_overrides_admin_all on public.eligibility_overrides
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- magic_links --------------------------------------------------------
-- No client policies. Server-only via the service role key.

-- bookings -----------------------------------------------------------
create policy bookings_owner_select on public.bookings
  for select to authenticated
  using (user_id = public.current_app_user_id());

create policy bookings_attendee_select on public.bookings
  for select to authenticated
  using (
    exists (
      select 1 from public.booking_attendees ba
      where ba.booking_id = bookings.id
        and ba.user_id = public.current_app_user_id()
    )
  );

create policy bookings_admin_all on public.bookings
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- booking_attendees --------------------------------------------------
create policy booking_attendees_owner_select on public.booking_attendees
  for select to authenticated
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_attendees.booking_id
        and b.user_id = public.current_app_user_id()
    )
    or user_id = public.current_app_user_id()
  );

create policy booking_attendees_admin_all on public.booking_attendees
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- cancellation_requests ----------------------------------------------
create policy cancellation_requests_owner_select on public.cancellation_requests
  for select to authenticated
  using (
    exists (
      select 1 from public.bookings b
      where b.id = cancellation_requests.booking_id
        and b.user_id = public.current_app_user_id()
    )
  );

create policy cancellation_requests_owner_insert on public.cancellation_requests
  for insert to authenticated
  with check (
    requested_by = public.current_app_user_id()
    and exists (
      select 1 from public.bookings b
      where b.id = cancellation_requests.booking_id
        and b.user_id = public.current_app_user_id()
    )
  );

create policy cancellation_requests_admin_all on public.cancellation_requests
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- correction_requests ------------------------------------------------
create policy correction_requests_owner_select on public.correction_requests
  for select to authenticated
  using (
    exists (
      select 1 from public.bookings b
      where b.id = correction_requests.booking_id
        and b.user_id = public.current_app_user_id()
    )
  );

create policy correction_requests_owner_insert on public.correction_requests
  for insert to authenticated
  with check (
    requested_by = public.current_app_user_id()
    and exists (
      select 1 from public.bookings b
      where b.id = correction_requests.booking_id
        and b.user_id = public.current_app_user_id()
    )
  );

create policy correction_requests_admin_all on public.correction_requests
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- waiting_list -------------------------------------------------------
create policy waiting_list_anon_insert on public.waiting_list
  for insert to anon, authenticated
  with check (true);

create policy waiting_list_admin_all on public.waiting_list
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- email_allowlist ----------------------------------------------------
create policy email_allowlist_admin_all on public.email_allowlist
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());
