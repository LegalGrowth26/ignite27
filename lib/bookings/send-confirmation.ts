import type { ParsedDelegateMetadata } from "./intent";

export interface SendDelegateConfirmationInput {
  bookingId: string;
  bookingReference: string;
  parsed: ParsedDelegateMetadata;
  vatAmountPence: number;
}

// Stub. The real implementation lives in commit 4 (email template +
// Resend send helper). Until then calling this throws so the webhook's
// try/catch logs the miss and leaves confirmation_email_sent_at null.
export async function sendDelegateConfirmationEmail(
  _input: SendDelegateConfirmationInput,
): Promise<void> {
  throw new Error("sendDelegateConfirmationEmail not implemented yet");
}
