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
      **Owner: Tom. Deadline: end of February 2026.**
- [ ] Confirm exhibitor stand allocation UX: simple text field on booking
      record (phase 1 default) vs. visual floor plan (later, if needed).
- [ ] Confirm printer requirements for badge PDFs (paper size, bleed, CMYK
      vs RGB) before phase 3 build starts.
- [ ] Confirm whether Window 1 fallback (Stripe Payment Links + manual
      import) is required, by end of May 2026.

---

## Event basics

- **Name:** Ignite 27
- **Date:** Sunday 31 January 2027
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

(One week buffer before Window 1 opens at 09:00 on 30 June 2026.)

- Public marketing site: Home, Attend, Exhibit, Sponsors, Partners, Venue,
  FAQ, Contact, Login, Terms, Refund Policy, Privacy Policy. Speakers and
  Agenda pages exist as "to be announced" placeholders.
- Date-driven pricing engine (see Pricing section).
- Previous-bookers seed import from CSV.
- Window 1 magic-link eligibility flow with manual organiser override.
- Delegate booking flow (Regular and VIP, optional lunch add-on).
- Exhibitor booking flow (company + 2 attendees + 2 lunches).
- Stripe Checkout integration with webhook handling, VAT-inclusive pricing,
  VAT shown on receipts.
- Password-protected user account area: view booking, view ticket reference,
  view refund policy, request cancellation, resend confirmation email,
  request a correction to attendee details.
- Transactional emails via Resend: booking confirmation (delegate),
  booking confirmation (exhibitor), magic link, password reset,
  cancellation request received, correction request received.
- Cancellation-request mechanism (form submission to organisers, refunds
  processed manually via Stripe dashboard).
- Organiser dashboard (basic): list bookings, filter by type/date,
  view revenue totals, view dietary breakdown, action cancellation
  requests, manual override for Window 1 eligibility.
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
  before printer deadline in early January).

### Phase 3 — ship by Sunday 20 December 2026

- QR code generation for entry and lunch (two QRs per attendee).
- Mobile-first staff scanner page with role-based access.
- Scan-to-invalidate logic with green/red states.
- Lunch scan flow.
- Badge PDFs finalised and sent to printer in early January.
- Advanced MI: check-ins, no-shows, referral performance, window-by-window
  revenue breakdown.

**Phase 3 operational requirement:** QR scanning must be built and tested
end-to-end in staging by early December 2026, with a live rehearsal at
the venue (or replicating venue WiFi conditions) in January 2027 before
event day. The risk is operational, not technical.

### Out of scope for the 27 build

- Ignite Disruptive Business Awards (architecture should not preclude
  future expansion but no features are built for it in 27).
- Speaker self-service login. Speaker pages are admin-managed for 27.
- Visual exhibitor floor plan (text-field stand allocation only).
- Automated refund processing (refunds are manual via Stripe dashboard).
- Reward automation for referrals (organisers decide rewards manually).

---

## Roles

- **Super admin** (Tom, Paul): full access to everything including admin
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

All pricing is in GBP and **VAT-inclusive**. The platform's operating
company is VAT-registered. Stripe is configured to record VAT on each
transaction and Stripe receipts show the VAT breakdown. Public-facing
prices on the site are the inclusive price the customer pays.

### Delegate pricing

| Window     | Regular | VIP  |
|------------|---------|------|
| 1          | £39     | £99  |
| 2          | £49     | £119 |
| 3          | £59     | £139 |
| 4          | £69     | £159 |
| Event day  | £74     | £164 |

Lunch add-on for Regular delegates: **£15 fixed across all windows.**
VIP price always includes lunch.

Event-day pricing is Window 4 plus a £5 charity uplift per ticket. The
£5 uplift goes to the **Lincoln City Foundation** and appears on the
Stripe receipt as a separate line item: "Lincoln City Foundation donation."

### Exhibitor pricing

| Window | Price |
|--------|-------|
| 1      | £200  |
| 2      | £250  |
| 3      | £325  |
| 4      | £400  |

Each exhibitor booking includes 2 attendee places and 2 lunches.
**Exhibitor bookings are not available on event day.**

### Sponsorship

Enquiry-led only. **Do not display sponsorship pricing publicly.**
Enquiries route to tom@lincolnshiremarketing.co.uk and
paul@businessunfinished.co.uk.

### Partners

Enquiry-led only. **Do not display partner pricing publicly.**
Enquiries route as above.

---

## Pricing windows

All times are UK local time (Europe/London, handles BST/GMT automatically).

| Window | Opens | Closes | Eligibility |
|--------|-------|--------|-------------|
| 1 | Tue 30 Jun 2026, 09:00 | Thu 2 Jul 2026, 09:00 | Previous Ignite 26 paid bookers only, via magic link |
| 2 | Thu 2 Jul 2026, 09:00 | Sun 19 Jul 2026, 23:59 | Public |
| 3 | Mon 20 Jul 2026, 00:00 | Thu 31 Dec 2026, 23:59 | Public |
| Christmas drop | Fri 25 Dec 2026, 00:00 | Fri 25 Dec 2026, 23:59 | Public, prices revert to Window 2 silently, overriding Window 3 |
| 4 | Fri 1 Jan 2027, 00:00 | Sat 30 Jan 2027, 23:59 | Public |
| Event day | Sun 31 Jan 2027, 00:00 | Sun 31 Jan 2027, end of event | Public, +£5 charity uplift, delegate only (no exhibitor sales) |

**Booking is open continuously from 09:00 on 30 June 2026 onward.**
Pricing is determined automatically by whichever window is active at the
moment of checkout. There are no closed gaps between windows. The Christmas
Day drop is intentionally undocumented publicly. The pricing function
returns Window 2 prices for any request on 25 December 2026.

---

## Window 1 eligibility

- Eligibility = anyone with a paid Ignite 26 booking (delegate or exhibitor).
- Source list = `previous_bookers_ignite26.csv` seeded into a
  `previous_bookers` table on first deployment.
- Source CSV is reconciled from Stripe (truth source for "paid"), enriched
  with name/company/booking type from TOMCRM and spreadsheets.
- During Window 1, the Attend and Exhibit pages show an email entry form
  before pricing/checkout is revealed.
- User enters email; if email matches a row in `previous_bookers`, a magic
  link is sent via Resend; clicking the link grants a session that unlocks
  Window 1 pricing for that user.
- If email does not match, the user is shown a polite message
  ("Window 1 is for Ignite 26 alumni only. Window 2 opens 2 July at
  09:00") and a form to join the waiting list.

### Manual eligibility override

Edge cases will occur. Examples: alumnus has changed email address;
exhibitor paid for the team under one email so colleagues do not
self-match; someone paid on behalf of someone else. The admin dashboard
includes a "grant Window 1 access" action where Tom or Paul can manually
add an email to the eligibility list, triggering a magic link to that
address. All overrides are logged with admin identity and reason.

### Fallback

If the platform is not ready by 23 June 2026, Window 1 runs manually:
- Stripe Payment Links created for Regular, VIP, and Exhibitor at Window 1
  prices.
- A Tally form captures booker details and dietary requirements.
- Bookings are imported into the platform once it goes live, with original
  purchase timestamps preserved.

Decision on whether to invoke the fallback to be made by end of May 2026.

---

## Booking flows

### Delegate flow

1. Choose Regular or VIP (current-window price displayed).
2. If Regular, optional lunch add-on (£15).
3. Enter attendee details (see schema).
4. Tick checkbox accepting Terms and Refund Policy. Acceptance is logged
   with timestamp and IP address.
5. Stripe Checkout (one-off payment, VAT-inclusive).
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

- **Up to and including 30 December 2026:** refund allowed minus
  Stripe processing fees.
- **31 December 2026 to 16 January 2027 inclusive:** refund at organiser
  discretion. No automatic right to refund.
- **17 January 2027 onward:** no refunds.

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
  requirement, lunch flag, payment date, payment window.
- **Exhibitors** — exhibitor company list with main contact, both
  attendees, payment status, stand allocation field.
- **Lunch list** — every person with a lunch entitlement (VIPs, Regulars
  who added lunch, both exhibitor attendees), with name, company,
  dietary requirement.
- **Dietary summary** — counts and named individuals per dietary
  requirement (none, vegetarian, vegan, gluten-free).
- **Revenue by window** — total revenue and ticket counts grouped by
  pricing window, with VAT breakdown.

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
- Booking list with filters (type, window, date range).
- Revenue totals by booking type, with VAT breakdown.
- Dietary breakdown (count per requirement).
- Exhibitor space remaining count.
- All phase 1 CSV exports.
- Cancellation requests inbox.
- Correction requests inbox.
- Manual Window 1 eligibility override (grant + log).

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
- Window 1 magic link
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

All transactional emails are sent from `noreply@ignite27.co.uk` with
reply-to `tom@lincolnshiremarketing.co.uk`. All emails sent from a
verified domain on Resend.

---

## Decision log convention

When a non-obvious product decision is made during the build, write a
short note to `decisions/YYYY-MM-DD-short-name.md` with: the decision,
the alternatives considered, the reason. This avoids re-litigating the
same questions and gives future-you (or a developer) the context for why
something is the way it is.
