import Link from "next/link";
import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { AddSpeakerForm, AttachEmailForm } from "./AdminSpeakerForms";
import { republishSpeakerAction, unpublishSpeakerAction } from "./actions";

export const metadata: Metadata = {
  title: "Admin speakers · IGNITE! 27",
  robots: { index: false, follow: false },
};

interface SpeakerRow {
  id: string;
  slug: string;
  display_name: string;
  talk_title: string;
  user_id: string | null;
  published_at: string | null;
  created_at: string;
  users: { email: string } | null;
  speaker_messages: Array<{ count: number }>;
}

const STATUS_NOTES: Record<string, string> = {
  added_invited: "Speaker added, page live, invite sent.",
  added_no_account: "Speaker added, page live. Attach an email below when you have it.",
  added_invite_failed:
    "Speaker added and page live, but the invite email failed. Use 'Attach email + invite' to retry.",
  attached_invited: "Account linked and invite sent.",
  attached_invite_failed:
    "Account linked, but the invite email failed. Retry with the same email.",
  saved: "Page saved.",
};

export default async function AdminSpeakersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { client } = await requireSuperAdmin();
  const { status } = await searchParams;

  const { data, error } = await client
    .from("speaker_profiles")
    .select(
      `id, slug, display_name, talk_title, user_id, published_at, created_at,
       users ( email ), speaker_messages ( count )`,
    )
    .order("created_at", { ascending: true });

  if (error) {
    return (
      <div>
        <h1 className="text-h1">Speakers</h1>
        <div className="mt-8 rounded-2xl border-2 border-ignite-red bg-ignite-red/5 p-6">
          <p className="text-body font-semibold text-ignite-red">
            Could not load speakers.
          </p>
          <p className="mt-2 font-mono text-small text-ignite-ink">{error.message}</p>
          <p className="mt-3 text-small text-ignite-muted">
            If this mentions a missing table (speaker_profiles), the 20260509
            migration has not been applied to this environment yet.
          </p>
        </div>
      </div>
    );
  }

  const rows = (data ?? []) as unknown as SpeakerRow[];

  return (
    <div>
      <h1 className="text-h1">Speakers</h1>
      <p className="mt-3 max-w-3xl text-small text-ignite-muted">
        Adding a speaker publishes their page at /speakers/&lt;slug&gt;
        immediately and (with an email) creates their login and sends the
        invite. Speakers edit their own pages; you can edit or unpublish
        any page here, and every &quot;Get in touch&quot; message is copied below.
      </p>

      {status && STATUS_NOTES[status] ? (
        <p className="mt-4 rounded-xl border border-ignite-line bg-ignite-white p-3 text-small">
          {STATUS_NOTES[status]}
        </p>
      ) : null}

      <div className="mt-6 rounded-2xl border border-ignite-line bg-ignite-white p-5">
        <h2 className="text-h3">Add a speaker</h2>
        <div className="mt-4">
          <AddSpeakerForm />
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-ignite-line bg-ignite-white p-6 text-body text-ignite-muted">
          No speakers yet. Run the one-off backfill (POST
          /admin/speaker-pages-backfill while signed in as a super admin) to
          seed the three announced speakers, or add one above.
        </p>
      ) : (
        <div className="mt-6 grid gap-4">
          {rows.map((s) => {
            const messages = s.speaker_messages?.[0]?.count ?? 0;
            return (
              <div key={s.id} className="rounded-2xl border border-ignite-line bg-ignite-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-h3">{s.display_name}</p>
                    <p className="mt-1 text-small text-ignite-muted">
                      {s.talk_title || "Talk title TBC"} ·{" "}
                      {s.published_at ? `Live at /speakers/${s.slug}` : "Unpublished"} ·{" "}
                      {s.user_id
                        ? `Account: ${s.users?.email ?? "linked"}`
                        : "No account yet"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {s.published_at ? (
                      <Link
                        href={`/speakers/${s.slug}`}
                        className="rounded-full border border-ignite-line px-4 py-2 text-small font-semibold text-ignite-ink hover:border-ignite-red"
                      >
                        View page
                      </Link>
                    ) : null}
                    <Link
                      href={`/admin/speakers/${s.id}/edit`}
                      className="rounded-full border border-ignite-line px-4 py-2 text-small font-semibold text-ignite-ink hover:border-ignite-red"
                    >
                      Edit page
                    </Link>
                    <Link
                      href={`/admin/speakers/${s.id}`}
                      className="rounded-full border border-ignite-line px-4 py-2 text-small font-semibold text-ignite-ink hover:border-ignite-red"
                    >
                      Messages ({messages})
                    </Link>
                    {s.published_at ? (
                      <form action={unpublishSpeakerAction.bind(null, s.id)}>
                        <button
                          type="submit"
                          className="rounded-full border border-ignite-line px-4 py-2 text-small font-semibold text-ignite-ink hover:border-ignite-red"
                        >
                          Unpublish
                        </button>
                      </form>
                    ) : (
                      <form action={republishSpeakerAction.bind(null, s.id)}>
                        <button
                          type="submit"
                          className="rounded-full bg-ignite-red px-4 py-2 text-small font-semibold text-ignite-white hover:bg-ignite-red/90"
                        >
                          Republish
                        </button>
                      </form>
                    )}
                  </div>
                </div>
                {!s.user_id ? (
                  <div className="mt-4 border-t border-ignite-line pt-4">
                    <AttachEmailForm profileId={s.id} />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
