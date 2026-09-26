import Link from "next/link";
import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/admin/guard";
import {
  derivePaymentState,
  paymentStateLabel,
  type PaymentRequestRow,
} from "@/lib/partners/payments";
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
  status: "agreed" | "paid" | "ended";
  visible: boolean;
  website_url: string | null;
  logo_path: string | null;
  created_at: string;
}

export default async function AdminPartnersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; flags?: string }>;
}) {
  const { client } = await requireSuperAdmin();
  const { status, flags } = await searchParams;
  const flagList = (flags ?? "").split(",").filter(Boolean);
  const flagNote = (flag: string): string | null => {
    if (flag === "welcome_sent")
      return "Welcome email sent: their two places, guest ticket link, share link, and 20% code, all in one.";
    if (flag === "welcome_failed")
      return "The welcome email FAILED to send. Fix and use Resend welcome on the partner's edit page.";
    if (flag === "package_failed")
      return "The 2-place package booking could not be created. Re-save the partner to retry; check the logs.";
    if (flag === "perks_failed")
      return "Guest-ticket provisioning failed. Re-save the partner to retry; check the logs.";
    if (flag === "ambassador_existing")
      return "This contact already has ambassador perks (for example as a workshop host). Their existing links and allowance stay exactly where they are; nothing was overwritten.";
    if (flag.startsWith("allowance_clamped_"))
      return `The allowance could not go below guest tickets already used; it is set to ${flag.replace("allowance_clamped_", "")}.`;
    if (flag === "payment_sent") return "Payment link emailed to the contact for the full agreed amount.";
    if (flag === "payment_held")
      return "Payment email held, as ticked. Send it from the Payments panel on the partner's edit page when ready.";
    if (flag === "payment_email_failed")
      return "The payment request was created but its email FAILED. Use Resend on the Payments panel.";
    if (flag === "payment_failed")
      return "The payment request could not be created. Use Send payment request on the partner's edit page.";
    return null;
  };

  const { data, error } = await client
    .from("partners")
    .select(
      `id, company_name, contact_name, contact_email, tier,
       agreed_price_pence, status, visible, website_url,
       logo_path, created_at`,
    )
    .order("created_at", { ascending: true });

  // Payment ledger for the derived state chip (unpaid / part-paid /
  // paid in full). One query for all partners; grouped in memory.
  const { data: paymentData, error: paymentsErr } = await client
    .from("partner_payment_requests")
    .select("partner_id, id, amount_ex_vat_pence, status, expires_at, sent_at, paid_at");
  if (paymentsErr) {
    console.error("[admin/partners] payments query failed:", paymentsErr.message);
  }
  const paymentsByPartner = new Map<string, PaymentRequestRow[]>();
  for (const raw of (paymentData ?? []) as Array<PaymentRequestRow & { partner_id: string }>) {
    const list = paymentsByPartner.get(raw.partner_id) ?? [];
    list.push(raw);
    paymentsByPartner.set(raw.partner_id, list);
  }

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
        Deals sold by you; collection via payment links from each partner's
        record. Payment status follows the money (unpaid, part-paid, paid in
        full), webhook-driven, never flipped by hand. Partners show on the
        public strip (home + /exhibit) while visible and not ended; Hide
        pulls one down without ending the deal, End keeps the record,
        removes them for good, and cancels any live payment links.
        Everything is audit-logged.
      </p>

      {paymentsErr ? (
        <p className="mt-4 rounded-xl border-2 border-ignite-red bg-ignite-red/5 p-3 text-small text-ignite-red">
          Payment ledger unavailable ({paymentsErr.message}). If this mentions
          a missing table, the 20260515 migration has not been applied here.
        </p>
      ) : null}
      {status === "added" ? (
        <p className="mt-4 rounded-xl border border-ignite-line bg-ignite-white p-3 text-small">
          Partner added. They are on the public strip now (if visible and not ended).
        </p>
      ) : null}
      {flagList.length > 0 ? (
        <div className="mt-4 grid gap-2">
          {flagList.map((f) => {
            const note = flagNote(f);
            if (!note) return null;
            const bad = /FAILED|could not/i.test(note);
            return (
              <p
                key={f}
                className={`rounded-xl border p-3 text-small ${bad ? "border-ignite-red/50 bg-ignite-red/5 text-ignite-red" : "border-ignite-line bg-ignite-white text-ignite-ink"}`}
              >
                {note}
              </p>
            );
          })}
        </div>
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
                    {formatPoundsFromPence(p.agreed_price_pence)} ex VAT ·{" "}
                    {p.status === "ended"
                      ? "ended"
                      : paymentStateLabel(
                          derivePaymentState(
                            p.agreed_price_pence,
                            paymentsByPartner.get(p.id) ?? [],
                          ),
                        )}
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
