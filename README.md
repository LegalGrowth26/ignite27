# Ignite 27

Booking platform for Ignite 27, Thursday 21 January 2027 at Kelham Hall, Newark.

For product rules read `SPEC.md`. For coding conventions read `CLAUDE.md`. For
brand voice and copy read `COPYWRITING.md`. If you are uncertain about a rule,
those three files are the source of truth.

---

## Stack

- Next.js 15 App Router with TypeScript (strict)
- Tailwind CSS
- Supabase (auth, Postgres, storage) with Row Level Security
- Stripe Checkout
- Resend with react-email
- Vitest for unit tests, Playwright for end-to-end tests
- Hosted on Vercel
- pnpm for package management

---

## Getting started

Requires Node 22+ and pnpm 10+.

```bash
pnpm install
cp .env.local.example .env.local
# fill in the values in .env.local before running the app
pnpm dev
```

The app runs at `http://localhost:3000`.

---

## Scripts

| Command | What it does |
|---------|--------------|
| `pnpm dev` | Start the Next.js dev server |
| `pnpm build` | Build for production |
| `pnpm start` | Run the production build |
| `pnpm lint` | Run ESLint |
| `pnpm typecheck` | Run `tsc --noEmit` |
| `pnpm test` | Run Vitest once |
| `pnpm test:watch` | Run Vitest in watch mode |
| `pnpm test:e2e` | Run Playwright end-to-end tests |
| `pnpm test:e2e:install` | Install Playwright browsers (first run only) |
| `pnpm email:dev` | Preview react-email templates |

---

## Environments

We run two environments, not three.

| Environment | Supabase project | Vercel deployment | Stripe mode |
|-------------|------------------|-------------------|-------------|
| local | Shared dev Supabase project (or local Supabase) | `pnpm dev` on your machine | Stripe test mode |
| prod | Production Supabase project | `main` branch auto-deploy on Vercel | Stripe live mode |

Secrets for each environment are managed in Vercel and in a shared password
manager. Never commit real secrets to the repo. `.env.local` is gitignored.

Email: in local, `EMAIL_ALLOWLIST_ENABLED=true` restricts transactional sends
to addresses listed in the `email_allowlist` table. Production sends to real
customers.

---

## Branch flow

- `main` is production.
- Feature branches are named `feat/short-description` or `fix/short-description`
  and opened against `main`.
- One PR per feature. Squash merge.
- Never push directly to `main`.

See `CLAUDE.md` for the full convention.

---

## Database

Migrations live in `supabase/migrations/`. They are forward-only. Never edit a
committed migration; write a new one.

Every table has `id`, `created_at`, `updated_at` (trigger-maintained), and RLS
enabled with default-deny policies. See `supabase/migrations/20260418000000_phase1_schema.sql`
for the phase 1 schema.

---

## Tests

Unit tests live next to the file they cover as `*.test.ts`. End-to-end tests
live in `e2e/`. See `CLAUDE.md` for what to test and what not to test.
