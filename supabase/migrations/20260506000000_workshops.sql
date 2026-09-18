-- Workshops (Part 1): admin-managed workshop catalogue with free,
-- capacity-limited, self-service booking for ticket holders.
--
-- Model decisions (approved September 2026):
--   - Workshops are FREE and separate from paid tickets. Anyone holding
--     a completed booking (paid live or comp, active) can book, for
--     THEMSELVES only in v1 (contact-books-for-colleagues is a noted
--     follow-up).
--   - Priority window: VIP ticket holders can book from
--     1 January 2027 00:00 UK; everyone else from 4 January 2027
--     00:00 UK. Both instants are GMT (winter), so they are stored as
--     the matching UTC constants here AND mirrored in
--     lib/workshops/config.ts for the UI. The database function is the
--     authoritative gate.
--   - No per-person limit on workshop count; the only per-person rule
--     is NO TIME CLASHES between booked workshops.
--   - Capacity is enforced atomically (workshop row locked) so two
--     racing bookings can never oversell a room.
--   - Un-booking is allowed until the day before the event: cancels
--     close at 2027-01-21 00:00 UK (start of event day).
--   - Draft/published via published_at (null = draft), matching the
--     announcements/profiles pattern. Public reads published only.
--
-- Also adds the 'everyone_except_vips' scheduled-email audience so the
-- "workshops now open to everyone" announcement does not double-email
-- VIPs who already had their window.
--
-- Apply per convention: dev first via the Supabase SQL Editor, then
-- production before the PR merges.

begin;

-- Safe inside this transaction: no later statement in this file uses
-- the new enum value (the app compares it at runtime only).
alter type public.scheduled_email_audience add value if not exists 'everyone_except_vips';

create table public.workshops (
  id uuid primary key default gen_random_uuid(),
  title text not null
    constraint workshops_title_chk check (length(btrim(title)) between 1 and 200),
  description text not null default ''
    constraint workshops_description_chk check (length(description) <= 5000),
  speaker_name text
    constraint workshops_speaker_chk check (speaker_name is null or length(speaker_name) <= 120),
  room text
    constraint workshops_room_chk check (room is null or length(room) <= 120),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  constraint workshops_times_chk check (ends_at > starts_at),
  capacity integer not null
    constraint workshops_capacity_chk check (capacity between 1 and 1000),
  -- null = draft. Publishing makes it visible and bookable (once the
  -- booking window opens); unpublishing hides it but keeps bookings.
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger workshops_set_updated_at
before update on public.workshops
for each row execute function public.set_updated_at();

create index workshops_published_starts_idx
  on public.workshops (published_at, starts_at);

create table public.workshop_bookings (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id),
  user_id uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  -- One place per person per workshop; also the idempotency key for
  -- double submits.
  unique (workshop_id, user_id)
);

create index workshop_bookings_user_idx on public.workshop_bookings (user_id);
create index workshop_bookings_workshop_idx on public.workshop_bookings (workshop_id);

-- ---------------------------------------------------------------------------
-- RLS. Default deny; published workshops are public, bookings are
-- visible to their owner and admins. ALL booking writes go through the
-- SECURITY DEFINER functions below (no insert/delete grants at all).
-- ---------------------------------------------------------------------------

alter table public.workshops enable row level security;

create policy workshops_public_select on public.workshops
  for select to anon, authenticated
  using (published_at is not null);

create policy workshops_admin_all on public.workshops
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

alter table public.workshop_bookings enable row level security;

create policy workshop_bookings_own_select on public.workshop_bookings
  for select to authenticated
  using (user_id = public.current_app_user_id());

create policy workshop_bookings_admin_select on public.workshop_bookings
  for select to authenticated
  using (public.is_super_admin());

revoke insert, update, delete on public.workshop_bookings from authenticated;

-- ---------------------------------------------------------------------------
-- Eligibility helper: does the CALLER hold any completed event booking,
-- and do they hold a VIP one? A completed booking is active with
-- payment_status paid or comp; the caller counts whether they own the
-- booking (bookings.user_id) or are a linked named attendee
-- (booking_attendees.user_id, e.g. an exhibitor's second attendee once
-- their account exists).
-- ---------------------------------------------------------------------------

create or replace function public.workshop_eligibility()
returns table (has_booking boolean, is_vip boolean)
language sql
security definer
set search_path = public
stable
as $$
  select
    coalesce(bool_or(true), false) as has_booking,
    coalesce(
      bool_or(b.booking_type = 'delegate' and b.ticket_type = 'vip'),
      false
    ) as is_vip
  from public.bookings b
  left join public.booking_attendees ba on ba.booking_id = b.id
  where (b.user_id = public.current_app_user_id()
         or ba.user_id = public.current_app_user_id())
    and b.booking_status = 'active'
    and b.payment_status in ('paid', 'comp');
$$;

-- ---------------------------------------------------------------------------
-- book_workshop: the ONLY way a booking row is created. Validates
-- everything server-side so a hand-crafted API call gets exactly the
-- same rules as the UI:
--   signed in -> holds a completed booking -> window open for their
--   tier -> workshop published -> no time clash -> capacity left.
-- The workshop row is locked FOR UPDATE for the capacity check, so
-- two racing bookings for the last place serialise and the second one
-- fails cleanly.
--
-- Errors are raised with stable 'code:' prefixes the app maps to
-- friendly copy: not_signed_in, no_ticket, not_open_yet,
-- not_found, full, clash:<title>, already_booked (returned, not
-- raised: double submits are harmless).
-- ---------------------------------------------------------------------------

create or replace function public.book_workshop(p_workshop_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_has_booking boolean;
  v_is_vip boolean;
  v_opens timestamptz;
  v_workshop public.workshops%rowtype;
  v_taken bigint;
  v_clash_title text;
begin
  v_user := public.current_app_user_id();
  if v_user is null then
    raise exception 'not_signed_in';
  end if;

  select e.has_booking, e.is_vip into v_has_booking, v_is_vip
  from public.workshop_eligibility() e;

  if not v_has_booking then
    raise exception 'no_ticket';
  end if;

  -- 2027-01-01 00:00 UK and 2027-01-04 00:00 UK; both GMT so the UTC
  -- constants match the local instants exactly. Mirrored in
  -- lib/workshops/config.ts.
  v_opens := case when v_is_vip
    then timestamptz '2027-01-01 00:00:00+00'
    else timestamptz '2027-01-04 00:00:00+00' end;
  if now() < v_opens then
    raise exception 'not_open_yet';
  end if;

  select * into v_workshop
  from public.workshops
  where id = p_workshop_id
  for update;

  if v_workshop.id is null or v_workshop.published_at is null then
    raise exception 'not_found';
  end if;

  -- Clash rule: no overlap with any other workshop this person has
  -- booked. Touching end/start times (13:00-14:00 then 14:00-15:00)
  -- are NOT a clash.
  select w.title into v_clash_title
  from public.workshop_bookings wb
  join public.workshops w on w.id = wb.workshop_id
  where wb.user_id = v_user
    and wb.workshop_id <> p_workshop_id
    and w.starts_at < v_workshop.ends_at
    and w.ends_at > v_workshop.starts_at
  limit 1;
  if v_clash_title is not null then
    raise exception 'clash:%', v_clash_title;
  end if;

  select count(*) into v_taken
  from public.workshop_bookings
  where workshop_id = p_workshop_id;
  if v_taken >= v_workshop.capacity then
    raise exception 'full';
  end if;

  begin
    insert into public.workshop_bookings (workshop_id, user_id)
    values (p_workshop_id, v_user);
  exception when unique_violation then
    return 'already_booked';
  end;

  return 'booked';
end;
$$;

-- ---------------------------------------------------------------------------
-- cancel_workshop_booking: self-service un-book, allowed until the day
-- before the event (closes 2027-01-21 00:00 UK, start of event day).
-- Deleting frees the place immediately. No-op result if there was
-- nothing to cancel.
-- ---------------------------------------------------------------------------

create or replace function public.cancel_workshop_booking(p_workshop_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_deleted integer;
begin
  v_user := public.current_app_user_id();
  if v_user is null then
    raise exception 'not_signed_in';
  end if;

  if now() >= timestamptz '2027-01-21 00:00:00+00' then
    raise exception 'too_late';
  end if;

  delete from public.workshop_bookings
  where workshop_id = p_workshop_id and user_id = v_user;
  get diagnostics v_deleted = row_count;

  return case when v_deleted > 0 then 'cancelled' else 'not_booked' end;
end;
$$;

grant execute on function public.workshop_eligibility() to authenticated;
grant execute on function public.book_workshop(uuid) to authenticated;
grant execute on function public.cancel_workshop_booking(uuid) to authenticated;
revoke execute on function public.workshop_eligibility() from anon;
revoke execute on function public.book_workshop(uuid) from anon;
revoke execute on function public.cancel_workshop_booking(uuid) from anon;

commit;
