-- Admin dashboard support: exhibitor requirements capture, confirmed
-- exhibitors (public display after approval), and logo storage buckets.
--
-- Applied per convention: dev first via the Supabase SQL Editor, then
-- production before the admin-dashboard PR merges.
--
-- Existing admin access this migration relies on (already in place from
-- phase 1 / launch pack):
--   - public.is_super_admin() helper (security definer)
--   - *_admin_all policies on users / bookings / booking_attendees /
--     cancellation_requests / correction_requests
--   - email_signups_admin_all read for the dashboard email pulls

begin;

-- -----------------------------------------------------------------------------
-- exhibitor_requirements: one row per exhibitor booking, filled in by the
-- exhibitor after booking (power, furniture, signage, logo, website).
-- Approval fields are stamped ONLY by the admin approve action (service
-- role); column-level grants below stop authenticated users from touching
-- them even if a future RLS policy slips.
-- -----------------------------------------------------------------------------
create table public.exhibitor_requirements (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  needs_power boolean not null default false,
  needs_table_chairs boolean not null default true,
  signage_name text not null,
  logo_path text,          -- object path inside the PRIVATE exhibitor-logos bucket
  website_url text,
  approved_at timestamptz, -- set only via admin approve (service role)
  approved_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exhibitor_requirements_signage_chk
    check (length(btrim(signage_name)) between 1 and 120)
);

create index exhibitor_requirements_booking_id_idx
  on public.exhibitor_requirements (booking_id);

create trigger exhibitor_requirements_set_updated_at
before update on public.exhibitor_requirements
for each row execute function public.set_updated_at();

alter table public.exhibitor_requirements enable row level security;

-- Booking owner can see and maintain their own requirements row.
create policy exhibitor_requirements_owner_select on public.exhibitor_requirements
  for select to authenticated
  using (
    exists (
      select 1 from public.bookings b
      where b.id = exhibitor_requirements.booking_id
        and b.user_id = public.current_app_user_id()
    )
  );

create policy exhibitor_requirements_owner_insert on public.exhibitor_requirements
  for insert to authenticated
  with check (
    exists (
      select 1 from public.bookings b
      where b.id = exhibitor_requirements.booking_id
        and b.user_id = public.current_app_user_id()
        and b.booking_type = 'exhibitor'
    )
  );

create policy exhibitor_requirements_owner_update on public.exhibitor_requirements
  for update to authenticated
  using (
    exists (
      select 1 from public.bookings b
      where b.id = exhibitor_requirements.booking_id
        and b.user_id = public.current_app_user_id()
    )
  )
  with check (
    exists (
      select 1 from public.bookings b
      where b.id = exhibitor_requirements.booking_id
        and b.user_id = public.current_app_user_id()
    )
  );

create policy exhibitor_requirements_admin_all on public.exhibitor_requirements
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Column-level defence in depth: authenticated users (including the
-- booking owner) can never write the approval columns; those are set by
-- the admin approve server action via the service role, which bypasses
-- both RLS and these grants.
revoke insert, update on public.exhibitor_requirements from authenticated;
grant insert (booking_id, needs_power, needs_table_chairs, signage_name, logo_path, website_url)
  on public.exhibitor_requirements to authenticated;
grant update (needs_power, needs_table_chairs, signage_name, logo_path, website_url)
  on public.exhibitor_requirements to authenticated;

-- -----------------------------------------------------------------------------
-- confirmed_exhibitors: the ONLY table the public site reads for the
-- "confirmed exhibitors" section. Populated exclusively by the admin
-- approve action (service role). Nothing publishes automatically.
-- -----------------------------------------------------------------------------
create table public.confirmed_exhibitors (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid unique references public.bookings(id) on delete set null,
  display_name text not null,
  logo_path text,          -- object path inside the PUBLIC exhibitor-logos-public bucket
  website_url text,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger confirmed_exhibitors_set_updated_at
before update on public.confirmed_exhibitors
for each row execute function public.set_updated_at();

alter table public.confirmed_exhibitors enable row level security;

-- Public read (anon + authenticated). Writes only via service role /
-- admin policy.
create policy confirmed_exhibitors_public_select on public.confirmed_exhibitors
  for select to anon, authenticated
  using (true);

create policy confirmed_exhibitors_admin_all on public.confirmed_exhibitors
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- -----------------------------------------------------------------------------
-- admin_audit: append-only log of admin actions (who did what when).
-- Written exclusively by server actions via the service role; admins can
-- read it, nobody can update or delete through the API roles.
-- -----------------------------------------------------------------------------
create table public.admin_audit (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references public.users(id),
  action text not null,        -- e.g. 'discount_code.create', 'exhibitor.approve'
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index admin_audit_created_at_idx on public.admin_audit (created_at desc);
create index admin_audit_action_idx on public.admin_audit (action);

alter table public.admin_audit enable row level security;

create policy admin_audit_admin_select on public.admin_audit
  for select to authenticated
  using (public.is_super_admin());
-- No insert/update/delete policies for API roles: writes are service-role
-- only, and the log is append-only by construction.

-- -----------------------------------------------------------------------------
-- Storage: private uploads bucket + public approved bucket.
-- Path convention in both: {booking_id}/{filename}. The private-bucket
-- policies key off that first path segment to enforce booking ownership.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values
  ('exhibitor-logos', 'exhibitor-logos', false),
  ('exhibitor-logos-public', 'exhibitor-logos-public', true)
on conflict (id) do nothing;

-- Owner may upload/replace/read their own booking's logo in the private
-- bucket; admins may read everything. No authenticated policies on the
-- public bucket: objects land there only via the service-role approve
-- action, and reads go through the bucket's public URL.
create policy exhibitor_logos_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'exhibitor-logos'
    and exists (
      select 1 from public.bookings b
      where b.id::text = (storage.foldername(name))[1]
        and b.user_id = public.current_app_user_id()
    )
  );

create policy exhibitor_logos_owner_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'exhibitor-logos'
    and exists (
      select 1 from public.bookings b
      where b.id::text = (storage.foldername(name))[1]
        and b.user_id = public.current_app_user_id()
    )
  );

create policy exhibitor_logos_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'exhibitor-logos'
    and (
      public.is_super_admin()
      or exists (
        select 1 from public.bookings b
        where b.id::text = (storage.foldername(name))[1]
          and b.user_id = public.current_app_user_id()
      )
    )
  );

commit;
