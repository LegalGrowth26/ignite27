-- DEFERRED: do not apply until the pre-drop checklist in
-- supabase/migrations-deferred/README.md is complete.
--
-- Drops the three tables that supported the removed Window 1
-- eligibility gate. The tables are otherwise unused since pricing v2:
--   - magic_links           (hashed magic-link tokens for eligibility sessions)
--   - eligibility_overrides (manual Window 1 grants)
--   - previous_bookers      (Ignite 26 alumni list; also used as a
--                            marketing-send source, hence deferred)
--
-- Order matters only if any FKs point at these tables; the phase 1
-- schema has none. Drop indexes and triggers implicitly via
-- `drop table cascade`.

begin;

drop table if exists public.magic_links cascade;
drop table if exists public.eligibility_overrides cascade;
drop table if exists public.previous_bookers cascade;

commit;
