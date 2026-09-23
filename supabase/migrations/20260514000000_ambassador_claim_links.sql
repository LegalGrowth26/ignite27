-- Ambassador link upgrades (September 2026):
--
--   1. Comp CLAIM LINK: every ambassador gets a stable unique token;
--      /claim/<token> lets a guest book their own free delegate
--      ticket. Enforcement stays where it already lives: the
--      issue_ambassador_comp function locks the ambassador row and
--      refuses past the allowance, so two simultaneous claims can
--      never overspend. The function is extended (drop + recreate,
--      not an overload, so PostgREST never sees two signatures) with
--      a source marker ('dashboard' = ambassador typed an email,
--      'claim_link' = the guest claimed it themselves). Comps carry
--      no lunch, so dietary stays 'none' as before.
--   2. The DISCOUNT SHARE LINK auto-apply needs no schema: it rides
--      on the existing slug + promo_code columns.
--
-- Apply per convention: dev first via the Supabase SQL Editor, then
-- production before the PR merges.

begin;

alter table public.ambassadors
  add column comp_claim_token uuid not null default gen_random_uuid();

create unique index ambassadors_claim_token_idx
  on public.ambassadors (comp_claim_token);

alter table public.ambassador_comps
  add column source text not null default 'dashboard'
    constraint ambassador_comps_source_chk
    check (source in ('dashboard', 'claim_link'));

-- Replace (not overload) the issuance function: PostgREST resolves
-- RPCs by name, and a second signature would make the call ambiguous.
drop function public.issue_ambassador_comp(
  uuid, text, uuid, text, text, citext, public.pricing_period
);

create function public.issue_ambassador_comp(
  p_ambassador_id uuid,
  p_booking_reference text,
  p_recipient_user_id uuid,
  p_first_name text,
  p_surname text,
  p_email citext,
  p_pricing_period public.pricing_period,
  p_source text default 'dashboard'
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
    ambassador_id, booking_id, recipient_name, recipient_email, source
  ) values (
    p_ambassador_id, v_booking_id,
    btrim(p_first_name || ' ' || p_surname), p_email, p_source
  );

  return v_booking_id;
end;
$$;

commit;
