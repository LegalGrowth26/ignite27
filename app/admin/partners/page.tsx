import Link from "next/link";
import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/admin/guard";
import {
  PARTNER_TIER_META,
  type PartnerTier,
} from "@/lib/partners/validate";
import { formatPoundsFromPence } from "@/lib/pricing";
import { endPartnershipAction, togglePartnerVisibilityAction } from "./actions";

export const metadata: Metadata = {
  title: "Admin partners · IGNITE! 27",
  robots: { index: false, follow: false },
};

interface PartnerRow {
  id: string;
  company_name: string;
  contact_name: string;
  contact_email: string;
  tier: PartnerTier;
  agreed_price_pence: number;
  category: string;
  status: "agreed" | "paid" | "ended";
  visible: boolean;
  website_url: string | null;
  logo_path: string | null;
  created_at: string;
}

export default async function AdminPartnersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { client } = await requireSuperAdmin();
  const { status } = await searchParams;

  const { data, error } = await client
    .from("partners")
    .select(
      `id, company_name, contact_name, contact_email, tier,
       agreed_price_pence, category, status, visible, website_url,
       logo_path, created_at`,
    )
    .order("created_at", { ascending: true });

  if (error) {
    return (
      <div>
        <h1 className="text-h1">Partners</h1>
        <div className="mt-8 rounded-2xl border-2 border-ignite-red bg-ignite-red/5 p-6">
          <p className="text-body font-semibold text-ignite-red">Could not load partners.</p>
          <p className="mt-2 font-mono text-small text-ignite-ink">{error.message}</p>
          <p className="mt-3 text-small text-ignite-muted">
            If this mentions a missing table (partners), the 20260510 migration
            has not been applied to this environment yet.
          </p>
        </div>
      </div>
    );
  }

  const rows = (data ?? []) as unknown as PartnerRow[];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-h1">Partners</h1>
        <Link
          href="/admin/partners/new"
          className="rounded-full bg-ignite-red px-5 py-2 text-small font-semibold text-ignite-white hover:bg-ignite-red/90"
        >
          Add partner
        </Link>
      </div>

      <p className="mt-3 max-w-3xl text-small text-ignite-muted">
        Deals sold by you and invoiced offline; no checkout anywhere. Agreed
        AND paid partners show on the public strip (home + /exhibit) while
        visible; Hide pulls one down without ending the deal, End keeps the
        record and removes them for good. Adding into an occupied category
        warns first. Everything is audit-logged.
      </p>

      {status === "added" ? (
        <p className="mt-4 rounded-xl border border-ignite-line bg-ignite-white p-3 text-small">
          Partner added. They are on the public strip now (if visible and not ended).
        </p>
      ) : null}
      {status === "saved" ? (
        <p className="mt-4 rounded-xl border border-ignite-line bg-ignite-white p-3 text-small">
          Partner saved.
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-ignite-line bg-ignite-white p-6 text-body text-ignite-muted">
          No partners recorded yet. Add Chattertons, Impact, and Ecom One
          above when you are ready.
        </p>
      ) : (
        <div className="mt-6 grid gap-4">
          {rows.map((p) => (
            <div key={p.id} className="rounded-2xl border border-ignite-line bg-ignite-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-h3">{p.company_name}</p>
                  <p className="mt-1 text-small text-ignite-muted">
                    {PARTNER_TIER_META[p.tier].label} ·{" "}
                    {formatPoundsFromPence(p.agreed_price_pence)} ex VAT · {p.category} ·{" "}
                    {p.status}
                    {p.status !== "ended" ? (p.visible ? " · on the strip" : " · hidden") : ""}
                  </p>
                  <p className="mt-1 text-small text-ignite-muted">
                    {p.contact_name} · {p.contact_email}
                    {p.logo_path ? " · logo uploaded" : " · no logo"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/admin/partners/${p.id}/edit`}
                    className="rounded-full border border-ignite-line px-4 py-2 text-small font-semibold text-ignite-ink hover:border-ignite-red"
                  >
                    Edit
                  </Link>
                  {p.status !== "ended" ? (
                    <>
                      <form action={togglePartnerVisibilityAction.bind(null, p.id)}>
                        <button
                          type="submit"
                          className="rounded-full border border-ignite-line px-4 py-2 text-small font-semibold text-ignite-ink hover:border-ignite-red"
                        >
                          {p.visible ? "Hide from site" : "Show on site"}
                        </button>
                      </form>
                      <form action={endPartnershipAction.bind(null, p.id)}>
                        <button
                          type="submit"
                          className="rounded-full border border-ignite-line px-4 py-2 text-small font-semibold text-ignite-muted hover:border-ignite-red hover:text-ignite-red"
                        >
                          End partnership
                        </button>
                      </form>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
