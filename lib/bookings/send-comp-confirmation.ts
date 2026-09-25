import { render } from "@react-email/render";
import {
  CompTicketEmail,
  renderCompTicketPlainText,
  type CompTicketProps,
} from "@/emails/comp-ticket";
import { env } from "@/lib/env";
import { sendTransactionalEmail } from "@/lib/resend/send";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";
import { markConfirmationEmailSent } from "./create";
import { generateSetPasswordLink } from "./send-confirmation";

// Comp ticket confirmation: ticket first, account second. Replaces
// the generic delegate confirmation for comp recipients, whose email
// used to push set-password so hard that people clicked it days
// later, hit "expired link", and thought the ticket was broken.

// Pure and unit-tested: who to thank, with a warm fallback when the
// ambassador's name is not available.
export function compGivenByLine(givenByName: string | null): string {
  const name = givenByName?.trim();
  if (!name) {
    return "you have been given a full delegate ticket to IGNITE! 27, with our compliments.";
  }
  return `${name} has given you a full delegate ticket to IGNITE! 27, with their compliments.`;
}

export async function sendCompTicketEmail(input: {
  bookingId: string;
  bookingReference: string;
  recipient: { firstName: string; email: string };
  givenByName: string | null;
}): Promise<void> {
  const siteUrl = env.siteUrl().replace(/\/$/, "");
  const props: CompTicketProps = {
    firstName: input.recipient.firstName,
    bookingReference: input.bookingReference,
    givenByLine: compGivenByLine(input.givenByName),
    setPasswordUrl: await generateSetPasswordLink(input.recipient.email),
    loginUrl: `${siteUrl}/login`,
  };

  const html = await render(CompTicketEmail(props));
  const result = await sendTransactionalEmail({
    to: input.recipient.email,
    subject: "You're booked for IGNITE! 27",
    html,
    text: renderCompTicketPlainText(props),
    tag: "comp-ticket",
  });

  if (result.dispatched) {
    // Same non-poisoning rule as the paid confirmations: the email has
    // left Resend, so a flag-write failure logs and moves on.
    try {
      await markConfirmationEmailSent(createSupabaseServiceClient(), input.bookingId);
    } catch (err) {
      console.error(
        "[send-comp-confirmation] markConfirmationEmailSent failed after dispatch",
        input.bookingId,
        err,
      );
    }
  }
}
