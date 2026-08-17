import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { isTbcAttendeeName } from "@/lib/bookings/exhibitor-intent";
import {
  attendeeFallbacks,
  buildExhibitorListing,
  isLivePaidSession,
  resolveExhibitorDisplayName,
} from "@/lib/exhibitors/listing";
import { hideExhibitorListingAction, showExhibitorListingAction } from "./actions";

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
  listing_hidden_at: string | null;
  created_at: string;
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

// Same fallback chain as the public listing: signage -> booking company
// -> attendee 1's company -> contact name. A paid exhibitor with no
// requirements row and null company columns must still show up here
// under a recognisable name.
function displayName(r: ExhibitorRow): string {
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

// One booking's public-listing state, mirroring the exact rule the
// public site applies (lib/exhibitors/listing.ts).
function listingStatus(r: ExhibitorRow): { label: string; listed: boolean; hideable: boolean } {
  const fallback = attendeeFallbacks(r.booking_attendees);
  const wouldList =
    buildExhibitorListing([
      {
        bookingId: r.id,
        companyName: r.company_name,
        signageName: r.exhibitor_requirements?.signage_name ?? null,
        attendeeCompany: fallback.attendeeCompany,
        contactName: r.company_contact_name ?? fallback.attendeeName,
        websiteUrl: null,
        logoPath: null,
        paymentStatus: r.payment_status,
        bookingStatus: r.booking_status,
        stripeCheckoutSessionId: r.stripe_checkout_session_id,
        listingHiddenAt: null, // evaluate the underlying eligibility first
      },
    ]).length > 0;

  if (!wouldList) {
    if (!isLivePaidSession(r.stripe_checkout_session_id)) {
      return { label: "Not listed (test-mode or no live payment)", listed: false, hideable: false };
    }
    if (r.payment_status !== "paid") {
      return { label: `Not listed (${r.payment_status})`, listed: false, hideable: false };
    }
    return { label: "Not listed", listed: false, hideable: false };
  }
  if (r.listing_hidden_at) {
    return {
      label: `Hidden by admin ${new Date(r.listing_hidden_at).toLocaleDateString("en-GB")}`,
      listed: false,
      hideable: true,
    };
  }
  return { label: "Listed on /exhibit", listed: true, hideable: true };
}

export default async function AdminExhibitorsPage() {
  const { client } = await requireSuperAdmin();

  const { data, error } = await client
    .from("bookings")
    .select(
      `id, booking_reference, company_name, company_contact_name,
       company_contact_email, company_website, payment_status,
       booking_status, stripe_checkout_session_id, listing_hidden_at,
       created_at,
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
            If this mentions a missing column (for example listing_hidden_at),
            a migration in supabase/migrations has not been applied to this
            environment yet.
          </p>
        </div>
      </div>
    );
  }

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
        Paid live bookings list themselves on /exhibit automatically, name
        first, logo and website as soon as the exhibitor saves them. Use
        Hide to pull a listing down fast; nothing is deleted and every
        hide/show is audit-logged.
      </p>

      {rows.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-ignite-line bg-ignite-white p-6 text-body text-ignite-muted">
          No exhibitor bookings yet.
        </p>
      ) : (
        <div className="mt-6 grid gap-4">
          {rows.map((r) => {
            const req = r.exhibitor_requirements;
            const status = listingStatus(r);
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
                  {status.hideable ? (
                    status.listed ? (
                      <form action={hideExhibitorListingAction.bind(null, r.id)}>
                        <button
                          type="submit"
                          className="rounded-full border border-ignite-line px-4 py-2 text-small font-semibold text-ignite-ink hover:border-ignite-red"
                        >
                          Hide from /exhibit
                        </button>
                      </form>
                    ) : (
                      <form action={showExhibitorListingAction.bind(null, r.id)}>
                        <button
                          type="submit"
                          className="rounded-full bg-ignite-red px-4 py-2 text-small font-semibold text-ignite-white hover:bg-ignite-red/90"
                        >
                          Show on /exhibit
                        </button>
                      </form>
                    )
                  ) : null}
                </div>

                <dl className="mt-4 grid gap-3 text-small sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <dt className="text-eyebrow uppercase text-ignite-muted">Public listing</dt>
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
                      <dd className="text-ignite-muted">Form not yet submitted. Listing shows the checkout company name.</dd>
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
