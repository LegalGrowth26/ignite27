-- Partner management (approved September 2026): partner deals are sold
-- by Tom/Paul and invoiced OFFLINE (no checkout flow anywhere). Admin
-- records them here; agreed and paid partners appear on the public
-- strip (home + /exhibit) unless toggled hidden, linking straight to
-- the partner's own website. No partner pages, self-editing, or stand
-- linkage in v1 (noted as phase 2 in SPEC).
--
-- Tiers carry standard prices (Headline £3,500 / Speakers' Den £2,500 /
-- Partner £1,000) but each row stores agreed_price_pence because real
-- deals vary (decision: Allica at £2,500). Categories come from the
-- fixed exclusivity list in lib/partners/validate.ts; adding a partner
-- in an occupied category WARNS, never blocks.
--
-- RLS: NO anon/authenticated select policy AT ALL. The row carries
-- contact details, the agreed price, and admin notes, and row policies
-- cannot hide columns; the public strip reads via the service client
-- selecting only name/logo/website/tier (the bookings pattern). Admins
-- read via their policy; all writes are service-role from audit-logged
-- admin actions.
--
-- Logos: a single PUBLIC bucket. Only admins upload (service role), so
-- the private->public dance the exhibitor flow needs does not apply.
--
-- Apply per convention: dev first via the Supabase SQL Editor, then
-- production before the PR merges.

begin;

create type public.partner_tier as enum ('headline', 'speakers_den', 'partner');

create type public.partner_status as enum ('agreed', 'paid', 'ended');

create table public.partners (
  id uuid primary key default gen_random_uuid(),
  company_name text not null
    constraint partners_company_chk
    check (length(btrim(company_name)) between 1 and 200),
  contact_name text not null
    constraint partners_contact_chk
    check (length(btrim(contact_name)) between 1 and 120),
  contact_email citext not null,
  tier public.partner_tier not null,
  -- Standard tier price by default; overridable per deal.
  agreed_price_pence integer not null
    constraint partners_price_chk check (agreed_price_pence >= 0),
  -- From the fixed exclusivity list (validated app-side; stored
  -- lowercase so the clash check is trivially case-insensitive).
  category text not null
    constraint partners_category_chk
    check (length(btrim(category)) between 1 and 60),
  status public.partner_status not null default 'agreed',
  notes text not null default ''
    constraint partners_notes_chk check (length(notes) <= 2000),
  website_url text,
  logo_path text,   -- object path in the PUBLIC partner-logos bucket
  -- Admin visibility toggle: agreed AND paid partners show on the
  -- strip only while visible is true. Ended partners never show.
  visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger partners_set_updated_at
before update on public.partners
for each row execute function public.set_updated_at();

create index partners_category_idx on public.partners (lower(category));

alter table public.partners enable row level security;

create policy partners_admin_all on public.partners
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

revoke all on public.partners from anon;

-- Public logo bucket; writes come only from the service role, reads
-- via the bucket's public URL.
insert into storage.buckets (id, name, public)
values ('partner-logos', 'partner-logos', true)
on conflict (id) do nothing;

commit;
