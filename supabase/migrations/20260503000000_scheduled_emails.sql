-- Pre-event scheduled emails, sent via Resend from /admin/emails.
-- Recipients are resolved at SEND time (late bookers included) and
-- snapshotted into scheduled_email_sends, whose unique
-- (scheduled_email_id, attendee_email) constraint is the idempotency
-- key: retries and resumed cron ticks can never double-add a
-- recipient, and a recipient row is only ever processed from
-- 'pending'.
--
-- These are event-service messages to ticket holders (agenda, travel,
-- parking, day-before practicalities), sent through the existing
-- Resend choke point. Promotional sends route through TomCRM
-- (GoHighLevel), not this system.
--
-- Apply per convention: dev first via the Supabase SQL Editor, then
-- production before the PR merges.

begin;

create type public.scheduled_email_status as enum
  ('scheduled', 'sending', 'sent', 'cancelled');

create type public.scheduled_email_audience as enum
  ('all_attendees', 'delegates', 'vips', 'exhibitors');

create table public.scheduled_emails (
  id uuid primary key default gen_random_uuid(),
  subject text not null
    constraint scheduled_emails_subject_chk
    check (length(btrim(subject)) between 1 and 200),
  -- Plain paragraphs separated by blank lines; bare URLs are
  -- auto-linked at render time. No HTML is stored.
  body text not null
    constraint scheduled_emails_body_chk check (length(btrim(body)) > 0),
  audience public.scheduled_email_audience not null,
  send_at timestamptz not null,
  status public.scheduled_email_status not null default 'scheduled',
  created_by uuid not null references public.users(id),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger scheduled_emails_set_updated_at
before update on public.scheduled_emails
for each row execute function public.set_updated_at();

create index scheduled_emails_due_idx
  on public.scheduled_emails (status, send_at);

create table public.scheduled_email_sends (
  id uuid primary key default gen_random_uuid(),
  scheduled_email_id uuid not null
    references public.scheduled_emails(id) on delete cascade,
  attendee_email citext not null,
  booking_id uuid references public.bookings(id),
  status text not null default 'pending'
    constraint scheduled_email_sends_status_chk
    check (status in ('pending', 'sent', 'failed')),
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  -- The idempotency key.
  unique (scheduled_email_id, attendee_email)
);

create index scheduled_email_sends_pending_idx
  on public.scheduled_email_sends (scheduled_email_id, status);

-- RLS: admins read everything (the sent/failed counts in the UI); all
-- writes go through the service role (cron route + admin actions).
alter table public.scheduled_emails enable row level security;

create policy scheduled_emails_admin_select on public.scheduled_emails
  for select to authenticated
  using (public.is_super_admin());

alter table public.scheduled_email_sends enable row level security;

create policy scheduled_email_sends_admin_select on public.scheduled_email_sends
  for select to authenticated
  using (public.is_super_admin());

commit;
