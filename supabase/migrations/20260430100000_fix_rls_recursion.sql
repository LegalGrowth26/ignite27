-- Fix: infinite RLS recursion between bookings and booking_attendees.
--
-- Root cause (present since the phase 1 schema, surfaced by the admin
-- bookings view):
--   bookings_attendee_select          (on bookings)          runs EXISTS(... FROM booking_attendees ...)
--   booking_attendees_owner_select    (on booking_attendees) runs EXISTS(... FROM bookings ...)
-- When Postgres expands the policy quals for either table it must expand
-- the other's, which re-enters the first: "infinite recursion detected in
-- policy for relation booking_attendees". Any SELECT on either table as
-- the authenticated role hits it. Service-role writes (webhook) bypass
-- RLS, which is why bookings kept working while the customer account
-- pages quietly failed and the admin bookings view errored loudly.
--
-- Fix, standard pattern: move each cross-table check into a SECURITY
-- DEFINER function (stable, search_path pinned). The function runs as
-- the table owner, which is exempt from RLS, so evaluating the policy
-- never expands the other table's policies and the cycle is broken.
-- Semantics are identical to the original quals.
--
-- Forward-only. Apply to prod via the SQL Editor (dev first).

begin;

-- ---------------------------------------------------------------------------
-- Definer helpers. Owner (postgres) bypasses RLS inside the function body.
-- ---------------------------------------------------------------------------

create or replace function public.user_owns_booking(p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.bookings b
    where b.id = p_booking_id
      and b.user_id = public.current_app_user_id()
  );
$$;

create or replace function public.user_is_attendee_of_booking(p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.booking_attendees ba
    where ba.booking_id = p_booking_id
      and ba.user_id = public.current_app_user_id()
  );
$$;

-- ---------------------------------------------------------------------------
-- Recreate the two recursive policies on top of the helpers. All other
-- policies (owner-select on bookings, admin_all on both tables) are
-- unchanged; they never referenced another policied table.
-- ---------------------------------------------------------------------------

drop policy if exists bookings_attendee_select on public.bookings;
create policy bookings_attendee_select on public.bookings
  for select to authenticated
  using (public.user_is_attendee_of_booking(id));

drop policy if exists booking_attendees_owner_select on public.booking_attendees;
create policy booking_attendees_owner_select on public.booking_attendees
  for select to authenticated
  using (
    public.user_owns_booking(booking_id)
    or user_id = public.current_app_user_id()
  );

commit;
