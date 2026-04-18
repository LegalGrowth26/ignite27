# Claude Code instructions for Ignite 27

You are working on the Ignite 27 platform. Read `SPEC.md` for product
rules and `COPYWRITING.md` for brand voice. This file covers how to work
in this repo: stack, conventions, what to do when uncertain.

---

## Stack

- **Next.js 15+** with App Router and TypeScript (strict mode)
- **Tailwind CSS** for styling, no other CSS framework
- **Supabase** for auth, Postgres, storage. Use the official `@supabase/ssr`
  package for Next.js integration. Use Row Level Security on every table.
- **Stripe** for payments via Stripe Checkout (hosted). Use webhooks, not
  polling, to confirm payment.
- **Resend** for transactional email, paired with **react-email** for
  templates.
- **Vercel** for hosting. Three environments: local, staging, production.
- **pnpm** as the package manager.
- **Vitest** for unit tests, **Playwright** for end-to-end tests.

Do not add other major dependencies without asking. Specifically: no
state management library (use React state and server components),
no UI component library (build minimal components in-repo), no ORM
(use the Supabase client directly with typed queries).

---

## Repo conventions

- App lives in `app/` (App Router).
- Shared UI components in `components/`.
- Server-side logic (database queries, Stripe, Resend) in `lib/`.
- Email templates in `emails/`.
- Database migrations in `supabase/migrations/`.
- Tests live next to the file they test as `*.test.ts`, with end-to-end
  tests in `e2e/`.
- Decision log in `decisions/`, one file per decision.

Naming:
- Files: kebab-case (`booking-form.tsx`, `pricing-engine.ts`).
- React components: PascalCase exports.
- Database tables and columns: snake_case.
- Environment variables: SCREAMING_SNAKE_CASE.

---

## Branch flow

- `main` → production deploy on Vercel.
- `develop` → staging deploy on Vercel.
- Feature branches → `feat/short-description`, opened against `develop`.
- Bug fixes → `fix/short-description`.
- One PR per feature. Squash merge to `develop`. Promote `develop` to
  `main` only when staging has been verified.

Never push directly to `main` or `develop`. Never run destructive
migrations against production without explicit approval in the prompt.

---

## When you are uncertain

If the spec does not answer a question, **ask**. Do not invent a rule
and ship it. If you must make a small judgement call to keep moving
(e.g. a UI detail not covered in the spec), state the assumption in
the PR description so it can be reviewed.

If you find a contradiction between `SPEC.md`, `COPYWRITING.md`, and
this file, stop and flag it rather than picking one.

---

## What to test, what not to test

Write unit tests for:
- The pricing engine (every window boundary, Christmas Day, event-day
  uplift, lunch add-on, exhibitor pricing).
- Refund eligibility logic (every date boundary).
- Window 1 eligibility checking.
- Workshop priority access logic (phase 2).
- QR token generation and validation (phase 3).

Write end-to-end tests for:
- Delegate booking happy path.
- Exhibitor booking happy path.
- Cancellation request flow.
- Window 1 magic-link flow.
- Scanner happy path (phase 3).

Do not test:
- Third-party SDKs (Stripe, Supabase, Resend).
- Trivial components.
- Layout and styling.

---

## Database conventions

- Every table has `id` (uuid, default gen_random_uuid()), `created_at`
  (timestamptz default now()), `updated_at` (timestamptz default now(),
  triggered on update).
- Foreign keys named `<table>_id`.
- Soft deletes via `deleted_at` only where genuinely needed (bookings,
  yes; ephemeral records, no).
- All tables have RLS policies. Default deny, then allow per role.
- Migrations are forward-only. Never edit a committed migration,
  write a new one.

---

## Stripe conventions

- Use Stripe Checkout (hosted page), not custom card forms. Less PCI
  scope, less code, fewer ways to break.
- Each booking creates a Stripe Checkout Session with `mode: 'payment'`.
- Webhook endpoint at `app/api/stripe/webhook/route.ts` handles
  `checkout.session.completed` to confirm and create the booking record.
- Always verify the webhook signature.
- Idempotency: if a webhook fires twice for the same session, the second
  call is a no-op.
- Refunds are manual via Stripe dashboard for phase 1. Do not build
  refund automation.
- VAT: Stripe is configured to record VAT on each transaction. Prices
  passed to Checkout are VAT-inclusive (the price the customer sees and
  pays). Stripe receipts show the VAT breakdown.

---

## Email conventions

- All transactional emails go via Resend.
- Templates live in `emails/` as react-email components.
- Always include a plain text fallback.
- All transactional emails are sent from `noreply@ignite27.co.uk` with
  reply-to `tom@lincolnshiremarketing.co.uk`. Replies from customers go
  to Tom's inbox.
- Never send email from inside a webhook handler synchronously, queue
  it (or send it after the database write succeeds, with a try/catch
  that logs but does not fail the request).
- For dev and staging, send only to allowlisted addresses (Tom and Paul,
  plus any test address). Never send to real customer addresses from
  non-production environments.

---

## Security conventions

- Never log full email addresses, payment details, or magic-link tokens.
- Never expose Supabase service role key to the client. Server-side only.
- Use Supabase RLS for authorisation, not application-level checks
  (defence in depth, but RLS is the gate).
- Scanner staff role grants access only to scanner endpoints. Verify
  on every request, not just at login.

---

## Performance and accessibility

- Mobile-first. Test every page at 375px width before considering it done.
- All interactive elements must be keyboard accessible.
- All images must have alt text. Decorative images use `alt=""`.
- Page weight target: under 200KB initial load on the public site.

---

## What to do at the start of every session

1. Read `SPEC.md` if you have not already in this session.
2. Read this file (`CLAUDE.md`) if you have not already.
3. Look at recent commits and any open PRs to understand current state.
4. Confirm what task you are doing and which phase it belongs to.
5. If working on user-facing copy, also read `COPYWRITING.md`.
