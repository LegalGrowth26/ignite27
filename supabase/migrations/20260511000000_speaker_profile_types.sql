-- Main-stage speakers vs workshop hosts (approved September 2026):
-- workshop hosts get the same self-managed profile treatment (invite,
-- editor, public page, contact form), presented differently.
--
--   - speaker_profiles.profile_type: 'main_stage' | 'workshop_host' |
--     'both' (enum with 'both', approved over a boolean pair: there is
--     no meaningful "neither" state and filters read cleanly). The
--     default backfills the three existing rows as main_stage.
--   - /speakers and the home cards show main_stage + both only; a
--     host's page swaps the talk block for their linked workshop(s);
--     'both' shows both blocks. One canonical URL for everyone:
--     /speakers/<slug> (approved).
--   - workshops.host_profile_id links a workshop to its host's
--     profile; the free-text speaker_name stays as the fallback for
--     unlinked hosts.
--
-- profile_type is deliberately NOT added to the owner update grant:
-- like slug and published_at, what someone is at IGNITE! is an admin
-- decision (the 20260509 grant enumerates content columns only, so no
-- grant change is needed; noted here for the record).
--
-- Apply per convention: dev first via the Supabase SQL Editor, then
-- production before the PR merges. Requires 20260509 (speaker
-- profiles, applied) and 20260506 (workshops, applied).

begin;

create type public.speaker_profile_type as enum
  ('main_stage', 'workshop_host', 'both');

alter table public.speaker_profiles
  add column profile_type public.speaker_profile_type
    not null default 'main_stage';

create index speaker_profiles_type_idx
  on public.speaker_profiles (profile_type, published_at);

alter table public.workshops
  add column host_profile_id uuid references public.speaker_profiles(id);

create index workshops_host_profile_idx
  on public.workshops (host_profile_id);

commit;
