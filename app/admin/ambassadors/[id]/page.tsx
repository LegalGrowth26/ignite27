import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { ambassadorShareUrl } from "@/lib/ambassadors/attribution";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: "Admin ambassador view · IGNITE! 27",
  robots: { index: false, follow: false },
};

interface AmbassadorDetailRow {
  id: string;
  slug: string;
  display_name: string;
  company: string | null;
  ambassador_type: "speaker" | "partner";
  comp_allowance: number;
  discount_percent: number | null;
  promo_code: string | null;
  link_clicks: number;
  deactivated_at: string | null;
}

interface CompRow {
  recipient_name: string;
  recipient_email: string;
  created_at: string;
}

// Read-only mirror of what THIS ambassador sees on /ambassador: link,
// clicks, attributed bookings, comps issued. Super admins only.
// Deliberately no give-a-ticket form and no edit controls here; the
// admin levers (allowance, deactivate) live on the list page.
export default async function AdminAmbassadorViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { client } = await requireSuperAdmin();
  const { id } = await params;

  const { data, error } = await client
    .from("ambassadors")
    .select(
      "id, slug, display_name, company, ambassador_type, comp_allowance, discount_percent, promo_code, link_clicks, deactivated_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) console.error("[admin/ambassadors] detail error:", error.message);
  if (!data) notFound();
  const ambassador = data as AmbassadorDetailRow;

  // Same counts-only definer function the ambassador dashboard uses;
  // its ownership check already admits super admins.
  let paidBookings = 0;
  const { data: counts, error: countsErr } = await client.rpc(
    "ambassador_booking_counts",
    { p_ambassador_id: ambassador.id },
  );
  if (countsErr) {
    console.error("[admin/ambassadors] counts error:", countsErr.message);
  } else {
    paidBookings = Number(
      (counts as Array<{ paid_bookings: number }> | null)?.[0]?.paid_bookings ?? 0,
    );
  }

  const { data: compData } = await client
    .from("ambassador_comps")
    .select("recipient_name, recipient_email, created_at")
    .eq("ambassador_id", ambassador.id)
    .order("created_at", { ascending: false });
  const comps = (compData ?? []) as CompRow[];
  const shareUrl = ambassadorShareUrl(env.siteUrl(), ambassador.slug);

  return (
    <div>
      <Link
        href="/admin/ambassadors"
        className="text-small font-semibold text-ignite-red underline underline-offset-4"
      >
        Back to ambassadors
      </Link>
      <h1 className="mt-4 text-h1">
        {ambassador.display_name}
        <span className="ml-3 rounded-full bg-ignite-cream px-2 py-0.5 text-eyebrow uppercase text-ignite-muted">
          {ambassador.ambassador_type}
        </span>
        {ambassador.deactivated_at ? (
          <span className="ml-2 rounded-full bg-ignite-red/10 px-2 py-0.5 text-eyebrow uppercase text-ignite-red">
            Deactivated
          </span>
        ) : null}
      </h1>
      <p className="mt-2 text-small text-ignite-muted">
        Read-only view of exactly what this ambassador sees on their
        dashboard. Allowance and deactivation controls are on the list page.
      </p>

      <div className="mt-8 rounded-2xl border border-ignite-line bg-ignite-white p-6">
        <p className="text-eyebrow uppercase text-ignite-muted">Share link</p>
        <p className="mt-2 break-all font-mono text-small text-ignite-ink">{shareUrl}</p>
      </div>

      <dl className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-ignite-line bg-ignite-white p-5">
          <dt className="text-eyebrow uppercase text-ignite-muted">Link clicks</dt>
          <dd className="mt-2 text-h2">{ambassador.link_clicks}</dd>
        </div>
        <div className="rounded-2xl border border-ignite-line bg-ignite-white p-5">
          <dt className="text-eyebrow uppercase text-ignite-muted">Tickets sold via link</dt>
          <dd className="mt-2 text-h2">{paidBookings}</dd>
        </div>
        <div className="rounded-2xl border border-ignite-line bg-ignite-white p-5">
          <dt className="text-eyebrow uppercase text-ignite-muted">Comps issued</dt>
          <dd className="mt-2 text-h2">
            {comps.length}{" "}
            <span className="text-small text-ignite-muted">of {ambassador.comp_allowance}</span>
          </dd>
        </div>
      </dl>

      {ambassador.discount_percent ? (
        <p className="mt-6 rounded-2xl border border-ignite-line bg-ignite-white p-5 text-small text-ignite-ink">
          Personal discount: {ambassador.discount_percent}%
          {ambassador.promo_code ? (
            <>
              {" "}
              (code <span className="font-mono font-semibold">{ambassador.promo_code}</span>)
            </>
          ) : (
            " (code goes live in phase 2)"
          )}
        </p>
      ) : null}

      <div className="mt-6 rounded-2xl border border-ignite-line bg-ignite-white p-6">
        <h2 className="text-h3">Tickets they have given</h2>
        {comps.length === 0 ? (
          <p className="mt-3 text-small text-ignite-muted">None yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-ignite-line/60">
            {comps.map((c) => (
              <li
                key={`${c.recipient_email}-${c.created_at}`}
                className="flex flex-wrap justify-between gap-2 py-2 text-small"
              >
                <span className="font-semibold text-ignite-ink">{c.recipient_name}</span>
                <span className="text-ignite-muted">{c.recipient_email}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
