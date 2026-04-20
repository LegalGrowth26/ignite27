import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { Button } from "@/components/Button";
import { Container } from "@/components/Container";
import { Section } from "@/components/Section";
import { SectionHeader } from "@/components/SectionHeader";
import type { DietaryRequirement } from "@/lib/bookings/intent";
import { formatPoundsFromPence } from "@/lib/pricing";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import {
  submitCancellationForm,
  submitCorrectionForm,
  submitResendConfirmation,
} from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Booking — Ignite 27",
};

interface BookingDetail {
  id: string;
  booking_reference: string | null;
  booking_type: "delegate" | "exhibitor";
  ticket_type: "regular" | "vip" | "exhibitor";
  pricing_window: string;
  gross_amount_pence: number;
  vat_amount_pence: number;
  charity_uplift_pence: number;
  lunch_included: boolean;
  payment_status: string;
  booking_status: string;
  created_at: string;
  confirmation_email_sent_at: string | null;
  booking_attendees: ReadonlyArray<{
    first_name: string;
    surname: string;
    email: string;
    mobile: string | null;
    company: string | null;
    job_title: string | null;
    dietary_requirement: DietaryRequirement;
    dietary_other: string | null;
    lunch_entitlement: boolean;
    badge_qr_url: string | null;
    is_primary_contact: boolean;
  }>;
}

const DIETARY_LABELS: Record<DietaryRequirement, string> = {
  none: "No requirement",
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  gluten_free: "Gluten-free",
  dairy_free: "Dairy-free",
  nut_allergy: "Nut allergy",
  other: "Other",
};

function windowLabel(value: string): string {
  switch (value) {
    case "window_1":
      return "Window 1";
    case "window_2":
      return "Window 2";
    case "window_3":
      return "Window 3";
    case "christmas_drop":
      return "Christmas drop (Window 2 prices)";
    case "window_4":
      return "Window 4";
    case "event_day":
      return "Event day";
    default:
      return value;
  }
}

function ticketLabel(booking: BookingDetail): string {
  if (booking.booking_type === "exhibitor") return "Exhibitor";
  return booking.ticket_type === "vip" ? "VIP" : "Regular";
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function BookingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const search = await searchParams;

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect(`/login?return_to=${encodeURIComponent(`/account/booking/${id}`)}`);
  }

  const { data, error } = await supabase
    .from("bookings")
    .select(
      `id, booking_reference, booking_type, ticket_type, pricing_window,
       gross_amount_pence, vat_amount_pence, charity_uplift_pence, lunch_included,
       payment_status, booking_status, created_at, confirmation_email_sent_at,
       booking_attendees (
         first_name, surname, email, mobile, company, job_title,
         dietary_requirement, dietary_other, lunch_entitlement, badge_qr_url, is_primary_contact
       )`,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[account/booking] error:", error);
  }
  if (!data) notFound();

  const booking = data as BookingDetail;
  const primary =
    booking.booking_attendees.find((a) => a.is_primary_contact) ?? booking.booking_attendees[0];

  const statusParam = Array.isArray(search.status) ? search.status[0] : search.status;
  const messageParam = Array.isArray(search.message) ? search.message[0] : search.message;
  const notice = buildNotice(statusParam, messageParam);

  return (
    <Section tone="light">
      <Container>
        <div className="mx-auto max-w-3xl">
          <Link
            href="/account"
            className="text-small font-semibold text-ignite-red underline underline-offset-4"
          >
            Back to your account
          </Link>
          <div className="mt-4">
            <SectionHeader
              eyebrow={ticketLabel(booking)}
              heading={booking.booking_reference ?? "Your booking"}
            />
          </div>

          {notice ? (
            <div
              className={`mt-6 rounded-xl border p-3 text-small ${
                notice.tone === "error"
                  ? "border-ignite-red/50 bg-ignite-red/5 text-ignite-red"
                  : "border-ignite-line bg-ignite-cream text-ignite-ink"
              }`}
            >
              {notice.text}
            </div>
          ) : null}

          <dl className="mt-8 grid gap-4 rounded-2xl border border-ignite-line bg-ignite-white p-6 sm:grid-cols-2">
            <DetailRow label="Reference" value={booking.booking_reference ?? "I27-PENDING"} />
            <DetailRow label="Ticket" value={ticketLabel(booking)} />
            <DetailRow label="Pricing window" value={windowLabel(booking.pricing_window)} />
            <DetailRow label="Booked" value={formatDate(booking.created_at)} />
            <DetailRow label="Total paid" value={formatPoundsFromPence(booking.gross_amount_pence)} />
            <DetailRow label="VAT" value={formatPoundsFromPence(booking.vat_amount_pence)} />
            {booking.charity_uplift_pence > 0 ? (
              <DetailRow
                label="Charity uplift"
                value={formatPoundsFromPence(booking.charity_uplift_pence)}
              />
            ) : null}
            <DetailRow label="Lunch" value={booking.lunch_included ? "Included" : "Not added"} />
            <DetailRow label="Payment status" value={booking.payment_status} />
            <DetailRow label="Booking status" value={booking.booking_status} />
          </dl>

          {primary ? (
            <div className="mt-6 rounded-2xl border border-ignite-line bg-ignite-white p-6">
              <h2 className="text-h3">Attendee</h2>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                <DetailRow label="Name" value={`${primary.first_name} ${primary.surname}`} />
                <DetailRow label="Email" value={primary.email} />
                {primary.mobile ? <DetailRow label="Mobile" value={primary.mobile} /> : null}
                {primary.company ? (
                  <DetailRow label="Company" value={primary.company} />
                ) : null}
                {primary.job_title ? (
                  <DetailRow label="Job title" value={primary.job_title} />
                ) : null}
                <DetailRow
                  label="Dietary"
                  value={
                    primary.dietary_requirement === "other" && primary.dietary_other
                      ? `Other: ${primary.dietary_other}`
                      : DIETARY_LABELS[primary.dietary_requirement]
                  }
                />
                {primary.badge_qr_url ? (
                  <DetailRow label="Badge QR URL" value={primary.badge_qr_url} />
                ) : null}
              </dl>
            </div>
          ) : null}

          <div className="mt-8 rounded-2xl border border-ignite-line bg-ignite-cream p-6">
            <h2 className="text-h3">Manage your booking</h2>
            <p className="mt-2 text-small text-ignite-muted">
              Refunds follow the{" "}
              <Link
                href="/refund-policy"
                className="underline underline-offset-4 hover:text-ignite-red"
              >
                refund policy
              </Link>
              . Refunds are minus Stripe&apos;s processing fee, which we cannot recover.
            </p>

            <details className="mt-5">
              <summary className="cursor-pointer text-body font-semibold text-ignite-ink">
                Request cancellation
              </summary>
              <form
                action={submitCancellationForm.bind(null, booking.id)}
                className="mt-4 flex flex-col gap-3"
              >
                <label className="text-small font-medium text-ignite-ink">
                  Why are you cancelling? <span className="text-ignite-red">*</span>
                  <input
                    name="reason"
                    required
                    maxLength={500}
                    className="mt-1 w-full rounded-xl border border-ignite-line bg-ignite-white px-4 py-3"
                  />
                </label>
                <label className="text-small font-medium text-ignite-ink">
                  Anything else we should know?
                  <textarea
                    name="notes"
                    rows={3}
                    maxLength={2000}
                    className="mt-1 w-full rounded-xl border border-ignite-line bg-ignite-white px-4 py-3"
                  />
                </label>
                <Button variant="primary" size="md" type="submit">
                  Send cancellation request
                </Button>
              </form>
            </details>

            <details className="mt-5">
              <summary className="cursor-pointer text-body font-semibold text-ignite-ink">
                Request a correction
              </summary>
              <form
                action={submitCorrectionForm.bind(null, booking.id)}
                className="mt-4 flex flex-col gap-3"
              >
                <label className="text-small font-medium text-ignite-ink">
                  What should we change? <span className="text-ignite-red">*</span>
                  <textarea
                    name="requestedChanges"
                    required
                    rows={4}
                    maxLength={2000}
                    className="mt-1 w-full rounded-xl border border-ignite-line bg-ignite-white px-4 py-3"
                  />
                </label>
                <Button variant="primary" size="md" type="submit">
                  Send correction request
                </Button>
              </form>
            </details>

            <form
              action={submitResendConfirmation.bind(null, booking.id)}
              className="mt-6"
            >
              <Button variant="secondary" size="md" type="submit">
                Resend confirmation email
              </Button>
            </form>
          </div>
        </div>
      </Container>
    </Section>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-eyebrow uppercase text-ignite-muted">{label}</dt>
      <dd className="mt-1 text-body text-ignite-ink">{value}</dd>
    </div>
  );
}

function buildNotice(
  status: string | undefined,
  message: string | undefined,
): { text: string; tone: "info" | "error" } | null {
  if (!status) return null;
  if (status === "cancellation_submitted")
    return {
      text: "Cancellation request received. Tom or Paul will be in touch.",
      tone: "info",
    };
  if (status === "correction_submitted")
    return {
      text: "Correction request received. We will action this shortly.",
      tone: "info",
    };
  if (status === "confirmation_resent")
    return { text: "Confirmation email sent again.", tone: "info" };
  if (status === "error" && message)
    return { text: decodeURIComponent(message), tone: "error" };
  return null;
}
