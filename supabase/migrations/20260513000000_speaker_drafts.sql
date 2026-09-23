-- Fix: draft (unpublished) speaker profiles could not be created.
--
-- 20260509 defined speaker_profiles.published_at as NOT NULL DEFAULT
-- now() because adding a speaker meant announcing them. The host
-- invite work (draft invitees, startUnpublished) and the admin
-- unpublish action both write published_at = NULL, which this
-- constraint rejects: "Add draft invitee" failed in production, and
-- unpublishing any speaker page would have failed the same way. The
-- rest of the schema already assumed NULL means draft (the public
-- read policy is `published_at is not null`), so the NOT NULL was
-- simply wrong.
--
-- The default stays: adding a main-stage speaker still publishes
-- immediately unless the caller explicitly asks for a draft.
--
-- Apply per convention: dev first via the Supabase SQL Editor, then
-- production before the PR merges.

begin;

alter table public.speaker_profiles
  alter column published_at drop not null;

commit;
