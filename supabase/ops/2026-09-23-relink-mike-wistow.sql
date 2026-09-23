-- One-off (run once, production, Supabase SQL editor): consolidate
-- Mike Wistow under mike@wfttpartnership.co.uk.
--
-- Situation: Mike booked a ticket as mike@aegirconsulting.co.uk
-- (account A) and was invited as a workshop host under
-- mike@wfttpartnership.co.uk (account B, which holds his speaker
-- profile and ambassador row). He wants EVERYTHING under the
-- wfttpartnership address.
--
-- Decision, stated: the BOOKING MOVES to account B. Moving is the
-- safer call here because it is a handful of user_id foreign-key
-- updates in one transaction (fully reversible by swapping the two
-- emails below and re-running), whereas leaving it would keep Mike's
-- identity permanently split across two logins, which is the exact
-- complaint. Nothing about the money moves: Stripe references,
-- amounts, and the booking reference are untouched.
--
-- The attendee row's CONTACT EMAIL also moves to the wfttpartnership
-- address so event-day emails (scheduled updates, workshop notices)
-- reach the inbox he wants. The confirmation email he already
-- received at the aegirconsulting address is history, not data we
-- store, so nothing is lost.
--
-- Account A (aegirconsulting) is left in place but empty: harmless,
-- and deleting accounts is not something we do in a hurry.
--
-- Safe to re-run: every UPDATE is keyed on account A's id and finds
-- nothing on a second pass. The script aborts loudly if either
-- account is missing or the speaker profile is not where expected.

do $$
declare
  v_keep public.users%rowtype;   -- mike@wfttpartnership.co.uk (B)
  v_old public.users%rowtype;    -- mike@aegirconsulting.co.uk (A)
  v_profile_user uuid;
  v_moved_bookings int;
  v_moved_attendees int;
  v_moved_workshops int;
begin
  select * into v_keep from public.users
    where email = 'mike@wfttpartnership.co.uk';
  if v_keep.id is null then
    raise exception 'keep-account mike@wfttpartnership.co.uk not found';
  end if;

  select * into v_old from public.users
    where email = 'mike@aegirconsulting.co.uk';
  if v_old.id is null then
    raise exception 'old account mike@aegirconsulting.co.uk not found';
  end if;

  -- Speaker profile: expected to already sit on the keep-account
  -- (the invite went to that email). Relink if it is unlinked or on
  -- the old account; abort if it is on some third account.
  select user_id into v_profile_user
    from public.speaker_profiles where slug = 'mike-wistow';
  if v_profile_user is distinct from v_keep.id then
    if v_profile_user is not null and v_profile_user <> v_old.id then
      raise exception 'mike-wistow profile is linked to an unexpected account %', v_profile_user;
    end if;
    update public.speaker_profiles
      set user_id = v_keep.id
      where slug = 'mike-wistow';
  end if;

  -- The ticket and everything hanging off it.
  update public.bookings
    set user_id = v_keep.id
    where user_id = v_old.id;
  get diagnostics v_moved_bookings = row_count;

  update public.booking_attendees
    set user_id = v_keep.id,
        email = 'mike@wfttpartnership.co.uk'
    where user_id = v_old.id;
  get diagnostics v_moved_attendees = row_count;

  update public.workshop_bookings
    set user_id = v_keep.id
    where user_id = v_old.id;
  get diagnostics v_moved_workshops = row_count;

  raise notice 'moved: % bookings, % attendee rows, % workshop bookings; profile now on %',
    v_moved_bookings, v_moved_attendees, v_moved_workshops, v_keep.email;
end;
$$;

-- Verify afterwards (expect the booking, its attendee, and the
-- profile all under mike@wfttpartnership.co.uk, and nothing left
-- under aegirconsulting):
--   select b.booking_reference, u.email
--   from public.bookings b join public.users u on u.id = b.user_id
--   where u.email like 'mike@%';
--   select slug, u.email from public.speaker_profiles sp
--   join public.users u on u.id = sp.user_id where slug = 'mike-wistow';
