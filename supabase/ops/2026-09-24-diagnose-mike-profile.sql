-- READ-ONLY diagnosis for Mike Wistow's empty public page.
-- Run each query in the production SQL editor and send back the
-- results; nothing here writes anything.

-- 1. Every profile that could be Mike's, what it contains, and which
--    account it is linked to. TWO rows here would mean he is editing
--    one page while the public URL shows another (e.g. a leftover
--    'mike-wistow-2' from a repeated add while the draft-add bug was
--    live). updated_at says whether ANY save has landed.
select sp.id, sp.slug, sp.profile_type, sp.published_at, sp.updated_at,
       sp.photo_path, sp.logo_path, sp.website_url,
       left(coalesce(sp.bio, ''), 60) as bio_start,
       sp.talk_title,
       u.email as linked_account_email
from public.speaker_profiles sp
left join public.users u on u.id = sp.user_id
where sp.slug like 'mike%' or sp.display_name ilike '%wistow%';

-- 2. Mike's users rows and their auth linkage. Expect two rows (the
--    old aegirconsulting one and the wfttpartnership one), each with
--    has_auth = true and a DIFFERENT auth_user_id.
select id, email, auth_user_id, role, created_at
from public.users
where email in ('mike@wfttpartnership.co.uk', 'mike@aegirconsulting.co.uk');

-- 3. His photo uploads: did the file reach the private bucket, and
--    was the public copy made? Compare the two buckets.
select bucket_id, name, created_at
from storage.objects
where bucket_id in ('speaker-photos', 'speaker-photos-public')
order by created_at desc
limit 20;

-- How to read the results:
--   - Query 1 shows ONE row, fields NULL/empty, updated_at at invite
--     time: his saves are not landing (the silent zero-row update
--     this fix makes loud). Check linked_account_email is the
--     wfttpartnership address; if it is anything else, that mismatch
--     is the cause and I will give you a one-line relink.
--   - Query 1 shows TWO rows: he is editing one page and the world
--     is looking at the other; send me both rows and I will give you
--     a merge script.
--   - Query 1 shows his content present: saving works and the fault
--     is render-side; query 3 then says whether the public photo
--     copy is missing.
