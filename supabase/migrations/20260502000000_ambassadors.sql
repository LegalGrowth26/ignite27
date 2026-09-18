-- Ambassador hub, phase 1: speakers and key partners who help sell
-- tickets. Each ambassador is a platform user (new role 'ambassador')
-- with a row here carrying their share-link slug, comp allowance, and
-- click counter. Attributed bookings stamp bookings.ambassador_id
-- (last-touch, resolved at webhook time from checkout metadata).
--
-- Comp tickets are REAL bookings: payment_status 'comp', no Stripe
-- session (stripe_checkout_session_id is nullable-unique, so NULLs are
-- fine), gross 0. issue_ambassador_comp() below creates booking +
-- attendee + comp record in ONE transaction with the ambassador row
-- locked, so a double-submit can never exceed the allowance.
--
-- RLS discipline matches the customer surfaces: ambassadors see ONLY
-- their own row and their own comps; booking counts come from a
-- SECURITY DEFINER function that verifies ownership and returns counts
-- only (no revenue, no rows, no other ambassadors). All writes are
-- service-role only.
--
-- Apply per convention: dev first via the Supabase SQL Editor, then
-- production before the PR merges.

begin;

-- Safe inside this transaction: no later statement in this file uses
-- the new enum value in DDL (the app compares it at runtime only).
alter type public.user_role add value if not exists 'ambassador';

create type public.ambassador_type as enum ('speaker', 'partner');

create table public.ambassadors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id),
  -- The ?ref= slug: lowercase, 2-30 chars, a-z 0-9 and hyphens.
  slug text not null unique
    constraint ambassadors_slug_chk check (slug ~ '^[a-z0-9][a-z0-9-]{1,29}$'),
  display_name text not null,
  company text,
  ambassador_type public.ambassador_type not null,
  comp_allowance integer not null default 0
    constraint ambassadors_allowance_chk check (comp_allowance >= 0),
  -- Personal discount code, phase 2. Held here so phase 1 admin can
  -- already record the intended percent.
  discount_percent integer
    constraint ambassadors_discount_chk
    check (discount_percent between 1 and 100),
  promo_code text,
  -- Coarse click counter (every ?ref= hit; no dedupe, by decision).
  link_clicks integer not null default 0,
  -- Deactivate = link stops attributing, dashboard locks, history kept.
  deactivated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger ambassadors_set_updated_at
before update on public.ambassadors
for each row execute function public.set_updated_at();

create table public.ambassador_comps (
  id uuid primary key default gen_random_uuid(),
  ambassador_id uuid not null references public.ambassadors(id),
  booking_id uuid not null unique references public.bookings(id),
  recipient_name text not null,
  recipient_email citext not null,
  created_at timestamptz not null default now()
);

create index ambassador_comps_ambassador_id_idx
  on public.ambassador_comps (ambassador_id);

alter table public.bookings
  add column ambassador_id uuid references public.ambassadors(id);

create index bookings_ambassador_id_idx on public.bookings (ambassador_id);

-- ---------------------------------------------------------------------------
-- RLS. Default deny; ambassadors read their own data, admins read all,
-- every write goes through the service role.
-- ---------------------------------------------------------------------------

alter table public.ambassadors enable row level security;

create policy ambassadors_self_select on public.ambassadors
  for select to authenticated
  using (user_id = public.current_app_user_id());

create policy ambassadors_admin_all on public.ambassadors
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

alter table public.ambassador_comps enable row level security;

create policy ambassador_comps_self_select on public.ambassador_comps
  for select to authenticated
  using (
    exists (
      select 1 from public.ambassadors a
      where a.id = ambassador_comps.ambassador_id
        and a.user_id = public.current_app_user_id()
    )
  );

create policy ambassador_comps_admin_select on public.ambassador_comps
  for select to authenticated
  using (public.is_super_admin());

-- No ambassador-facing policy on bookings: attributed-booking numbers
-- come from this counts-only definer function, which verifies the
-- caller owns the ambassador row (or is a super admin).
create or replace function public.ambassador_booking_counts(p_ambassador_id uuid)
returns table (paid_bookings bigint, comp_bookings bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.ambassadors a
    where a.id = p_ambassador_id
      and (a.user_id = public.current_app_user_id() or public.is_super_admin())
  ) then
    raise exception 'not allowed';
  end if;

  return query
    select
      count(*) filter (where b.payment_status = 'paid'),
      count(*) filter (where b.payment_status = 'comp')
    from public.bookings b
    where b.ambassador_id = p_ambassador_id
      and b.booking_status = 'active';
end;
$$;

-- ---------------------------------------------------------------------------
-- Atomic comp issuance. Called via the service role from the gated
-- server action AFTER the recipient's auth account + users row exist.
-- Locks the ambassador row so concurrent submits cannot exceed the
-- allowance, and creates booking + attendee + comp record in one
-- transaction (no orphan-booking window on this path).
-- ---------------------------------------------------------------------------
create or replace function public.issue_ambassador_comp(
  p_ambassador_id uuid,
  p_booking_reference text,
  p_recipient_user_id uuid,
  p_first_name text,
  p_surname text,
  p_email citext,
  p_pricing_period public.pricing_period
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ambassador public.ambassadors%rowtype;
  v_used bigint;
  v_booking_id uuid;
begin
  select * into v_ambassador
  from public.ambassadors
  where id = p_ambassador_id
  for update;

  if v_ambassador.id is null then
    raise exception 'ambassador not found';
  end if;
  if v_ambassador.deactivated_at is not null then
    raise exception 'ambassador deactivated';
  end if;

  select count(*) into v_used
  from public.ambassador_comps
  where ambassador_id = p_ambassador_id;

  if v_used >= v_ambassador.comp_allowance then
    raise exception 'comp allowance exhausted';
  end if;

  insert into public.bookings (
    user_id, booking_reference, booking_type, ticket_type,
    pricing_period, gross_amount_pence, vat_amount_pence, currency,
    lunch_included, payment_status, booking_status, ambassador_id
  ) values (
    p_recipient_user_id, p_booking_reference, 'delegate', 'regular',
    p_pricing_period, 0, 0, 'gbp',
    false, 'comp', 'active', p_ambassador_id
  )
  returning id into v_booking_id;

  insert into public.booking_attendees (
    booking_id, user_id, first_name, surname, email,
    dietary_requirement, lunch_entitlement, is_primary_contact,
    attendee_index
  ) values (
    v_booking_id, p_recipient_user_id, p_first_name, p_surname, p_email,
    'none', false, true, 1
  );

  insert into public.ambassador_comps (
    ambassador_id, booking_id, recipient_name, recipient_email
  ) values (
    p_ambassador_id, v_booking_id, btrim(p_first_name || ' ' || p_surname), p_email
  );

  return v_booking_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Atomic click increment for the beacon route (service role). A plain
-- UPDATE would work; the function keeps it a single round trip and
-- no-ops silently for unknown or deactivated slugs.
-- ---------------------------------------------------------------------------
create or replace function public.increment_ambassador_clicks(p_slug text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.ambassadors
  set link_clicks = link_clicks + 1
  where slug = p_slug
    and deactivated_at is null;
$$;

commit;
