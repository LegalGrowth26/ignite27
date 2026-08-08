import type { SupabaseClient } from "@supabase/supabase-js";

// Requirements-row persistence, extracted from the account server action
// so the write shape is unit-testable.
//
// WHY NOT UPSERT: exhibitor_requirements carries column-level grants
// (authenticated may UPDATE only the non-key content columns; booking_id
// is deliberately not updatable so a row can never be re-pointed at
// another booking). A supabase-js upsert compiles to INSERT ... ON
// CONFLICT DO UPDATE SET <every supplied column>, booking_id included,
// and Postgres checks UPDATE privilege on the whole SET list at plan
// time, so EVERY save failed with permission denied, including first
// saves. This was the production "cannot save requirements" bug.
// Update-first-then-insert keeps booking_id out of any UPDATE SET list.
// Do not change this back to .upsert().

export interface RequirementsRowFields {
  needs_power: boolean;
  needs_table_chairs: boolean;
  signage_name: string;
  website_url: string | null;
  logo_path?: string; // only included when a logo was uploaded or adopted
}

export async function saveRequirementsRow(
  client: SupabaseClient,
  bookingId: string,
  fields: RequirementsRowFields,
): Promise<{ error: string | null }> {
  // Try the update path first; RLS owner_update restricts it to the
  // caller's own booking. booking_id appears ONLY in the filter.
  const { data: updated, error: updateErr } = await client
    .from("exhibitor_requirements")
    .update(fields)
    .eq("booking_id", bookingId)
    .select("id");
  if (updateErr) return { error: updateErr.message };
  if ((updated ?? []).length > 0) return { error: null };

  // No row yet: insert. A duplicate-key race (double submit) is
  // harmless; report the message and let the user retry.
  const { error: insertErr } = await client
    .from("exhibitor_requirements")
    .insert({ booking_id: bookingId, ...fields });
  if (insertErr) return { error: insertErr.message };
  return { error: null };
}

// Recovery for uploads stranded by the save bug: the logo file reached
// the private bucket but the row write failed, so logo_path was never
// recorded. When a save arrives with no new file and no recorded logo,
// adopt the stranded file instead of making the exhibitor upload again.
export function pickStrandedLogo(
  files: readonly { name: string; created_at?: string | null }[],
): string | null {
  const logos = files
    .filter((f) => /^logo\.(png|jpg|jpeg|webp|svg)$/i.test(f.name))
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
  return logos[0]?.name ?? null;
}

// Copy the saved logo from the PRIVATE bucket to the PUBLIC one at the
// same {booking_id}/{filename} path. Public listings read ONLY the
// public bucket; this copy is what makes a logo publicly visible, and
// it now runs at save time (no admin approval step). Requires the
// service-role client: the public bucket accepts writes from nothing
// else.
export async function publishLogoCopy(
  serviceClient: SupabaseClient,
  logoPath: string,
): Promise<{ error: string | null }> {
  const { data: file, error: downloadErr } = await serviceClient.storage
    .from("exhibitor-logos")
    .download(logoPath);
  if (downloadErr || !file) {
    return { error: downloadErr?.message ?? "logo download failed" };
  }
  const { error: uploadErr } = await serviceClient.storage
    .from("exhibitor-logos-public")
    .upload(logoPath, file, { upsert: true });
  if (uploadErr) return { error: uploadErr.message };
  return { error: null };
}
