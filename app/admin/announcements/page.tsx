import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/admin/guard";
import {
  moveAnnouncementAction,
  togglePublishAction,
} from "./actions";
import { CreateAnnouncementForm, EditAnnouncementForm } from "./AnnouncementForms";

export const metadata: Metadata = {
  title: "Admin announcements · IGNITE! 27",
  robots: { index: false, follow: false },
};

interface AnnouncementAdminRow {
  id: string;
  headline: string;
  body: string;
  link_url: string | null;
  image_url: string | null;
  sort_order: number;
  published_at: string | null;
}

export default async function AdminAnnouncementsPage() {
  const { client } = await requireSuperAdmin();

  const { data, error } = await client
    .from("announcements")
    .select("id, headline, body, link_url, image_url, sort_order, published_at")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    return (
      <div>
        <h1 className="text-h1">Announcements</h1>
        <div className="mt-8 rounded-2xl border-2 border-ignite-red bg-ignite-red/5 p-6">
          <p className="text-body font-semibold text-ignite-red">
            Could not load announcements.
          </p>
          <p className="mt-2 font-mono text-small text-ignite-ink">{error.message}</p>
          <p className="mt-3 text-small text-ignite-muted">
            If this mentions a missing table, the announcements migration
            has not been applied to this environment yet.
          </p>
        </div>
      </div>
    );
  }
  const rows = (data ?? []) as AnnouncementAdminRow[];

  return (
    <div>
      <h1 className="text-h1">Announcements</h1>
      <p className="mt-3 max-w-3xl text-small text-ignite-muted">
        The Latest from IGNITE! strip on the homepage. New announcements
        start as drafts; publish when ready. The strip is hidden entirely
        while nothing is published.
      </p>

      <div className="mt-8 rounded-2xl border border-ignite-line bg-ignite-white p-6">
        <h2 className="text-h3">New announcement</h2>
        <div className="mt-4">
          <CreateAnnouncementForm />
        </div>
      </div>

      {rows.length > 0 ? (
        <div className="mt-8 grid gap-4">
          {rows.map((r, index) => (
            <div key={r.id} className="rounded-2xl border border-ignite-line bg-ignite-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-h3">
                    {r.headline}
                    <span
                      className={`ml-2 rounded-full px-2 py-0.5 text-eyebrow uppercase ${
                        r.published_at
                          ? "bg-ignite-red/10 text-ignite-red"
                          : "bg-ignite-cream text-ignite-muted"
                      }`}
                    >
                      {r.published_at ? "Live" : "Draft"}
                    </span>
                  </p>
                  <p className="mt-1 max-w-xl text-small text-ignite-muted">{r.body}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <form action={moveAnnouncementAction.bind(null, r.id, "up")}>
                    <button
                      type="submit"
                      disabled={index === 0}
                      aria-label={`Move ${r.headline} up`}
                      className="rounded-full border border-ignite-line px-3 py-1.5 text-small font-semibold text-ignite-ink hover:border-ignite-red disabled:opacity-40"
                    >
                      Up
                    </button>
                  </form>
                  <form action={moveAnnouncementAction.bind(null, r.id, "down")}>
                    <button
                      type="submit"
                      disabled={index === rows.length - 1}
                      aria-label={`Move ${r.headline} down`}
                      className="rounded-full border border-ignite-line px-3 py-1.5 text-small font-semibold text-ignite-ink hover:border-ignite-red disabled:opacity-40"
                    >
                      Down
                    </button>
                  </form>
                  <form action={togglePublishAction.bind(null, r.id)}>
                    <button
                      type="submit"
                      className={`rounded-full px-4 py-1.5 text-small font-semibold ${
                        r.published_at
                          ? "border border-ignite-line text-ignite-ink hover:border-ignite-red"
                          : "bg-ignite-red text-ignite-white hover:bg-ignite-red-hover"
                      }`}
                    >
                      {r.published_at ? "Unpublish" : "Publish"}
                    </button>
                  </form>
                </div>
              </div>

              <details className="mt-4">
                <summary className="cursor-pointer text-small font-semibold text-ignite-ink">
                  Edit
                </summary>
                <div className="mt-4">
                  <EditAnnouncementForm
                    announcementId={r.id}
                    defaults={{
                      headline: r.headline,
                      body: r.body,
                      linkUrl: r.link_url ?? "",
                      imageUrl: r.image_url ?? "",
                    }}
                  />
                </div>
              </details>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-8 rounded-2xl border border-ignite-line bg-ignite-white p-6 text-body text-ignite-muted">
          No announcements yet. Create one above.
        </p>
      )}
    </div>
  );
}
