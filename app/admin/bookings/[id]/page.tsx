import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { formatPoundsFromPence } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Admin booking · IGNITE! 27",
  robots: { index: false, follow: false },
};

interface Detail {
  id: string;
  booking_reference: string | null;
  booking_type: string;
  ticket_type: string;
  pricing_period: string;
  gross_amount_pence: number;
  vat_amount_pence: number;
  promo_code: string | null;
  discount_pence: number | null;
  lunch_included: boolean;
  payment_status: string;
  booking_status: string;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  terms_accepted_at: string | null;
  confirmation_email_sent_at: string | null;
  created_at: string;
  booking_attendees: ReadonlyArray<{
    first_name: string;
    surname: string;
    email: string;
    mobile: string | null;
    company: string | null;
    job_title: string | null;
    dietary_requirement: string;
    dietary_other: string | null;
    lunch_entitlement: boolean;
    is_primary_contact: boolean;
  }>;
}

export default async function AdminBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { client } = await requireSuperAdmin();
  const { id } = await params;

  const { data, error } = await client
    .from("bookings")
    .select(
      `id, booking_reference, booking_type, ticket_type, pricing_period,
       gross_amount_pence, vat_amount_pence, promo_code, discount_pence,
       lunch_included, payment_status, booking_status,
       stripe_checkout_session_id, stripe_payment_intent_id,
       terms_accepted_at, confirmation_email_sent_at, created_at,
       booking_attendees (
         first_name, surname, email, mobile, company, job_title,
         dietary_requirement, dietary_other, lunch_entitlement, is_primary_contact
       )`,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) console.error("[admin/booking] error:", error);
  if (!data) notFound();
  const b = data as Detail;

  const rows: ReadonlyArray<[string, string]> = [
    ["Reference", b.booking_reference ?? "PENDING"],
    ["Type", b.booking_type === "exhibitor" ? "Exhibitor" : b.ticket_type === "vip" ? "VIP" : "Delegate"],
    ["Pricing period", b.pricing_period],
    ["Gross paid", formatPoundsFromPence(b.gross_amount_pence)],
    ["VAT", formatPoundsFromPence(b.vat_amount_pence)],
    ["Promo code", b.promo_code ?? "none"],
    ["Discount", b.discount_pence ? formatPoundsFromPence(b.discount_pence) : "none"],
    ["Lunch", b.lunch_included ? "Included" : "Not added"],
    ["Payment status", b.payment_status],
    ["Booking status", b.booking_status],
    ["Stripe session", b.stripe_checkout_session_id ?? ""],
    ["Stripe payment intent", b.stripe_payment_intent_id ?? ""],
    ["Terms accepted", b.terms_accepted_at ?? ""],
    ["Confirmation email sent", b.confirmation_email_sent_at ?? "not yet"],
    ["Created", b.created_at],
  ];

  return (
    <div>
      <Link href="/admin/bookings" className="text-small font-semibold text-ignite-red underline underline-offset-4">
        Back to bookings
      </Link>
      <h1 className="mt-3 text-h1">{b.booking_reference ?? "Booking"}</h1>

      <dl className="mt-8 grid gap-4 rounded-2xl border border-ignite-line bg-ignite-white p-6 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-eyebrow uppercase text-ignite-muted">{label}</dt>
            <dd className="mt-1 break-all text-body text-ignite-ink">{value}</dd>
          </div>
        ))}
      </dl>

      <h2 className="mt-10 text-h2">Attendees</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {b.booking_attendees.map((a, i) => (
          <dl key={i} className="rounded-2xl border border-ignite-line bg-ignite-white p-5">
            <div>
              <dt className="text-eyebrow uppercase text-ignite-muted">
                {a.is_primary_contact ? "Primary contact" : `Attendee ${i + 1}`}
              </dt>
              <dd className="mt-1 text-body font-semibold">{a.first_name} {a.surname}</dd>
            </div>
            <div className="mt-3 text-small text-ignite-ink">
              <p>{a.email}</p>
              {a.mobile ? <p>{a.mobile}</p> : null}
              {a.company ? <p>{a.company}{a.job_title ? `, ${a.job_title}` : ""}</p> : null}
              <p className="mt-2 text-ignite-muted">
                Dietary: {a.dietary_requirement === "other" && a.dietary_other ? `Other: ${a.dietary_other}` : a.dietary_requirement}
                {" · "}Lunch: {a.lunch_entitlement ? "yes" : "no"}
              </p>
            </div>
          </dl>
        ))}
      </div>
    </div>
  );
}
