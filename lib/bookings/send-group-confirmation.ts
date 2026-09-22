import { render } from "@react-email/render";
import {
  GroupConfirmationEmail,
  renderGroupConfirmationPlainText,
  type GroupConfirmationProps,
  type GroupTicketLine,
} from "@/emails/booking-confirmation-group";
import { env } from "@/lib/env";
import { formatPoundsFromPence } from "@/lib/pricing";
import { sendTransactionalEmail } from "@/lib/resend/send";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";
import { markConfirmationEmailSent } from "./create";
import { groupLead, type GroupIntentPayload } from "./group-intent";
import { generateSetPasswordLink } from "./send-confirmation";

// ONE email per group, to the lead booker, listing every ticket. The
// sent-flag lives on the LEAD booking, same 3-branch webhook
// idempotency as single bookings.

export interface SendGroupConfirmationInput {
  leadBookingId: string;
  bookingReferences: string[];
  payload: GroupIntentPayload;
  grossPaidPence: number; // session amount_total
  vatAmountPence: number; // session amount_tax
}

export async function sendGroupConfirmationEmail(
  input: SendGroupConfirmationInput,
): Promise<void> {
  const { payload, bookingReferences } = input;
  const { intent, applied } = payload;
  const lead = groupLead(intent);
  const siteUrl = env.siteUrl().replace(/\/$/, "");

  const tickets: GroupTicketLine[] = intent.tickets.map((t, i) => ({
    reference: bookingReferences[i] ?? "I27-PENDING",
    ticketLabel: t.ticketType === "vip" ? "VIP" : "Regular",
    attendeeName: t.tbc
      ? "Name TBC (let us know nearer the event)"
      : `${t.firstName} ${t.surname}`,
    lunchLine:
      t.ticketType === "vip"
        ? "Lunch included"
        : t.lunchIncluded
          ? "Lunch added"
          : "No lunch",
  }));

  let discountLine: string | null = null;
  if (applied.kind === "group") {
    discountLine = `Group discount (${applied.percent}% off tickets): -${formatPoundsFromPence(applied.discountPence)} ex VAT.`;
  } else if (applied.kind === "code") {
    discountLine = `Discount code ${applied.code}: -${formatPoundsFromPence(applied.discountPence)} ex VAT. (It beat the group discount, so only the code applied.)`;
  }

  const totalPaidLine =
    input.grossPaidPence === 0
      ? "£0 (comp)"
      : `${formatPoundsFromPence(input.grossPaidPence)}${
          input.vatAmountPence > 0
            ? ` (includes VAT of ${formatPoundsFromPence(input.vatAmountPence)})`
            : ""
        }`;

  const props: GroupConfirmationProps = {
    leadFirstName: lead.firstName,
    companyName: intent.company,
    tickets,
    discountLine,
    totalPaidLine,
    setPasswordUrl: await generateSetPasswordLink(lead.email),
    accountUrl: `${siteUrl}/account`,
  };

  const html = await render(GroupConfirmationEmail(props));
  const text = renderGroupConfirmationPlainText(props);
  const result = await sendTransactionalEmail({
    to: lead.email,
    subject: `IGNITE! 27: ${tickets.length} tickets confirmed`,
    html,
    text,
    tag: "booking-confirmation-group",
  });

  if (result.dispatched) {
    try {
      await markConfirmationEmailSent(createSupabaseServiceClient(), input.leadBookingId);
    } catch (err) {
      console.error(
        "[send-group-confirmation] markConfirmationEmailSent failed after successful dispatch",
        input.leadBookingId,
        err,
      );
    }
  }
}
