import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { approveExhibitorAction, revokeExhibitorApprovalAction } from "./actions";

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
  created_at: string;
  exhibitor_requirements: {
    needs_power: boolean;
    needs_table_chairs: boolean;
    signage_name: string;
    logo_path: string | null;
    website_url: string | null;
    approved_at: string | null;
  } | null;
}

export default async function AdminExhibitorsPage() {
  const { client } = await requireSuperAdmin();

  const { data, error } = await client
    .from("bookings")
    .select(
      `id, booking_reference, company_name, company_contact_name,
       company_contact_email, company_website, payment_status, created_at,
       exhibitor_requirements (
         needs_power, needs_table_chairs, signage_name, logo_path,
         website_url, approved_at
       )`,
    )
    .eq("booking_type", "exhibitor")
    .order("created_at", { ascending: true });
  if (error) console.error("[admin/exhibitors] error:", error);

  const rows = ((data ?? []) as unknown as ExhibitorRow[]);

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

      {rows.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-ignite-line bg-ignite-white p-6 text-body text-ignite-muted">
          No exhibitor bookings yet.
        </p>
      ) : (
        <div className="mt-6 grid gap-4">
          {rows.map((r) => {
            const req = r.exhibitor_requirements;
            return (
              <div key={r.id} className="rounded-2xl border border-ignite-line bg-ignite-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-h3">{r.company_name ?? req?.signage_name ?? "Company TBC"}</p>
                    <p className="mt-1 text-small text-ignite-muted">
                      {r.booking_reference ?? "PENDING"} · {r.company_contact_name ?? "contact TBC"} ·{" "}
                      {r.company_contact_email ?? "email TBC"} · {r.payment_status}
                    </p>
                  </div>
                  {req ? (
                    req.approved_at ? (
                      <form action={revokeExhibitorApprovalAction.bind(null, r.id)}>
                        <button
                          type="submit"
                          className="rounded-full border border-ignite-line px-4 py-2 text-small font-semibold text-ignite-ink hover:border-ignite-red"
                        >
                          Remove from public site
                        </button>
                      </form>
                    ) : (
                      <form action={approveExhibitorAction.bind(null, r.id)}>
                        <button
                          type="submit"
                          className="rounded-full bg-ignite-red px-4 py-2 text-small font-semibold text-ignite-white hover:bg-ignite-red/90"
                        >
                          Approve for public site
                        </button>
                      </form>
                    )
                  ) : null}
                </div>

                {req ? (
                  <dl className="mt-4 grid gap-3 text-small sm:grid-cols-2 lg:grid-cols-4">
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
                      <dt className="text-eyebrow uppercase text-ignite-muted">Public status</dt>
                      <dd>{req.approved_at ? `Approved ${new Date(req.approved_at).toLocaleDateString("en-GB")}` : "Not approved"}</dd>
                    </div>
                    <div>
                      <dt className="text-eyebrow uppercase text-ignite-muted">Logo</dt>
                      <dd>{req.logo_path ? "Uploaded" : "None"}</dd>
                    </div>
                    <div>
                      <dt className="text-eyebrow uppercase text-ignite-muted">Website</dt>
                      <dd className="break-all">{req.website_url ?? r.company_website ?? "None"}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="mt-4 text-small text-ignite-muted">
                    Requirements form not yet submitted.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
