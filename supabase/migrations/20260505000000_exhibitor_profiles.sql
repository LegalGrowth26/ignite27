-- Exhibitor profile pages: a public page per paid exhibitor booking at
-- /exhibitors/<slug>, created AUTOMATICALLY when the booking lands
-- (webhook) or via the one-off admin backfill. No approval step: paid
-- booking = page exists; admins can unpublish or edit any page as the
-- safety net. This table also becomes the SINGLE source for the
-- /exhibit strip and the new /exhibitors index (published = listed),
-- superseding the bookings-derived listing rule.
--
-- Content is exhibitor-editable from their account (RLS owner update
-- via the user_owns_booking definer helper). Column-level grants keep
-- slug, booking_id, and published_at out of exhibitor reach: identity
-- and publication are ours, content is theirs. Rows always exist
-- before editing, so the editor uses plain UPDATE (deliberately no
-- upsert: see the requirements-form incident for why upsert and
-- column grants do not mix).
--
-- All content is stored as plain text and validated server-side
-- (URLs http(s)-only, social platforms allow-listed, length caps);
-- rendering escapes everything, so nothing user-entered can inject
-- markup.
--
-- Apply per convention: dev first via the Supabase SQL Editor, then
-- production before the PR merges. Run the admin backfill straight
-- after deploying so existing exhibitors get pages.

begin;

create table public.exhibitor_profiles (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id),
  -- URL identity: stable once minted (admin-only edits later if ever).
  slug text not null unique
    constraint exhibitor_profiles_slug_chk
    check (slug ~ '^[a-z0-9][a-z0-9-]{1,49}$'),
  display_name text not null
    constraint exhibitor_profiles_name_chk
    check (length(btrim(display_name)) between 1 and 120),
  description text
    constraint exhibitor_profiles_description_chk
    check (description is null or length(description) <= 2000),
  logo_path text,            -- private-bucket path; public copy mirrors it
  website_url text,          -- rendered as a followable backlink
  -- [{"platform": "linkedin", "url": "https://..."}], validated
  -- server-side against the platform allow-list.
  social_links jsonb not null default '[]'::jsonb,
  cta_primary_label text,
  cta_primary_url text,
  cta_secondary_label text,
  cta_secondary_url text,
  show_contact_email boolean not null default false,
  contact_email citext,
  -- Auto-published at creation; admin unpublish nulls it (page 404s,
  -- listings drop it, nothing is deleted).
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger exhibitor_profiles_set_updated_at
before update on public.exhibitor_profiles
for each row execute function public.set_updated_at();

create index exhibitor_profiles_published_idx
  on public.exhibitor_profiles (published_at, display_name);

alter table public.exhibitor_profiles enable row level security;

-- Public pages and listings read published profiles only.
create policy exhibitor_profiles_public_select on public.exhibitor_profiles
  for select to anon, authenticated
  using (published_at is not null);

-- The owner sees their own profile whatever its state (the editor must
-- keep working while unpublished) and edits its CONTENT columns.
create policy exhibitor_profiles_owner_select on public.exhibitor_profiles
  for select to authenticated
  using (public.user_owns_booking(booking_id));

create policy exhibitor_profiles_owner_update on public.exhibitor_profiles
  for update to authenticated
  using (public.user_owns_booking(booking_id))
  with check (public.user_owns_booking(booking_id));

create policy exhibitor_profiles_admin_all on public.exhibitor_profiles
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Column-level defence in depth: exhibitors edit content, never
-- identity (slug, booking_id) or publication (published_at). Creation
-- is service-role only, so no insert grant for authenticated. The
-- update grant lists ONLY the content columns; the editor updates with
-- booking_id in the filter, never the payload.
revoke insert, update on public.exhibitor_profiles from authenticated;
grant update (
  display_name, description, logo_path, website_url, social_links,
  cta_primary_label, cta_primary_url, cta_secondary_label,
  cta_secondary_url, show_contact_email, contact_email
) on public.exhibitor_profiles to authenticated;

commit;
