# Ignite 27 — Product Specification

This is the source of truth for what the Ignite 27 platform does and how it
behaves. All business rules, pricing, eligibility, refund logic, and feature
scope live here. If you (Claude Code, developer, or organiser) are unsure how
something should work, the answer is in this file. If it is not in this file,
ask before guessing.

For coding conventions, see `CLAUDE.md`.
For brand voice and copy rules, see `COPYWRITING.md`.

---

## Open questions (resolve before relevant phase starts)

- [ ] Clean `previous_bookers_ignite26.csv` produced from Stripe + TOMCRM +
      spreadsheets, with email, first name, surname, company, booking type.
      **Owner: Tom. Deadline: end of February 2026.** Retained as a marketing
      list for the launch invite; no longer gates booking access.
- [ ] Confirm exhibitor stand allocation UX: simple text field on booking
      record (phase 1 default) vs. visual floor plan (later, if needed).
- [ ] Confirm printer requirements for badge PDFs (paper size, bleed, CMYK
      vs RGB) before phase 3 build starts.

---

## Event basics

- **Name:** Ignite 27
- **Date:** Thursday 21 January 2027
- **Time:** 09:30 to 16:30
- **Venue:** The Renaissance at Kelham Hall, Main Street, Newark, NG23 5QX
- **Domain:** ignite27.co.uk
- **Exhibitor capacity:** 50 spaces (hard limit)
- **Delegate capacity:** operationally uncapped, subject to venue planning.
  No specific attendee number is published on the public site.

---

## Phasing

Phases are defined by deadline, not feature count. Anything not listed in a
phase is out of scope for that phase.

### Phase 1 — ship by Tuesday 23 June 2026

(Buffer before the launch pricing period opens at 09:00 on Saturday
1 August 2026.)

- Public marketing site: Home, Attend, Exhibit, Sponsors, Partners, Venue,
  FAQ, Contact, Login, Terms, Refund Policy, Privacy Policy. Speakers and
  Agenda pages exist as "to be announced" placeholders.
- Date-driven pricing engine (see Pricing section).
- Delegate booking flow (Regular and VIP, optional lunch add-on).
- Exhibitor booking flow (company + 2 attendees + 2 lunches), capped by
  `EXHIBITOR_STAND_CAP`.
- Stripe Checkout integration with webhook handling, VAT-exclusive pricing
  (VAT shown as a separate line on receipts).
- Password-protected user account area: view booking, view ticket reference,
  view refund policy, request cancellation, resend confirmation email,
  request a correction to attendee details.
- Transactional emails via Resend: booking confirmation (delegate),
  booking confirmation (exhibitor), password reset,
  cancellation request received, correction request received.
- Cancellation-request mechanism (form submission to organisers, refunds
  processed manually via Stripe dashboard).
- Organiser dashboard (basic): list bookings, filter by type/date,
  view revenue totals, view dietary breakdown, action cancellation
  requests.
- CSV exports (named exports — see CSV Exports section).
- Legal pages with checkbox acceptance logged at point of purchase.

### Phase 2 — ship by Monday 30 November 2026

- Speakers page populated, individual speaker profile pages
  (admin-managed, not self-service).
- Agenda page populated, agenda planner in user account area.
- Workshop booking with phased priority access (see Workshops section).
- Referral system: unique referral links per booker, tracking,
  notification email to referrer.
- Share graphics generator (I'm attending / We're exhibiting / I'm speaking).
- Richer CMS editing in admin: speaker management, sponsor logos,
  homepage content, FAQ editing.
- Badge PDF generator built and proofed (so it can be tested in December
  before the 8 January 2027 printer deadline).

### Phase 3 — ship by Sunday 20 December 2026

- QR code generation for entry and lunch (two QRs per attendee).
- Mobile-first staff scanner page with role-based access.
- Scan-to-invalidate logic with green/red states.
- Lunch scan flow.
- Badge PDFs finalised and sent to printer in early January, ideally by
  8 January 2027.
- Advanced MI: check-ins, no-shows, referral performance, period-by-period
  revenue breakdown.

**Phase 3 operational requirement:** QR scanning must be built and tested
end-to-end in staging by early December 2026, with a live rehearsal at
the venue (or replicating venue WiFi conditions) in January 2027 before
21 January. The risk is operational, not technical.

### Out of scope for the 27 build

- Ignite Disruptive Business Awards (architecture should not preclude
  future expansion but no features are built for it in 27).
- Speaker self-service login. Speaker pages are admin-managed for 27.
- Visual exhibitor floor plan (text-field stand allocation only).
- Automated refund processing (refunds are manual via Stripe dashboard).
- Reward automation for referrals (organisers decide rewards manually).

---

## Roles

- **Super admin** (Tom Stansfield, Paul Green): full access to everything including admin
  dashboard, content editing, manual refunds via Stripe, manual booking
  creation, manual eligibility override, scanner access.
- **Scanner staff** (event-day staff): access only to the mobile scanner
  pages. No access to admin dashboard, no access to attendee data beyond
  what a scan reveals.
- **Attendee** (delegate, VIP, exhibitor contact): access to own account
  area only. View own booking, request cancellation, request correction,
  resend confirmation, manage own agenda (phase 2), access referral link
  (phase 2), download share graphics (phase 2), download own ticket QRs
  (phase 3).

---

## Pricing

All prices are in GBP and **ex-VAT**. VAT is added at the UK standard
rate of 20%. The platform's operating company is VAT-registered. Stripe
is configured to record VAT as an **exclusive** tax rate; receipts show
the ex-VAT price, the VAT amount, and the total.

**Public price displays show both figures**, e.g. "£25 + VAT (£30)". The
customer sees exactly what they pay. Lunch is the one exception (see
below): it is defined inc-VAT and shown flat.

Sponsorship pricing is held in this file but **not displayed publicly**;
sponsorship is enquiry-led.

### Delegate pricing (lunch NOT included)

| Period   | Price (ex-VAT) |
|----------|----------------|
| Launch   | £25            |
| Standard | £35            |
| Late     | £45            |

Optional lunch add-on for delegates: **£15 inc-VAT** (£12.50 ex-VAT +
£2.50 VAT). Displayed to customers as "£15" flat. Stripe records it
with the correct VAT breakdown.

### VIP pricing (lunch INCLUDED)

| Period   | Price (ex-VAT) |
|----------|----------------|
| Launch   | £69            |
| Standard | £85            |
| Late     | £99            |

VIP tickets always include lunch. There is no lunch add-on for VIPs.

### Exhibitor pricing

| Period               | Price (ex-VAT) |
|----------------------|----------------|
| Launch               | £189           |
| Standard (and Late)  | £249           |

Each exhibitor booking includes 2 attendee places and 2 lunches.

There is no separate Late price for exhibitors: sales continue at £249
into January until either (a) the stand cap is reached, or (b) bookings
close on Monday 18 January 2027, 17:00 UK, whichever comes first.

**Stand cap:** `EXHIBITOR_STAND_CAP` (config constant in
`lib/pricing/exhibitor.ts`, set to **50**; may be raised later). Only
PAID exhibitor bookings count toward the cap; abandoned Stripe checkouts
do not. When the cap is reached, the exhibitor booking UI shows "sold
out" and the server refuses further exhibitor checkouts.

### Sponsorship (ex-VAT, not shown publicly)

| Tier          | Price (ex-VAT) | Spots |
|---------------|----------------|-------|
| Headline      | £3,500         | 1     |
| Speakers Den  | £2,500         | 1     |
| Partner       | £1,000 each    | 5     |

**Enquiry-led. Do not display sponsorship pricing publicly.** Enquiries
route to tom@lincolnshiremarketing.co.uk and paul@businessunfinished.co.uk.
No checkout flow for sponsorship.

### Partners

Enquiry-led only. **Do not display partner pricing publicly.**
Enquiries route as above.

### Discount codes

Discount codes are managed entirely in the Stripe Dashboard. Tom
creates coupons under **Products → Coupons** and matching promotion
codes under **Products → Promotion codes**. Stripe controls:

- Discount amount (percent-off or fixed-amount).
- Activation and expiry dates.
- Maximum redemptions (total, or per-customer).
- Which SKUs a code applies to (via the coupon's `applies_to` setting)
  if Tom wants a code restricted to certain ticket types.

The site itself has **no admin UI** for discount management. Checkout
sessions enable `allow_promotion_codes: true`, so Stripe renders its
own "Add promotion code" field on the hosted Checkout page. Codes are
redeemable at any time, in any pricing period, including launch
week — the only gate is Stripe's own settings on the code.

Because pricing v2 uses `tax_behavior: "exclusive"` with Stripe Tax
enabled, a percent-off coupon reduces the ex-VAT amount and Stripe
recomputes 20% UK VAT on the discounted total. A 20% code on a £35
Standard delegate becomes £28 + £5.60 VAT = £33.60. No app-side
arithmetic.

**Per-booking tracking.** The webhook stores three columns on
`bookings` for every completed checkout:

- `promo_code` — the human-readable code (e.g. `STEPHINE20`), or null.
- `promo_code_id` — the Stripe promotion code id (e.g. `promo_...`).
- `discount_pence` — total discount applied in ex-VAT pence, or null.

To answer "which bookings used code X", query
`select * from bookings where promo_code = 'X'` — no reporting UI in
this build.

**Comps.** A 100%-off promotion code produces a zero-amount session
with `payment_status: 'no_payment_required'`. The webhook and booking
logic treat this as a valid completed booking: `payment_status` is
stored as `comp` (a distinct enum value from `paid`), the confirmation
email still goes out, and the customer gets the same account access as
any other delegate.

**How Tom creates a code:** Stripe Dashboard → **Products** →
**Coupons** → *Create a coupon* (choose percent-off or fixed-amount,
set duration to *Once*, optionally set expiry / max redemptions / SKU
restriction). Then **Products → Promotion codes → Create promotion
code**, attach it to the coupon, and set the customer-facing code
(e.g. `STEPHINE20`). Nothing else to do — the code goes live in the
customer's Checkout page immediately.

---

## Pricing periods

All times are UK local time (Europe/London, handles BST/GMT automatically).
Periods are half-open intervals `[opens, closes)`. There are no gaps and
no event-day sales.

| Period   | Opens                    | Closes                    |
|----------|--------------------------|---------------------------|
| Launch   | Sat 1 Aug 2026, 09:00    | Mon 17 Aug 2026, 00:00    |
| Standard | Mon 17 Aug 2026, 00:00   | Thu 31 Dec 2026, 23:59    |
| Late     | Fri 1 Jan 2027, 00:00    | Mon 18 Jan 2027, 17:00    |

Launch runs through Sunday 16 August 2026, 23:59:59 UK (the close
instant, Monday 17 August 00:00, belongs to Standard per the half-open
convention). Extended twice by organiser decision: from the original
72-hour window to 8 August (July 2026), then by one more week to
16 August (August 2026). Customer-facing copy frames it as "ends
16 August" / "the lowest price of the year"; the earlier "one week
only" phrasing was retired with the second extension.

**Bookings close entirely at Monday 18 January 2027, 17:00 UK.** After
that instant, `getCurrentPricing` throws `BookingsClosedError` and every
booking surface blocks new checkouts. There are no on-the-day or
event-day sales of any kind, delegate or exhibitor.

Before Saturday 1 August 2026 at 09:00 UK, `getCurrentPricing` throws
`BookingsNotOpenError`. The booking pages catch it and render a
"Bookings open 09:00, Saturday 1 August 2026" state with a disabled CTA.

### Alumni launch invite (marketing, not gating)

Previous Ignite 26 paid bookers are invited by email to book during the
launch period. This is a marketing send, not a technical eligibility
gate: booking is fully public from the moment launch opens. The
`previous_bookers` table survives as the source list for that marketing
send; the magic-link and eligibility-override machinery is removed.

---

## Booking flows

### Delegate flow

1. Choose Regular or VIP (current-window price displayed).
2. If Regular, optional lunch add-on (£15).
3. Enter attendee details (see schema).
4. Tick checkbox accepting Terms and Refund Policy. Acceptance is logged
   with timestamp and IP address.
5. Stripe Checkout (one-off payment, VAT-exclusive: VAT shown as a
   separate line on the receipt).
6. On webhook success, create or update user account (link by email),
   create booking record, send confirmation email.
7. Redirect to account area showing booking confirmation.

### Exhibitor flow

1. Confirm exhibitor space available (live count of remaining spaces).
2. Enter company details (name, contact, mobile, website, optional logo).
3. Enter attendee 1 and attendee 2 details including dietary requirements.
4. Tick checkbox accepting Terms and Refund Policy.
5. Stripe Checkout.
6. On webhook success, create user account for main contact, create
   exhibitor booking record with both attendees linked, send confirmation.

### Required booking fields

**Delegate:** first name, surname, email, mobile, company, job title,
dietary requirement (none/vegetarian/vegan/gluten-free), badge QR URL
(optional, see Badges section), marketing opt-in, ticket type, lunch
included flag.

**Exhibitor (company-level):** company name, main contact name, contact
email, contact mobile, company website, optional logo upload.

**Exhibitor (per attendee, x2):** first name, surname, email, mobile,
job title, dietary requirement, badge QR URL.

---

## Refund and cancellation logic

### Customer-facing rules (date-specific)

- **Up to and including 20 December 2026:** refund allowed minus
  Stripe processing fees.
- **21 December 2026 to 6 January 2027 inclusive:** refund at organiser
  discretion. No automatic right to refund.
- **7 January 2027 onward:** no refunds.

Stripe processing fees are non-refundable in all cases and are borne by
the purchaser. There is no separate organiser admin fee.

### Mechanism

Phase 1: User clicks "Request cancellation" in account area, fills a short
form (reason, optional notes), this emails Tom and Paul. Refunds are
processed manually via Stripe dashboard. User receives a confirmation
email when the request is received and another when actioned.

Phase 2 onward: same mechanism, no automation added.

### Logging

For each booking, the system stores:
- Timestamp of Terms acceptance.
- Timestamp of payment.
- Stripe payment intent ID.
- Cancellation request timestamp (if any).
- Cancellation outcome and timestamp (if any).
- Correction request timestamp and content (if any).

---

## Workshop booking (phase 2)

- Each workshop has 20 places.
- Booking uses **phased priority access**, not displacement.
- Tier access opens in stages (exact dates set when agenda is finalised):
  - Tier 1 (VIPs and partners): earliest access window.
  - Tier 2 (exhibitors): opens after Tier 1.
  - Tier 3 (regular delegates): opens after Tier 2.
- Within each tier window, booking is first come, first served.
- Once a place is held, it cannot be displaced.
- A user cannot book two workshops that clash on time.
- When a workshop is full, the UI shows "Fully booked" and the booking
  CTA is disabled.

---

## QR codes (phase 3)

- Every individual attendee has 2 unique QR codes: entry and lunch.
- This applies to delegates, VIPs, both exhibitor attendees, speakers,
  and on-site staff.
- Each QR encodes a signed token that maps to a single attendee + scan
  type (entry or lunch).
- On successful scan: token marked as used, scan logged with timestamp
  and scanner identity. UI shows green, attendee name, badge type, company.
- On reuse attempt: UI shows red, "Already scanned at HH:MM by [scanner]".
- On invalid token: UI shows red, "Invalid code".
- Scanning works in mobile browser via device camera. No app install.
- Scanner page is at a non-discoverable URL behind role-based auth.
  Scanner staff sign in once and remain authenticated for the event day.

---

## Badges (phase 2 build, phase 3 finalise)

- Six badge types: Delegate, VIP, Exhibitor, Staff, Speaker, Partner.
- Every badge includes: attendee name, company, badge type label,
  headline sponsor logo.
- Badges optionally include a personal QR code (links to attendee's
  chosen URL, typically LinkedIn or company website).
- **Badge QR behaviour when no URL provided:** the QR code is omitted
  from the badge entirely. The badge does not display a placeholder.
  Exception: speaker badges always include a QR linking to their speaker
  profile page on ignite27.co.uk if no personal URL is set.
- Speaker badges include speaker headshot.
- VIP badges use a visually distinct premium treatment (foil-style
  red/black, larger type, to be designed).
- Output is print-ready PDF, batch-exportable from admin (one PDF per
  badge or one combined PDF per badge type, organiser's choice at export).
- Printer specs to be confirmed before phase 3 finalisation.

---

## Referral system (phase 2)

- Every delegate and exhibitor gets a unique referral link
  (e.g. `ignite27.co.uk/?ref=XYZ123`).
- Visiting via a referral link sets a cookie; on completed booking, the
  referral is attributed to the booker.
- Referrer receives an automated email: "Someone booked because of you,
  thanks for spreading the word."
- Admin dashboard shows referral counts per referrer.
- No automated rewards. Organisers decide rewards manually.

---

## CSV exports

The admin dashboard provides the following named exports. Each is a
single-click download. Exports are timestamped in the filename.

### Phase 1
- **Attendees** — every individual person attending (delegate, VIP, both
  exhibitor attendees), with name, email, company, ticket type, dietary
  requirement, lunch flag, payment date, payment period.
- **Exhibitors** — exhibitor company list with main contact, both
  attendees, payment status, stand allocation field.
- **Lunch list** — every person with a lunch entitlement (VIPs, Regulars
  who added lunch, both exhibitor attendees), with name, company,
  dietary requirement.
- **Dietary summary** — counts and named individuals per dietary
  requirement (none, vegetarian, vegan, gluten-free).
- **Revenue by period** — total revenue and ticket counts grouped by
  pricing period (launch / standard / late), with VAT breakdown.

### Phase 2 adds
- **Workshop bookings** — every workshop with bookers, contact details,
  and remaining capacity.
- **Referral performance** — every referrer with count of attributed
  bookings.

### Phase 3 adds
- **Check-in status** — every attendee with entry-scan status, lunch-scan
  status, scan timestamps.
- **No-shows** — list of paid attendees with no entry scan recorded
  (for post-event follow-up).

All exports are UTF-8 CSV with a header row, ordered for human review
(name fields first, sensitive/admin fields last).

---

## Admin dashboard (phase 1 minimal, expands through phases)

### Phase 1
- Booking list with filters (type, period, date range).
- Revenue totals by booking type, with VAT breakdown.
- Dietary breakdown (count per requirement).
- Exhibitor stands remaining count (against `EXHIBITOR_STAND_CAP`).
- All phase 1 CSV exports.
- Cancellation requests inbox.
- Correction requests inbox.

### Phase 2 adds
- Speaker management (CRUD).
- Sponsor and partner logo management.
- Homepage and FAQ content editing.
- Agenda editing.
- Referral performance.
- Workshop booking visibility.

### Phase 3 adds
- Check-in counts (live during event).
- No-show reporting (post-event).
- Scan log viewer.
- Badge batch export.

---

## Email templates (Resend + react-email)

Phase 1:
- Booking confirmation (delegate)
- Booking confirmation (exhibitor)
- Password reset
- Cancellation request received
- Cancellation actioned (manual trigger from admin)
- Correction request received

Phase 2 adds:
- Referral attribution notification
- Workshop booking confirmation

Phase 3 adds:
- Pre-event reminder with QR codes attached
- Post-event thank you (with feedback link)

All transactional emails are sent as
`IGNITE! 27 <tom@lincolnshiremarketing.co.uk>` with reply-to
`tom@lincolnshiremarketing.co.uk` (decision: Tom, Aug 2026).
The from-address must live on a Resend-verified domain;
lincolnshiremarketing.co.uk is the only verified domain, and
ignite27.co.uk is NOT verified (Resend rejects sends from unverified
domains, which is what broke booking confirmations in production).

---

## Stripe webhook idempotency and retry

The `checkout.session.completed` webhook handler at
`/api/stripe/webhook` is idempotent and retry-safe. When an event
arrives we look up the matching row in `bookings` by
`stripe_checkout_session_id` and branch:

1. **No existing booking.** Create the booking and attendee rows,
   attempt the confirmation email. On a successful Resend dispatch,
   set `bookings.confirmation_email_sent_at`.
2. **Existing booking with `confirmation_email_sent_at` still NULL.**
   Skip the DB write (already done), attempt the confirmation email.
   On a successful dispatch, set the flag. This is the retry path
   that recovers a first attempt that persisted the booking but
   failed at Resend.
3. **Existing booking with `confirmation_email_sent_at` set.** No-op.
   The customer has already been emailed.

Email failures at any stage are logged and the webhook returns 200
so Stripe does not retry-storm on a transient email outage.
`confirmation_email_sent_at` stays NULL; Stripe's next scheduled retry
(up to three days) re-enters branch 2 and tries again. An admin can
also re-trigger from the Stripe dashboard ("Resend event") or from
the account area.

Concurrent duplicate deliveries from Stripe are rare but possible.
The handler accepts the risk of a double-email in that case rather
than marking the flag before the Resend call completes (which would
trade a visible double-send for a silent false-success if the process
crashed mid-send). If we ever observe double-sends in practice a
follow-up can add a Postgres advisory lock around the retry path.

---

## Email signup captures

Pre-content pages that want to collect emails from visitors waiting
for an announcement (currently `/agenda` and `/speakers`, and any
similar future page) write into a single table,
`public.email_signups`. Each row is scoped by a `source` string
identifying which page the signup came from, and a
`(email, source)` unique constraint means re-submitting the same
surface updates consent flags rather than duplicating.

The opt-in boolean on the row is `wants_topic_alert`. It simply
indicates that the user consented to receive alerts about whatever
topic the row's `source` represents. The `source` column is the
authoritative subject; the boolean is just "did they consent at
all". The column was introduced as `wants_agenda_alert` in migration
`20260421000000_email_signups.sql` when `/agenda` was the only
capture surface; it was renamed to `wants_topic_alert` in migration
`20260423000000_rename_consent_column.sql` once `/speakers` and
future pages meant the `agenda` prefix had become misleading.

Writes to the table happen only via server actions using the
service-role Supabase client. RLS denies all anon/authenticated
access except super-admin read; there are no public policies.

---

## Test mode overrides

The booking flow has one environment-variable override, used only for
pre-launch verification of the Stripe Checkout round-trip before the
launch pricing period opens. It is not a feature, it is a short-lived
testing aid. It must be unset before 09:00 on Saturday 1 August 2026.

### `BOOKING_TEST_OVERRIDE_DATE`

Set to an ISO 8601 instant (e.g. `2026-08-02T10:00:00Z`) to make the
delegate booking page and the server-side checkout-session creation treat
that instant as "now" when calling `getCurrentPricing`. The chosen date
determines which pricing period applies and therefore what Stripe charges.

Scope: the override affects **only** the booking flow.
- `/attend/book` page pricing calculation.
- The server action that creates the Stripe Checkout Session.

It does **not** affect:
- Home page live-pricing preview.
- `/attend` or `/exhibit` page pricing.
- The Stripe webhook handler (which reads already-persisted metadata).
- The refund-policy dates or anything else.

### Defence in depth

The override refuses to activate when `NEXT_PUBLIC_ENVIRONMENT` is
`production` (or `prod`) unless a second variable
`ALLOW_OVERRIDE_IN_PRODUCTION=true` is also set. Attempting to activate
without the allow flag throws a `BookingOverrideConfigError` and surfaces
as a 500 on the booking page.

### Visible banner

When active, `/attend/book` renders a red banner at the top reading
`TEST MODE: using override date <date>. Remove BOOKING_TEST_OVERRIDE_DATE
env var to disable.` The banner is server-rendered from the same source
of truth the pricing engine consumes, so it cannot drift.

### Pre-launch checklist

Before 1 August 2026 09:00 UK (launch opens), an operator must:

- Unset `BOOKING_TEST_OVERRIDE_DATE` in Vercel (all environments).
- Unset `ALLOW_OVERRIDE_IN_PRODUCTION` in Vercel (all environments).
- Redeploy.
- Visit `/attend/book?ticket=regular` and confirm the red banner is gone.

---

## Decision log convention

When a non-obvious product decision is made during the build, write a
short note to `decisions/YYYY-MM-DD-short-name.md` with: the decision,
the alternatives considered, the reason. This avoids re-litigating the
same questions and gives future-you (or a developer) the context for why
something is the way it is.
