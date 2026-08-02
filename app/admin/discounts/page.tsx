import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { aggregatePromoUsage, type PromoBookingRow } from "@/lib/admin/discounts";
import { codeStatusLabel, toAdminCodeRow, type AdminCodeRow } from "@/lib/admin/stripe-codes";
import { getStripe } from "@/lib/stripe/client";
import { formatPoundsFromPence } from "@/lib/pricing";
import { CreateCodeForm, CreateCompForm } from "./CodeForms";
import { deactivateCodeAction } from "./actions";

export const metadata: Metadata = {
  title: "Admin discount codes · IGNITE! 27",
  robots: { index: false, follow: false },
};

// Full in-dashboard code management. The co-organiser never needs the
// Stripe dashboard: create, list, and deactivate all happen here via
// the Stripe API, server-side only.
export default async function AdminDiscountsPage() {
  const { client } = await requireSuperAdmin();

  // Usage + revenue impact from our own bookings data.
  const { data: bookingData, error: bookingsErr } = await client
    .from("bookings")
    .select("promo_code, discount_pence, gross_amount_pence, payment_status")
    .not("promo_code", "is", null);
  if (bookingsErr) console.error("[admin/discounts] bookings error:", bookingsErr);
  const usage = aggregatePromoUsage((bookingData ?? []) as PromoBookingRow[]);
  const usageByCode = new Map(usage.map((u) => [u.code, u]));

  // All promotion codes from Stripe (both active and deactivated).
  let codes: AdminCodeRow[] = [];
  let stripeError: string | null = null;
  try {
    const stripe = getStripe();
    const list = await stripe.promotionCodes.list({ limit: 100, expand: ["data.coupon"] });
    codes = list.data.map(toAdminCodeRow);
  } catch (err) {
    stripeError = err instanceof Error ? err.message : "Stripe list failed";
  }

  const nowMs = Date.now();

  return (
    <div>
      <h1 className="text-h1">Discount codes</h1>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-ignite-line bg-ignite-white p-6">
          <h2 className="text-h3">Create a discount code</h2>
          <div className="mt-4">
            <CreateCodeForm />
          </div>
        </div>
        <div className="rounded-2xl border border-ignite-line bg-ignite-white p-6">
          <h2 className="text-h3">Comp a ticket</h2>
          <div className="mt-4">
            <CreateCompForm />
          </div>
        </div>
      </div>

      <h2 className="mt-12 text-h2">All codes</h2>
      {stripeError ? (
        <p className="mt-4 rounded-xl border border-ignite-red/50 bg-ignite-red/5 p-3 text-small text-ignite-red">
          Could not load codes from Stripe: {stripeError}
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-ignite-line bg-ignite-white">
          <table className="w-full text-left text-small">
            <thead className="border-b border-ignite-line text-eyebrow uppercase text-ignite-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Discount</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Uses (Stripe)</th>
                <th className="px-4 py-3 font-medium">Bookings</th>
                <th className="px-4 py-3 font-medium">Discount given</th>
                <th className="px-4 py-3 font-medium">Revenue after discount</th>
                <th className="px-4 py-3 font-medium">Note</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {codes.map((c) => {
                const u = usageByCode.get(c.code);
                const status = codeStatusLabel(c, nowMs);
                return (
                  <tr key={c.id} className="border-b border-ignite-line/60 last:border-0">
                    <td className="px-4 py-3 font-mono font-semibold">
                      {c.code}
                      {c.isComp ? (
                        <span className="ml-2 rounded-full bg-ignite-red/10 px-2 py-0.5 text-eyebrow uppercase text-ignite-red">
                          Comp
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      {c.percentOff !== null
                        ? `${c.percentOff}% off`
                        : c.amountOffPence !== null
                          ? `${formatPoundsFromPence(c.amountOffPence)} off`
                          : "?"}
                    </td>
                    <td className="px-4 py-3">{status}</td>
                    <td className="px-4 py-3">
                      {c.timesRedeemed}
                      {c.maxRedemptions !== null ? ` / ${c.maxRedemptions}` : ""}
                    </td>
                    <td className="px-4 py-3">{u?.uses ?? 0}</td>
                    <td className="px-4 py-3">
                      {u ? formatPoundsFromPence(u.totalDiscountPence) : "£0"}
                    </td>
                    <td className="px-4 py-3">
                      {u ? formatPoundsFromPence(u.totalRevenuePence) : "£0"}
                    </td>
                    <td className="px-4 py-3 max-w-48 truncate" title={c.note}>{c.note}</td>
                    <td className="px-4 py-3">
                      {status === "Active" ? (
                        <form action={deactivateCodeAction.bind(null, c.id)}>
                          <button
                            type="submit"
                            className="rounded-full border border-ignite-line px-3 py-1 text-small font-semibold text-ignite-ink hover:border-ignite-red hover:text-ignite-red"
                          >
                            Deactivate
                          </button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
              {codes.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-ignite-muted">
                    No codes yet. Create one above.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-small text-ignite-muted">
        Codes apply to any ticket type. Uses (Stripe) counts redemptions at
        checkout; Bookings counts completed paid or comp bookings recorded
        against the code. Deactivating stops new redemptions immediately
        and cannot be undone here (create a fresh code instead). Every
        create and deactivate is recorded in the admin audit log.
      </p>
    </div>
  );
}
