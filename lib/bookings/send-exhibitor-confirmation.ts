import { render } from "@react-email/render";
import {
  ExhibitorConfirmationEmail,
  renderExhibitorConfirmationPlainText,
  type ExhibitorConfirmationProps,
} from "@/emails/booking-confirmation-exhibitor";
import { env } from "@/lib/env";
import { formatPoundsFromPence } from "@/lib/pricing";
import { sendTransactionalEmail } from "@/lib/resend/send";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";
import { markConfirmationEmailSent } from "./create";
import { generateSetPasswordLink } from "./send-confirmation";
import type { DietaryRequirement } from "./intent";
import type {
  ExhibitorAttendeeIntent,
  ParsedExhibitorMetadata,
} from "./exhibitor-intent";

export interface SendExhibitorConfirmationInput {
  bookingId: string;
  bookingReference: string;
  parsed: ParsedExhibitorMetadata;
  vatAmountPence: number;
  // Actual charged amount from Stripe's session amount_total
  // (post-discount, post-tax); 0 for comp bookings.
  grossPaidPence?: number;
}

const DIETARY_LABELS: Record<DietaryRequirement, string> = {
  none: "No requirement",
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  gluten_free: "Gluten-free",
  dairy_free: "Dairy-free",
  nut_allergy: "Nut allergy",
  other: "Other (see notes)",
};

export function attendeeLine(a: ExhibitorAttendeeIntent): string {
  if (a.tbc) {
    return "To be confirmed. Let us know nearer the event.";
  }
  const dietary =
    a.dietaryRequirement === "other" && a.dietaryOther
      ? `${DIETARY_LABELS.other}: ${a.dietaryOther}`
      : DIETARY_LABELS[a.dietaryRequirement];
  return `${a.firstName} ${a.surname}, ${a.jobTitle}. Dietary: ${dietary}`;
}

function vatLine(vatPence: number): string {
  if (vatPence <= 0) return "No VAT applied.";
  return `(includes VAT of ${formatPoundsFromPence(vatPence)}).`;
}

export async function sendExhibitorConfirmationEmail(
  input: SendExhibitorConfirmationInput,
): Promise<void> {
  const { bookingId, bookingReference, parsed, vatAmountPence } = input;
  const siteUrl = env.siteUrl().replace(/\/$/, "");

  const setPasswordUrl = await generateSetPasswordLink(parsed.intent.contactEmail);

  const grossPaidPence = input.grossPaidPence ?? parsed.pricing.grossIncVatPence;
  const pricePaid =
    grossPaidPence === 0 ? "£0 (comp)" : formatPoundsFromPence(grossPaidPence);

  const props: ExhibitorConfirmationProps = {
    contactFirstName: parsed.intent.contactFirstName,
    company: parsed.intent.company,
    bookingReference,
    attendeeLines: [
      attendeeLine(parsed.intent.attendees[0]),
      attendeeLine(parsed.intent.attendees[1]),
    ],
    pricePaid,
    vatLine: vatLine(vatAmountPence),
    requirementsUrl: `${siteUrl}/account/booking/${bookingId}/requirements`,
    accountUrl: `${siteUrl}/account`,
    setPasswordUrl,
    refundPolicyUrl: `${siteUrl}/refund-policy`,
  };

  const html = await render(ExhibitorConfirmationEmail(props));
  const text = renderExhibitorConfirmationPlainText(props);

  const result = await sendTransactionalEmail({
    to: parsed.intent.contactEmail,
    subject: "Your IGNITE! 27 exhibitor stand",
    html,
    text,
    tag: "booking-confirmation-exhibitor",
  });

  if (result.dispatched) {
    // Same trade-off as the delegate sender: a DB failure writing the
    // sent flag must not poison the result after Resend accepted the
    // email. Worst case is a rare duplicate email on webhook retry.
    try {
      const supabase = createSupabaseServiceClient();
      await markConfirmationEmailSent(supabase, bookingId);
    } catch (err) {
      console.error(
        "[send-exhibitor-confirmation] markConfirmationEmailSent failed after successful Resend dispatch",
        bookingId,
        err,
      );
    }
  }
}
