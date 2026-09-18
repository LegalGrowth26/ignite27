import Link from "next/link";
import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { ambassadorShareUrl } from "@/lib/ambassadors/attribution";
import { env } from "@/lib/env";
import {
  adjustAllowanceAction,
  createAmbassadorAction,
  toggleAmbassadorActiveAction,
} from "./actions";
import { CreateAmbassadorForm } from "./CreateAmbassadorForm";

export const metadata: Metadata = {
  title: "Admin ambassadors · IGNITE! 27",
  robots: { index: false, follow: false },
};

interface AmbassadorAdminRow {
  id: string;
  slug: string;
  display_name: string;
  company: string | null;
  ambassador_type: "speaker" | "partner";
  comp_allowance: number;
  discount_percent: number | null;
  link_clicks: number;
  deactivated_at: string | null;
}

const INPUT =
  "w-24 rounded-xl border border-ignite-line bg-ignite-white px-3 py-1.5 text-small text-ignite-ink focus:border-ignite-red focus:outline-none";

export default async function AdminAmbassadorsPage() {
  const { client } = await requireSuperAdmin();

  const { data, error } = await client
    .from("ambassadors")
    .select(
      "id, slug, display_name, company, ambassador_type, comp_allowance, discount_percent, link_clicks, deactivated_at",
    )
    .order("created_at", { ascending: true });
  if (error) {
    return (
      <div>
        <h1 className="text-h1">Ambassadors</h1>
        <div className="mt-8 rounded-2xl border-2 border-ignite-red bg-ignite-red/5 p-6">
          <p className="text-body font-semibold text-ignite-red">Could not load ambassadors.</p>
          <p className="mt-2 font-mono text-small text-ignite-ink">{error.message}</p>
          <p className="mt-3 text-small text-ignite-muted">
            If this mentions a missing table or column, the ambassadors
            migration has not been applied to this environment yet.
          </p>
        </div>
      </div>
    );
  }
  const rows = (data ?? []) as AmbassadorAdminRow[];

  // Attributed bookings + comps used, aggregated in one pass each.
  const { data: bookingRows } = await client
    .from("bookings")
    .select("ambassador_id, payment_status, booking_status")
    .not("ambassador_id", "is", null);
  const paidByAmbassador = new Map<string, number>();
  for (const b of (bookingRows ?? []) as Array<{
    ambassador_id: string;
    payment_status: string;
    booking_status: string;
  }>) {
    if (b.booking_status !== "active" || b.payment_status !== "paid") continue;
    paidByAmbassador.set(b.ambassador_id, (paidByAmbassador.get(b.ambassador_id) ?? 0) + 1);
  }
  const { data: compRows } = await client
    .from("ambassador_comps")
    .select("ambassador_id");
  const compsByAmbassador = new Map<string, number>();
  for (const c of (compRows ?? []) as Array<{ ambassador_id: string }>) {
    compsByAmbassador.set(c.ambassador_id, (compsByAmbassador.get(c.ambassador_id) ?? 0) + 1);
  }

  const siteUrl = env.siteUrl();

  return (
    <div>
      <h1 className="text-h1">Ambassadors</h1>
      <p className="mt-3 max-w-3xl text-small text-ignite-muted">
        Speakers and key partners who help sell tickets. Each gets a
        private dashboard at /ambassador, a trackable share link, and a
        comp ticket allowance. Deactivating stops their link attributing
        and locks their dashboard; nothing is deleted.
      </p>

      <div className="mt-8 rounded-2xl border border-ignite-line bg-ignite-white p-6">
        <h2 className="text-h3">Add an ambassador</h2>
        <div className="mt-4">
          <CreateAmbassadorForm />
        </div>
      </div>

      <h2 className="mt-12 text-h2">All ambassadors</h2>
      {rows.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-ignite-line bg-ignite-white p-6 text-body text-ignite-muted">
          No ambassadors yet. Add one above.
        </p>
      ) : (
        <div className="mt-4 grid gap-4">
          {rows.map((r) => {
            const paid = paidByAmbassador.get(r.id) ?? 0;
            const comps = compsByAmbassador.get(r.id) ?? 0;
            return (
              <div key={r.id} className="rounded-2xl border border-ignite-line bg-ignite-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-h3">
                      {r.display_name}
                      <span className="ml-2 rounded-full bg-ignite-cream px-2 py-0.5 text-eyebrow uppercase text-ignite-muted">
                        {r.ambassador_type}
                      </span>
                      {r.deactivated_at ? (
                        <span className="ml-2 rounded-full bg-ignite-red/10 px-2 py-0.5 text-eyebrow uppercase text-ignite-red">
                          Deactivated
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-1 text-small text-ignite-muted">
                      {r.company ?? "No company"} ·{" "}
                      <span className="font-mono">{ambassadorShareUrl(siteUrl, r.slug)}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/admin/ambassadors/${r.id}`}
                    className="rounded-full border border-ignite-line px-4 py-2 text-small font-semibold text-ignite-ink hover:border-ignite-red"
                  >
                    View dashboard
                  </Link>
                  <form action={toggleAmbassadorActiveAction.bind(null, r.id)}>
                    <button
                      type="submit"
                      className="rounded-full border border-ignite-line px-4 py-2 text-small font-semibold text-ignite-ink hover:border-ignite-red"
                    >
                      {r.deactivated_at ? "Reactivate" : "Deactivate"}
                    </button>
                  </form>
                  </div>
                </div>

                <dl className="mt-4 grid gap-3 text-small sm:grid-cols-2 lg:grid-cols-5">
                  <div>
                    <dt className="text-eyebrow uppercase text-ignite-muted">Link clicks</dt>
                    <dd className="text-h3">{r.link_clicks}</dd>
                  </div>
                  <div>
                    <dt className="text-eyebrow uppercase text-ignite-muted">Attributed bookings</dt>
                    <dd className="text-h3">{paid}</dd>
                  </div>
                  <div>
                    <dt className="text-eyebrow uppercase text-ignite-muted">Comps used</dt>
                    <dd className="text-h3">
                      {comps} / {r.comp_allowance}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-eyebrow uppercase text-ignite-muted">Discount</dt>
                    <dd>{r.discount_percent ? `${r.discount_percent}% (code in phase 2)` : "None"}</dd>
                  </div>
                  <div>
                    <dt className="text-eyebrow uppercase text-ignite-muted">Adjust allowance</dt>
                    <dd>
                      <form
                        action={adjustAllowanceAction.bind(null, r.id)}
                        className="flex items-center gap-2"
                      >
                        <label htmlFor={`allowance-${r.id}`} className="sr-only">
                          Comp allowance for {r.display_name}
                        </label>
                        <input
                          id={`allowance-${r.id}`}
                          name="compAllowance"
                          type="number"
                          min={0}
                          defaultValue={r.comp_allowance}
                          className={INPUT}
                        />
                        <button
                          type="submit"
                          className="rounded-full border border-ignite-line px-3 py-1.5 text-small font-semibold text-ignite-ink hover:border-ignite-red"
                        >
                          Save
                        </button>
                      </form>
                    </dd>
                  </div>
                </dl>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
