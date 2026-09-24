// Interpreting the speaker editor's row update, pure and unit-tested.
//
// The trap this exists for: a PostgREST UPDATE that matches ZERO rows
// is not an error. Under RLS that is exactly what a broken ownership
// link looks like (the row is visible through the public-read policy,
// so the editor loads, but the owner-update policy matches nothing),
// and the old code read it as success: "Saved. Your page is up to
// date." while nothing was written. First seen in production with a
// relinked account; loud-error rule applies.

export type SpeakerSaveOutcome =
  | { ok: true; slug: string }
  | { ok: false; error: string };

export function interpretSpeakerSave(input: {
  error: { message: string } | null;
  rows: Array<{ slug: string }> | null;
  fallbackSlug: string;
}): SpeakerSaveOutcome {
  if (input.error) {
    return {
      ok: false,
      error: `Could not save your page: ${input.error.message}`,
    };
  }
  const rows = input.rows ?? [];
  if (rows.length === 0) {
    return {
      ok: false,
      error:
        "Your changes did NOT save: this page is not linked to the account you are logged in with. Nothing else is wrong with what you typed; email tom@lincolnshiremarketing.co.uk and we will relink it.",
    };
  }
  return { ok: true, slug: rows[0]?.slug ?? input.fallbackSlug };
}
