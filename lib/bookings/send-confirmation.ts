import { render } from "@react-email/render";
import {
  DelegateConfirmationEmail,
  renderDelegateConfirmationPlainText,
  type DelegateConfirmationProps,
} from "@/emails/booking-confirmation-delegate";
import { env } from "@/lib/env";
import { formatPoundsFromPence } from "@/lib/pricing";
import { sendTransactionalEmail } from "@/lib/resend/send";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";
import { markConfirmationEmailSent } from "./create";
import type { DietaryRequirement, ParsedDelegateMetadata } from "./intent";

export interface SendDelegateConfirmationInput {
  bookingId: string;
  bookingReference: string;
  parsed: ParsedDelegateMetadata;
  vatAmountPence: number;
}

function ticketTypeLabel(parsed: ParsedDelegateMetadata): string {
  return parsed.intent.ticketType === "vip" ? "VIP" : "Regular";
}

function lunchLine(parsed: ParsedDelegateMetadata): string {
  if (parsed.intent.ticketType === "vip") return "Included with VIP.";
  return parsed.intent.lunchIncluded ? "Added, £15." : "Not added.";
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

function dietaryLabel(parsed: ParsedDelegateMetadata): string {
  const base = DIETARY_LABELS[parsed.intent.dietaryRequirement];
  if (parsed.intent.dietaryRequirement === "other" && parsed.intent.dietaryOther) {
    return `${base}: ${parsed.intent.dietaryOther}`;
  }
  return base;
}

function vatLine(vatPence: number): string {
  if (vatPence <= 0) return "VAT-inclusive.";
  return `(includes VAT of ${formatPoundsFromPence(vatPence)}).`;
}

async function generateSetPasswordLink(email: string): Promise<string> {
  const supabase = createSupabaseServiceClient();
  const siteUrl = env.siteUrl().replace(/\/$/, "");
  const { data, error } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${siteUrl}/auth/set-password` },
  });
  if (error || !data.properties?.action_link) {
    throw new Error(`failed to generate set-password link: ${error?.message ?? "no link"}`);
  }
  return data.properties.action_link;
}

export async function sendDelegateConfirmationEmail(
  input: SendDelegateConfirmationInput,
): Promise<void> {
  const { bookingId, bookingReference, parsed, vatAmountPence } = input;
  const siteUrl = env.siteUrl().replace(/\/$/, "");

  const setPasswordUrl = await generateSetPasswordLink(parsed.intent.email);

  const props: DelegateConfirmationProps = {
    firstName: parsed.intent.firstName,
    bookingReference,
    ticketTypeLabel: ticketTypeLabel(parsed),
    lunchLine: lunchLine(parsed),
    dietaryLabel: dietaryLabel(parsed),
    pricePaid: formatPoundsFromPence(parsed.pricing.grossAmountPence),
    vatLine: vatLine(vatAmountPence),
    accountUrl: `${siteUrl}/account`,
    setPasswordUrl,
    refundPolicyUrl: `${siteUrl}/refund-policy`,
  };

  const html = await render(DelegateConfirmationEmail(props));
  const text = renderDelegateConfirmationPlainText(props);

  const result = await sendTransactionalEmail({
    to: parsed.intent.email,
    subject: "Your Ignite 27 ticket",
    html,
    text,
    tag: "booking-confirmation-delegate",
  });

  if (result.dispatched) {
    const supabase = createSupabaseServiceClient();
    await markConfirmationEmailSent(supabase, bookingId);
  }
}
