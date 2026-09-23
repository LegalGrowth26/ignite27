-- Workshop hosts own their workshop's content (September 2026
-- refinement of the host-invite flow):
--
--   - The admin invites a host with a name, an email, and an optional
--     personal line. Nothing about the workshop is entered by the
--     admin: the host supplies the title, what it covers, what
--     you'll leave with, their headshot, and their logo from their
--     /speaker editor.
--   - When a host first completes their workshop details, the linked
--     workshop is created and PUBLISHED automatically: it appears on
--     /workshops immediately in a "time and room to be confirmed"
--     state. So starts_at/ends_at become nullable (null = not yet
--     scheduled) and there is deliberately NO published-implies-
--     scheduled constraint. Admin unpublish stays as the safety net.
--   - Rooms and times are admin-only, set later from the workshops
--     admin (Workshop Room One / Workshop Room Two), updating the
--     published row in place.
--   - Capacity is ALWAYS 24: fixed constant in the app, never an
--     admin field, never host-editable. The column keeps its range
--     check but defaults to 24 so inserts never state it.
--   - speaker_profiles.logo_path: the host's company logo, same
--     private->public copy pipeline as photos, owner-updatable.
--
-- The booking clash check (20260506's book_workshop) compares
-- starts_at/ends_at directly; NULL comparisons make an unscheduled
-- workshop clash with nothing, which is the intended behaviour.
--
-- Apply per convention: dev first via the Supabase SQL Editor, then
-- production before the PR merges. Requires 20260506 and 20260511.

begin;

alter table public.workshops
  alter column starts_at drop not null,
  alter column ends_at drop not null;

-- Times come as a pair or not at all; ordered when present.
alter table public.workshops
  drop constraint workshops_times_chk;
alter table public.workshops
  add constraint workshops_times_chk check (
    (starts_at is null and ends_at is null)
    or (starts_at is not null and ends_at is not null and ends_at > starts_at)
  );

alter table public.workshops
  alter column capacity set default 24;

alter table public.speaker_profiles
  add column logo_path text;

-- Owner grant: content column, same regime as photo_path (identity
-- and publication columns stay admin-only).
grant update (logo_path) on public.speaker_profiles to authenticated;

commit;
