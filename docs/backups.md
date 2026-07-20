# Database backups

Nightly `pg_dump` of the **production** Supabase database, uploaded
as a GitHub Actions workflow artifact with 90-day retention. Runs at
**03:00 UK** (02:00 UTC — see the schedule note in the workflow for
the BST/GMT caveat) and on-demand via `workflow_dispatch`.

Workflow file: [`.github/workflows/nightly-backup.yml`](../.github/workflows/nightly-backup.yml)

## Setup (one time — Tom does this)

The workflow needs one repo secret. Until it is set every run will
fail loudly with a clear error message.

1. Sign in to <https://supabase.com/dashboard>.
2. Pick the **production** project.
3. Left sidebar → **Project Settings** → **Database**.
4. Scroll to **Connection string**. Pick the tab labelled **URI**
   under the **Connection pooling** section (session mode, port
   `5432`). Copy that string. It looks like:

    ```
    postgresql://postgres.<project-ref>:<db-password>@aws-0-eu-west-2.pooler.supabase.com:5432/postgres
    ```

    If the `<db-password>` placeholder is shown as `[YOUR-PASSWORD]`
    click **Reset database password**, save the new password
    somewhere safe (1Password), and paste it into the URL. The
    password may contain special characters — URL-encode them
    (`@` → `%40`, `#` → `%23`, `:` → `%3A`, etc.).
5. In GitHub go to the ignite27 repo → **Settings** → **Secrets and
   variables** → **Actions** → **New repository secret**.
6. Name: `SUPABASE_DB_URL`. Value: the full URI from step 4.
   Save.
7. Trigger the workflow once manually to confirm it works: **Actions**
   → **Nightly Supabase backup** → **Run workflow** → **Run
   workflow**. First run should finish in 1-3 minutes.

## Downloading a backup

1. In GitHub go to the ignite27 repo → **Actions**.
2. Filter runs to **Nightly Supabase backup** in the left sidebar.
3. Open a successful run.
4. Scroll to the bottom, **Artifacts** section.
5. Click the artifact name (e.g. `ignite27-prod-20260501T020000Z.sql.gz`)
   — it downloads as a zip containing the `.sql.gz` file.
6. Extract:

    ```sh
    unzip ignite27-prod-*.sql.gz.zip
    gunzip -k ignite27-prod-*.sql.gz  # -k keeps the .gz around too
    ```

Artifacts are kept for **90 days**. If we need longer-term archival
(quarterly / yearly), download an artifact before it expires and
store it in whatever cold storage we settle on.

## Restoring a backup

Restore into a **fresh Postgres 15+ database** — never into
production. Practise the restore in dev first.

Prerequisites:

- Postgres 15 client tools locally (`psql`, `pg_restore` if needed).
  On macOS: `brew install postgresql@15`. Verify: `psql --version`
  should say `15.x`.
- A target database URL. For dev/testing, spin up a local Postgres:

    ```sh
    docker run --rm -d --name ignite27-restore \
      -e POSTGRES_PASSWORD=restore -p 55432:5432 \
      postgres:15
    ```

    Target URL: `postgresql://postgres:restore@localhost:55432/postgres`.

Steps:

1. Download and extract the backup (see previous section). You will
   have `ignite27-prod-<ts>.sql`.
2. Run the restore:

    ```sh
    psql "postgresql://postgres:restore@localhost:55432/postgres" \
      -v ON_ERROR_STOP=1 \
      -f ignite27-prod-<ts>.sql
    ```

    - `-v ON_ERROR_STOP=1` aborts on the first SQL error rather than
      barrelling on.
    - The dump is `--clean --if-exists`, so it drops matching objects
      before recreating them. Safe against a target that has partial
      or previous data.
3. Sanity-check row counts:

    ```sh
    psql "postgresql://postgres:restore@localhost:55432/postgres" -c \
      "select 'bookings' as t, count(*) from bookings
       union all select 'users', count(*) from users
       union all select 'booking_attendees', count(*) from booking_attendees;"
    ```

    Cross-reference against the corresponding query on production
    (via the Supabase SQL editor) at roughly the backup's timestamp.

### Excluded schemas

The dump excludes Supabase-managed schemas (`storage`,
`extensions`, `pgsodium*`, `graphql*`, `realtime`,
`supabase_functions`, `vault`, `cron`, `net`) because restoring them
into a fresh cluster would either fail (extension version mismatch)
or overwrite the target's Supabase-managed state. The `public` and
`auth` schemas are included — that is where all of our own data
lives. If we ever store business data in `storage` or elsewhere,
revisit the `--exclude-schema` list in the workflow.

## What to do if a nightly run fails

GitHub emails the repo owner by default when a scheduled workflow
fails. Common causes and fixes:

- **Secret missing / typo.** The first job step exits with a clear
  `SUPABASE_DB_URL is not set` error. Fix the secret and re-run.
- **Wrong password / rotated password.** `pg_dump: error: connection
  to server ... failed: FATAL: password authentication failed`. Reset
  the password in the Supabase dashboard and update the secret.
- **Version skew.** `pg_dump: error: server version: X; pg_dump
  version: Y`. Supabase upgraded its Postgres major version. Bump
  the `postgresql-client-15` line in the workflow to the matching
  major.
- **Job took > 20 minutes.** The workflow times out. Bump
  `timeout-minutes` and investigate; a slow dump usually means a
  network hiccup or that the database has grown significantly.
- **Rate limits / pooler unavailable.** Retry once via
  `workflow_dispatch`. If the underlying Supabase infra is having a
  bad day, wait and retry.

## What is NOT covered here

- **Point-in-time recovery (PITR).** Supabase's Pro plan offers PITR
  via their own tooling. This workflow is a belt-and-braces daily
  snapshot on top of that (or the primary backup if PITR is not
  enabled).
- **Encryption at rest of the artifact.** GitHub Actions artifacts
  are stored in GitHub's infra, encrypted at rest by GitHub, and only
  downloadable by users with repo access. If we want stronger
  guarantees (e.g. our own KMS-encrypted S3 upload), that's a future
  workflow step — not in scope for this doc.
- **Automated restore verification.** Right now we assume the dump
  runs cleanly if `pg_dump` exits 0. A future improvement is a second
  job that restores into a scratch Postgres and asserts row counts.
