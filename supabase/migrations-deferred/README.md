# Deferred migrations

Migrations in this directory are **not applied automatically** by
`supabase db push` or `supabase db reset`. Each is a follow-up drop
that is deliberately held back from the pricing-v2 merge because
downstream systems (RLS policies, backup snapshots, marketing sends,
etc.) may still reference the tables and the drops are one-way.

Apply each one via the Supabase SQL Editor (dev first, then prod)
only after confirming nothing still reads from the tables involved.
Once applied, move the file into `supabase/migrations/` with a
current timestamp so it becomes part of the tracked schema history,
and delete this README entry for the file.

## Pending

### `20260428000100_drop_magic_link_tables.sql`

Drops the three tables that supported the removed Window 1 eligibility
gate: `magic_links`, `previous_bookers`, `eligibility_overrides`.

**Held because:** `previous_bookers` is still the source list for the
one-off launch invite marketing send (per SPEC, "the marketing list
survives even though the gate does not"). Do not drop it until Tom
confirms that send has gone out, or the list has been exported to a
marketing tool.

**Pre-drop checklist:**
- [ ] `previous_bookers` CSV export delivered to Tom / marketing tool.
- [ ] No RLS policies reference `magic_links` /
      `eligibility_overrides` (grep for the table names in later
      migrations).
- [ ] No app code references them (grep repo — should already be
      true; the pricing-v2 PR removed the last runtime touch-points).
