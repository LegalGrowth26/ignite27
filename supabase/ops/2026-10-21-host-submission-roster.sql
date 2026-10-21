-- READ-ONLY: workshop host submission roster (from PR #79).
-- Paste into the Supabase SQL editor and run; changes nothing.
--
-- How to read it:
--   accepted = their invite has linked an account (they can log in).
--   A host appears in the new /speakers section when accepted is true
--   AND at least one of has_workshop_title / has_bio / has_photo is
--   true. All three false with accepted true = invited but yet to
--   save anything (nudge them); note Mike Wistow may need to re-save
--   if his early edits were lost to the silent-save bug fixed in #70.

select
  display_name,
  slug,
  user_id is not null as accepted,
  published_at is not null as page_published,
  nullif(btrim(talk_title), '') is not null as has_workshop_title,
  nullif(btrim(bio), '') is not null as has_bio,
  photo_path is not null as has_photo,
  logo_path is not null as has_logo,
  updated_at
from public.speaker_profiles
where profile_type = 'workshop_host'
order by display_name;
