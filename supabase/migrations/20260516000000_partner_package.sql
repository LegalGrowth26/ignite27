-- Partner package (approved September 2026): a partnership INCLUDES
-- its benefits, configured on the partner record, not bolted on
-- through separate ambassador admin.
--
--   - 2 delegate places WITH LUNCH for the partner's own people: a £0
--     booking of the new booking_type 'partner', created when the
--     partner is added (decision: adding the record IS the agreed
--     deal; money-derived payment status makes "on first payment"
--     ambiguous under part-payments). Named attendees with dietary,
--     TBC allowed, exactly like exhibitor bookings.
--   - Built-in comps: partners.comp_allowance (default 2, 0 allowed)
--     drives an auto-provisioned ambassador row for the contact.
--     ambassadors.partner_id marks rows the partner form OWNS, so
--     allowance edits sync only to those and can never trample an
--     unrelated pre-existing ambassador (the no-trample rule).
--   - Attendee SELF-EDIT for multi-place bookings: RLS owner policy +
--     column grants on booking_attendees, unlocking the "until
--     self-edit ships" state on exhibitor bookings at the same time.
--     NOTE: the policy says booking_type <> 'delegate' rather than
--     naming 'partner', because Postgres refuses to use an enum value
--     added in the same transaction; with three values the two spell
--     the same set. Delegate name changes stay on the corrections
--     channel deliberately (badge changes want an audit trail).
--
-- Apply per convention: dev first via the Supabase SQL Editor, then
-- production before the PR merges. Requires 20260514 and 20260515.

begin;

-- Not referenced again inside this transaction (see note above).
alter type public.booking_type add value if not exists 'partner';

alter table public.partners
  add column comp_allowance integer not null default 2
    constraint partners_comp_allowance_chk check (comp_allowance >= 0),
  add column package_booking_id uuid references public.bookings(id);

alter table public.ambassadors
  add column partner_id uuid references public.partners(id);

create unique index ambassadors_partner_idx
  on public.ambassadors (partner_id)
  where partner_id is not null;

-- Owner self-edit of attendee slots on multi-place bookings. The
-- booking must be theirs and active; identity columns (user_id,
-- booking_id, indexes, lunch, badge) stay unreachable via the column
-- grant below.
create policy booking_attendees_owner_update on public.booking_attendees
  for update to authenticated
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_attendees.booking_id
        and b.user_id = public.current_app_user_id()
        and b.booking_status = 'active'
        and b.booking_type <> 'delegate'
    )
  )
  with check (
    exists (
      select 1 from public.bookings b
      where b.id = booking_attendees.booking_id
        and b.user_id = public.current_app_user_id()
        and b.booking_status = 'active'
        and b.booking_type <> 'delegate'
    )
  );

revoke update on public.booking_attendees from authenticated;
grant update (
  first_name, surname, email, mobile, job_title,
  dietary_requirement, dietary_other
) on public.booking_attendees to authenticated;

commit;
