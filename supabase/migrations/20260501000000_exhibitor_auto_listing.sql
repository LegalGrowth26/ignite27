-- Exhibitor auto-listing: /exhibit lists every exhibitor booking with a
-- successful LIVE payment automatically (name first, logo and website
-- joining as the exhibitor submits them). Admin approval no longer gates
-- the listing; instead admins get a hide toggle for pulling a listing
-- down quickly.
--
-- listing_hidden_at is the hide flag: null = listable, timestamp = hidden.
-- Hide, not delete: the booking row is untouched and the actor + action
-- are recorded in admin_audit ('exhibitor.listing_hide' / '.listing_show'),
-- so no hidden_by column is needed here.
--
-- The confirmed_exhibitors table and the approved_at/approved_by columns
-- on exhibitor_requirements stop driving the public site with this
-- change. They are left in place (forward-only migrations; no data is
-- destroyed) and can be dropped in a later cleanup migration once the
-- new listing has bedded in.
--
-- Apply per convention: dev first via the Supabase SQL Editor, then
-- production before the PR merges.

begin;

alter table public.bookings
  add column listing_hidden_at timestamptz;

comment on column public.bookings.listing_hidden_at is
  'When set, this exhibitor booking is hidden from the public /exhibit listing. Set/cleared only by super admins via the admin dashboard (service role); audit-logged in admin_audit.';

commit;
