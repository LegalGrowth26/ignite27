# CI gate and the auto-merge policy

Date: 2026-09-23
Status: adopted

## Context

Four times now a migration-carrying PR was merged before its SQL was
applied, and today a bad conflict resolution (merge 5dd8976, landed
via PR #61) reached main with a syntax error and blocked production
deploys. Nothing mechanical stood between a red diff and main.

## Decision

1. **CI on everything.** `.github/workflows/ci.yml` runs typecheck,
   the unit test suite, and a production build on every PR and every
   push to main. Playwright e2e is excluded (needs live test
   credentials; run locally).
2. **Branch protection.** main requires the `CI / checks` status to
   pass before merging. (Enabled by hand in GitHub: Settings →
   Branches → Add branch protection rule → pattern `main` → Require
   status checks to pass before merging → select `checks`.)
3. **Auto-merge for safe PRs.** A PR that is green on CI and contains
   NO file under `supabase/migrations/` is merged immediately by the
   agent that opened it, and its branch deleted. The report states
   plainly that it is merged and deploying.
4. **Migration exception.** Any PR touching `supabase/migrations/` is
   NEVER auto-merged. It is opened, the report says "migration PR:
   run `<file>` then say merge", and it waits for a human who has
   applied the SQL (dev then prod) to say merge.

## Consequences

- Today's breakage class (syntax error, type error, build failure in
  a merge resolution) cannot reach main once protection is on: CI
  runs against the PR head, including merge-of-main commits pushed to
  the branch.
- Schema/code ordering stays human-controlled, which is the part
  automation kept getting wrong.
