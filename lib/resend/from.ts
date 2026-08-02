// From-address construction for all platform email.
//
// Decision (Tom, Aug 2026): every platform send goes out as
// "IGNITE! 27 <tom@lincolnshiremarketing.co.uk>". The address MUST be
// on a Resend-verified domain; lincolnshiremarketing.co.uk is the only
// verified domain, and ignite27.co.uk is NOT verified, which is what
// broke booking confirmations in production (Resend rejects the send
// after auth when the from-domain is unverified).
//
// The address itself still comes from RESEND_FROM_EMAIL so staging can
// differ if ever needed; the display name is fixed here.

export const EMAIL_DISPLAY_NAME = "IGNITE! 27";

// Wraps a bare address in the display name. If the env value already
// carries a display name ("Name <addr>"), it is passed through
// untouched so ops can override the whole string if ever required.
export function buildFromAddress(envValue: string): string {
  const trimmed = envValue.trim();
  if (trimmed.includes("<")) return trimmed;
  return `${EMAIL_DISPLAY_NAME} <${trimmed}>`;
}
