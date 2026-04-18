# Ignite 27 — copywriting and brand voice

This file governs all user-facing copy: marketing pages, button labels,
form errors, email subject lines and body text, confirmation messages,
admin UI labels visible to users.

It does not govern code comments, commit messages, internal admin labels,
or technical documentation. Write those normally.

---

## Voice in one line

Disruptive, energetic, useful. Sounds like a sharp founder, not a
marketing department.

---

## What we sound like

- Direct. Short sentences. Active verbs.
- Confident, not cocky. We back claims with substance.
- Warm, not corporate. We talk to humans, not "stakeholders."
- Useful. Every line earns its place. If a sentence does not move the
  reader closer to a decision, cut it.

## What we do not sound like

- Conference-brochure prose ("an unparalleled opportunity to network with
  industry leaders").
- LinkedIn-influencer posturing ("here's what nobody is telling you").
- Apologetic SaaS copy ("we'd love to help you...").
- Aggressive sales hype ("LIMITED SPOTS! ACT NOW!").

---

## Hard rules

These are non-negotiable. Break one and the copy gets sent back.

1. **No em dashes.** Use commas, full stops, or colons instead. This
   applies to all user-facing copy. Code, internal docs, and commit
   messages can use whatever punctuation they like.

2. **The 🔥 emoji is reserved.** Use it only in moments where the fire
   metaphor is genuinely earned (a launch announcement, an event-day
   message). Never as decoration. Never more than once per page or email.
   Default: do not use it.

3. **No "stale coffee" or recycled Ignite 26 lines verbatim.** The 27
   voice should evolve. The spirit is the same; the phrasing is fresh.

4. **No empty corporate verbs.** Avoid "leverage," "unlock," "empower,"
   "elevate," "synergise," "ideate," "circle back." If one of these
   shows up in a draft, rewrite it.

5. **Numbers, not vague claims.** "50 exhibitor stands" beats "lots of
   exhibitors." Where exact numbers are not yet known, use honest
   placeholders ("speakers to be announced") rather than vague claims.

6. **Pricing copy is exact.** Always show the inclusive price the
   customer pays. Always say what is included. For VIPs: "Lunch
   included." For Regular: "Add lunch for £15."

---

## Brand vocabulary

Use:
- **Ignite** (capitalised, no exclamation mark in body copy unless
  intentional)
- **Ignite 27** (no space, no hyphen)
- **delegate** (lowercase) for Regular ticket holders
- **VIP** (uppercase)
- **exhibitor** (lowercase)
- **headline sponsor** (lowercase)
- **the day** or **event day** when referring to 21 January

Avoid:
- "attendee" in customer-facing copy (it sounds bureaucratic). Use
  "delegate" or, if mixed audience, "you."
- "expo" — Ignite is not an expo. Use "event" or "Ignite."
- "conference" — same reason.
- "ticket holder" — use "delegate" or "VIP."

---

## CTAs

Strong CTAs are direct verbs, not soft invitations.

Use:
- "Book your place"
- "Reserve your stand"
- "Get the details"
- "See the agenda"
- "Get in touch"

Avoid:
- "Learn more"
- "Click here"
- "Submit"
- "Find out more"

---

## Form copy

- Labels are short and human. "Your name" not "Full name (required)."
- Required fields are marked with a small `*`, not the word "required."
- Error messages are specific and tell the user what to do.
  Good: "We need an email so we can send your ticket."
  Bad: "Invalid input."
- Success messages are warm and confirm what happened.
  Good: "Booked. Check your inbox for your ticket."
  Bad: "Submission successful."

---

## Email copy

- Subject lines: short, specific, no clickbait.
  Good: "Your Ignite 27 ticket"
  Bad: "🎉 You're in!! Welcome to the Ignite 27 family!"
- Open with the useful information. Save context for later in the email.
- Sign off as "The Ignite team," not from a named individual unless
  it is genuinely from Tom or Paul.
- Plain text fallback is required and should read naturally on its own.

---

## Pricing and refund copy

These are the two areas where unclear copy causes the most support
volume. Be precise.

Pricing:
- Always lead with the price the customer pays.
- Always state what is included.
- For Regular delegates, the lunch upsell is a clear, single line at
  the point of decision: "Add lunch for £15."

Refunds:
- Use the exact dates from `SPEC.md`, not vague phrases.
- State the Stripe fee policy plainly: "Refunds are minus Stripe's
  processing fee, which we cannot recover."
- The refund policy page is the authoritative version. Booking-flow
  copy should summarise and link to it.

---

## "To be announced" copy

Where speakers, sessions, or workshops are not yet announced, do not
fake content. Use honest placeholders that build anticipation:

- "Speaker reveal coming soon."
- "Workshops launch with the agenda."
- "More to come."

Do not write "Speaker name | Speaker title | Speaker bio" with lorem
ipsum. Empty real placeholders are better than full fake ones.

---

## When in doubt

Read it aloud. If it sounds like a press release, rewrite it. If it
sounds like a friend telling you about something they're excited about,
ship it.
