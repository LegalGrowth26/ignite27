import Link from "next/link";
import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { isTbcAttendeeName } from "@/lib/bookings/exhibitor-intent";
import {
  attendeeFallbacks,
  isLivePaidSession,
  resolveExhibitorDisplayName,
} from "@/lib/exhibitors/listing";
import {
  republishExhibitorPageAction,
  unpublishExhibitorPageAction,
} from "./actions";

export const metadata: Metadata = {
  title: "Admin exhibitors · IGNITE! 27",
  robots: { index: false, follow: false },
};

interface ExhibitorRow {
  id: string;
  booking_reference: string | null;
  company_name: string | null;
  company_contact_name: string | null;
  company_contact_email: string | null;
  company_website: string | null;
  payment_status: string;
  booking_status: string;
  stripe_checkout_session_id: string | null;
  created_at: string;
  exhibitor_profiles: {
    slug: string;
    display_name: string;
    published_at: string | null;
  } | null;
  exhibitor_requirements: {
    needs_power: boolean;
    needs_table_chairs: boolean;
    signage_name: string;
    logo_path: string | null;
    website_url: string | null;
  } | null;
  booking_attendees: ReadonlyArray<{
    first_name: string;
    surname: string;
    company: string | null;
    attendee_index: number;
  }>;
}

// The page's display name comes from the profile once one exists;
// until then, the same fallback chain the backfill will use, so the
// admin sees the name the page WILL get.
function displayName(r: ExhibitorRow): string {
  if (r.exhibitor_profiles) return r.exhibitor_profiles.display_name;
  const fallback = attendeeFallbacks(r.booking_attendees);
  return (
    resolveExhibitorDisplayName({
      signageName: r.exhibitor_requirements?.signage_name ?? null,
      companyName: r.company_name,
      attendeeCompany: fallback.attendeeCompany,
      contactName: r.company_contact_name ?? fallback.attendeeName,
    }) || "Company TBC"
  );
}

// Page state per booking under the profile model. Eligible-but-no-page
// means the backfill has not run since this booking landed (or profile
// creation failed in the webhook and needs the backfill to heal it).
function pageStatus(r: ExhibitorRow): {
  label: string;
  published: boolean;
  hasPage: boolean;
} {
  const p = r.exhibitor_profiles;
  if (p) {
    return p.published_at
      ? { label: `Live at /exhibitors/${p.slug}`, published: true, hasPage: true }
      : { label: "Unpublished by admin", published: false, hasPage: true };
  }
  const eligible =
    r.booking_status === "active" &&
    (r.payment_status === "comp" ||
      (r.payment_status === "paid" && isLivePaidSession(r.stripe_checkout_session_id)));
  if (eligible) {
    return { label: "No page yet (run the backfill)", published: false, hasPage: false };
  }
  if (!isLivePaidSession(r.stripe_checkout_session_id) && r.payment_status !== "comp") {
    return { label: "No page (test-mode or no live payment)", published: false, hasPage: false };
  }
  return { label: `No page (${r.payment_status})`, published: false, hasPage: false };
}

export default async function AdminExhibitorsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { client } = await requireSuperAdmin();
  const { status: statusParam } = await searchParams;

  const { data, error } = await client
    .from("bookings")
    .select(
      `id, booking_reference, company_name, company_contact_name,
       company_contact_email, company_website, payment_status,
       booking_status, stripe_checkout_session_id, created_at,
       exhibitor_profiles ( slug, display_name, published_at ),
       exhibitor_requirements (
         needs_power, needs_table_chairs, signage_name, logo_path,
         website_url
       ),
       booking_attendees ( first_name, surname, company, attendee_index )`,
    )
    .eq("booking_type", "exhibitor")
    .order("created_at", { ascending: true });
  if (error) console.error("[admin/exhibitors] error:", error);

  const rows = ((data ?? []) as unknown as ExhibitorRow[]);

  // A failed query must never masquerade as "no bookings yet": that hid
  // a missing-column error (unapplied migration) behind the zero state
  // while three paid exhibitors existed. Admin-only surface, so the raw
  // message is shown.
  if (error) {
    return (
      <div>
        <h1 className="text-h1">Exhibitors</h1>
        <div className="mt-8 rounded-2xl border-2 border-ignite-red bg-ignite-red/5 p-6">
          <p className="text-body font-semibold text-ignite-red">
            Could not load exhibitor bookings.
          </p>
          <p className="mt-2 font-mono text-small text-ignite-ink">{error.message}</p>
          <p className="mt-3 text-small text-ignite-muted">
            If this mentions a missing table or column (for example
            exhibitor_profiles), a migration in supabase/migrations has not
            been applied to this environment yet.
          </p>
        </div>
      </div>
    );
  }

  const missingPages = rows.filter((r) => pageStatus(r).label.includes("run the backfill"));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-h1">Exhibitors</h1>
        <a
          href="/admin/exhibitors/export"
          className="rounded-full border border-ignite-line bg-ignite-white px-5 py-2 text-small font-semibold text-ignite-ink hover:border-ignite-red"
        >
          Export CSV (badges + floor plan)
        </a>
      </div>

      <p className="mt-3 max-w-3xl text-small text-ignite-muted">
        Every paid stand gets a public page at /exhibitors/&lt;slug&gt;
        automatically; the /exhibit strip and the /exhibitors index both
        show published pages and nothing else. Use Unpublish to pull a
        page down fast (for example a cancelled or refunded stand);
        nothing is deleted and every action is audit-logged.
      </p>

      {statusParam === "page_saved" ? (
        <p className="mt-4 rounded-xl border border-ignite-line bg-ignite-white p-3 text-small text-ignite-ink">
          Page saved.
        </p>
      ) : null}

      {missingPages.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-ignite-red/50 bg-ignite-red/5 p-4">
          <p className="text-small font-semibold text-ignite-ink">
            {missingPages.length} paid {missingPages.length === 1 ? "booking has" : "bookings have"} no
            page yet. Run the one-off backfill (POST /admin/exhibitor-pages-backfill
            while signed in as a super admin) to create pages and send the
            invite emails.
          </p>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-ignite-line bg-ignite-white p-6 text-body text-ignite-muted">
          No exhibitor bookings yet.
        </p>
      ) : (
        <div className="mt-6 grid gap-4">
          {rows.map((r) => {
            const req = r.exhibitor_requirements;
            const status = pageStatus(r);
            const slug = r.exhibitor_profiles?.slug;
            return (
              <div key={r.id} className="rounded-2xl border border-ignite-line bg-ignite-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-h3">{displayName(r)}</p>
                    <p className="mt-1 text-small text-ignite-muted">
                      {r.booking_reference ?? "PENDING"} · {r.company_contact_name ?? "contact TBC"} ·{" "}
                      {r.company_contact_email ?? "email TBC"} · {r.payment_status}
                    </p>
                  </div>
                  {status.hasPage ? (
                    <div className="flex flex-wrap items-center gap-2">
                      {status.published && slug ? (
                        <Link
                          href={`/exhibitors/${slug}`}
                          className="rounded-full border border-ignite-line px-4 py-2 text-small font-semibold text-ignite-ink hover:border-ignite-red"
                        >
                          View page
                        </Link>
                      ) : null}
                      <Link
                        href={`/admin/exhibitors/${r.id}/edit`}
                        className="rounded-full border border-ignite-line px-4 py-2 text-small font-semibold text-ignite-ink hover:border-ignite-red"
                      >
                        Edit page
                      </Link>
                      {status.published ? (
                        <form action={unpublishExhibitorPageAction.bind(null, r.id)}>
                          <button
                            type="submit"
                            className="rounded-full border border-ignite-line px-4 py-2 text-small font-semibold text-ignite-ink hover:border-ignite-red"
                          >
                            Unpublish
                          </button>
                        </form>
                      ) : (
                        <form action={republishExhibitorPageAction.bind(null, r.id)}>
                          <button
                            type="submit"
                            className="rounded-full bg-ignite-red px-4 py-2 text-small font-semibold text-ignite-white hover:bg-ignite-red/90"
                          >
                            Republish
                          </button>
                        </form>
                      )}
                    </div>
                  ) : null}
                </div>

                <dl className="mt-4 grid gap-3 text-small sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <dt className="text-eyebrow uppercase text-ignite-muted">Public page</dt>
                    <dd>{status.label}</dd>
                  </div>
                  <div>
                    <dt className="text-eyebrow uppercase text-ignite-muted">Attendees</dt>
                    <dd>
                      {[...r.booking_attendees]
                        .sort((a, b) => a.attendee_index - b.attendee_index)
                        .map((a) =>
                          isTbcAttendeeName(a.first_name, a.surname)
                            ? "TBC (chase before badge printing)"
                            : `${a.first_name} ${a.surname}`,
                        )
                        .join(" · ") || "None recorded"}
                    </dd>
                  </div>
                  {req ? (
                    <>
                      <div>
                        <dt className="text-eyebrow uppercase text-ignite-muted">Power</dt>
                        <dd>{req.needs_power ? "Yes" : "No"}</dd>
                      </div>
                      <div>
                        <dt className="text-eyebrow uppercase text-ignite-muted">Table + 2 chairs</dt>
                        <dd>{req.needs_table_chairs ? "Yes" : "No"}</dd>
                      </div>
                      <div>
                        <dt className="text-eyebrow uppercase text-ignite-muted">Signage name</dt>
                        <dd>{req.signage_name}</dd>
                      </div>
                      <div>
                        <dt className="text-eyebrow uppercase text-ignite-muted">Logo</dt>
                        <dd>{req.logo_path ? "Uploaded" : "None"}</dd>
                      </div>
                      <div>
                        <dt className="text-eyebrow uppercase text-ignite-muted">Website</dt>
                        <dd className="break-all">{req.website_url ?? r.company_website ?? "None"}</dd>
                      </div>
                    </>
                  ) : (
                    <div className="sm:col-span-2 lg:col-span-3">
                      <dt className="text-eyebrow uppercase text-ignite-muted">Requirements</dt>
                      <dd className="text-ignite-muted">Form not yet submitted.</dd>
                    </div>
                  )}
                </dl>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
