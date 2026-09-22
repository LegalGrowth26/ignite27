import type { SupabaseClient } from "@supabase/supabase-js";

// Private -> public photo copy at save time, same pipeline as the
// exhibitor logos: public pages read ONLY the public bucket, and the
// admin unpublish/republish actions remove/restore the public copy.
export async function publishSpeakerPhotoCopy(
  serviceClient: SupabaseClient,
  photoPath: string,
): Promise<{ error: string | null }> {
  const { data: file, error: downloadErr } = await serviceClient.storage
    .from("speaker-photos")
    .download(photoPath);
  if (downloadErr || !file) {
    return { error: downloadErr?.message ?? "photo download failed" };
  }
  const { error: uploadErr } = await serviceClient.storage
    .from("speaker-photos-public")
    .upload(photoPath, file, { upsert: true });
  if (uploadErr) return { error: uploadErr.message };
  return { error: null };
}
