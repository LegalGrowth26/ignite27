-- Speaker self-managed profiles (approved September 2026), mirroring
-- the exhibitor-profiles pattern: admin adds a speaker -> account +
-- page exist -> invite email -> the speaker edits their own public
-- page at /speaker. Published profiles are the SINGLE source for
-- /speakers, /speakers/<slug>, and the home speaker cards (the
-- hardcoded NAMED_SPEAKERS arrays are deleted with this feature).
--
-- user_id is NULLABLE: a page can be seeded before the speaker's
-- account exists (the three launch speakers are seeded account-less;
-- admin attaches an email later, which creates the account, links it
-- here, and sends the invite). A null user_id simply means nobody can
-- self-edit yet; admin editing always works.
--
-- Column-level grants keep slug, user_id, and published_at out of
-- speaker reach: identity and publication are ours, content is theirs.
-- Rows always exist before editing, so the editor uses plain UPDATE
-- (never upsert; see the requirements-form incident).
--
-- speaker_messages stores a copy of every "Get in touch" submission
-- and doubles as the rate-limit ledger (per-IP and per-speaker counts
-- are computed from it). Admin-read-only; the speaker's relay email is
-- never rendered publicly.
--
-- Apply per convention: dev first via the Supabase SQL Editor, then
-- production before the PR merges. Run the speaker backfill once after
-- deploying to seed the three existing speakers.

begin;

create table public.speaker_profiles (
  id uuid primary key default gen_random_uuid(),
  -- Null until an account is attached; unique so one account maps to
  -- at most one speaker page.
  user_id uuid unique references public.users(id),
  slug text not null unique
    constraint speaker_profiles_slug_chk
    check (slug ~ '^[a-z0-9][a-z0-9-]{1,49}$'),
  display_name text not null
    constraint speaker_profiles_name_chk
    check (length(btrim(display_name)) between 1 and 120),
  photo_path text,           -- private-bucket path; public copy mirrors it
  bio text not null default ''
    constraint speaker_profiles_bio_chk check (length(bio) <= 2000),
  talk_title text not null default ''
    constraint speaker_profiles_talk_title_chk check (length(talk_title) <= 200),
  talk_description text not null default ''
    constraint speaker_profiles_talk_desc_chk check (length(talk_description) <= 2000),
  -- ["bullet", ...] "what you'll learn" list, validated server-side
  -- (max 6 bullets, 200 chars each).
  talk_takeaways jsonb not null default '[]'::jsonb,
  website_url text,
  -- [{"platform": "linkedin", "url": "https://..."}], same allow-list
  -- as exhibitor profiles.
  social_links jsonb not null default '[]'::jsonb,
  cta_label text,
  cta_url text,
  -- Optional relay target for the contact form; falls back to the
  -- account email. NEVER rendered publicly.
  enquiries_email citext,
  -- Adding a speaker IS the announcement: published at creation.
  -- Admin unpublish nulls it (page 404s, listings drop it).
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger speaker_profiles_set_updated_at
before update on public.speaker_profiles
for each row execute function public.set_updated_at();

create index speaker_profiles_published_idx
  on public.speaker_profiles (published_at, display_name);

alter table public.speaker_profiles enable row level security;

create policy speaker_profiles_public_select on public.speaker_profiles
  for select to anon, authenticated
  using (published_at is not null);

-- The owner sees and edits their own profile whatever its publish
-- state (the editor keeps working while unpublished).
create policy speaker_profiles_owner_select on public.speaker_profiles
  for select to authenticated
  using (user_id is not null and user_id = public.current_app_user_id());

create policy speaker_profiles_owner_update on public.speaker_profiles
  for update to authenticated
  using (user_id is not null and user_id = public.current_app_user_id())
  with check (user_id is not null and user_id = public.current_app_user_id());

create policy speaker_profiles_admin_all on public.speaker_profiles
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Content is theirs; identity (slug, user_id) and publication are not.
revoke insert, update on public.speaker_profiles from authenticated;
grant update (
  display_name, photo_path, bio, talk_title, talk_description,
  talk_takeaways, website_url, social_links, cta_label, cta_url,
  enquiries_email
) on public.speaker_profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Contact-form messages: stored copy + rate-limit ledger. Inserts are
-- service-role only (the action validates, rate-limits, then relays).
-- ---------------------------------------------------------------------------

create table public.speaker_messages (
  id uuid primary key default gen_random_uuid(),
  speaker_profile_id uuid not null references public.speaker_profiles(id),
  sender_name text not null
    constraint speaker_messages_sender_name_chk
    check (length(btrim(sender_name)) between 1 and 100),
  sender_email citext not null,
  message text not null
    constraint speaker_messages_message_chk
    check (length(btrim(message)) between 1 and 2000),
  -- For the per-IP rate limit and abuse follow-up; admin-only surface.
  sender_ip text,
  relayed_at timestamptz,
  relay_error text,
  created_at timestamptz not null default now()
);

create index speaker_messages_ip_idx
  on public.speaker_messages (sender_ip, created_at);
create index speaker_messages_profile_idx
  on public.speaker_messages (speaker_profile_id, created_at);

alter table public.speaker_messages enable row level security;

create policy speaker_messages_admin_select on public.speaker_messages
  for select to authenticated
  using (public.is_super_admin());

revoke insert, update, delete on public.speaker_messages from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage: private photo uploads + public copies, mirroring the
-- exhibitor logo buckets. Path convention: {speaker_profile_id}/photo.ext;
-- owner policies key the first path segment back to the caller's own
-- profile row.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values
  ('speaker-photos', 'speaker-photos', false),
  ('speaker-photos-public', 'speaker-photos-public', true)
on conflict (id) do nothing;

create policy speaker_photos_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'speaker-photos'
    and exists (
      select 1 from public.speaker_profiles sp
      where sp.id::text = (storage.foldername(name))[1]
        and sp.user_id = public.current_app_user_id()
    )
  );

create policy speaker_photos_owner_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'speaker-photos'
    and exists (
      select 1 from public.speaker_profiles sp
      where sp.id::text = (storage.foldername(name))[1]
        and sp.user_id = public.current_app_user_id()
    )
  );

create policy speaker_photos_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'speaker-photos'
    and (
      public.is_super_admin()
      or exists (
        select 1 from public.speaker_profiles sp
        where sp.id::text = (storage.foldername(name))[1]
          and sp.user_id = public.current_app_user_id()
      )
    )
  );

commit;
