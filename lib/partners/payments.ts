// Partner payment logic, pure and unit-tested. Money facts only:
// the webhook writes paid rows, and everything else here derives from
// them. There is no manual status flipping anywhere (decision,
// September 2026): unpaid / part-paid / paid in full is computed from
// the ledger, and "End partnership" is the only manual action left.

export const PAYMENT_REQUEST_VALIDITY_DAYS = 30;
export const UK_VAT_RATE = 0.2;

export interface PaymentRequestRow {
  id: string;
  amount_ex_vat_pence: number;
  status: "pending" | "paid" | "cancelled";
  expires_at: string;
  sent_at: string | null;
  paid_at: string | null;
}

// ---------------------------------------------------------------------------
// Derived partner payment state.
// ---------------------------------------------------------------------------

export type PartnerPaymentState = "unpaid" | "part_paid" | "paid_in_full";

export interface DerivedPaymentState {
  state: PartnerPaymentState;
  paidPence: number;
  agreedPence: number;
}

export function paidTotalPence(rows: readonly PaymentRequestRow[]): number {
  return rows
    .filter((r) => r.status === "paid")
    .reduce((sum, r) => sum + r.amount_ex_vat_pence, 0);
}

// Overpayment (a deliberate extra request) still reads paid in full,
// with the true figure carried in paidPence: never blocked, never
// hidden.
export function derivePaymentState(
  agreedPence: number,
  rows: readonly PaymentRequestRow[],
): DerivedPaymentState {
  const paidPence = paidTotalPence(rows);
  if (paidPence <= 0 && agreedPence > 0) {
    return { state: "unpaid", paidPence, agreedPence };
  }
  if (paidPence >= agreedPence) {
    return { state: "paid_in_full", paidPence, agreedPence };
  }
  return { state: "part_paid", paidPence, agreedPence };
}

export function paymentStateLabel(d: DerivedPaymentState): string {
  const pounds = (p: number) => `£${(p / 100).toFixed(p % 100 === 0 ? 0 : 2)}`;
  switch (d.state) {
    case "unpaid":
      return "Unpaid";
    case "part_paid":
      return `Part-paid: ${pounds(d.paidPence)} of ${pounds(d.agreedPence)}`;
    case "paid_in_full":
      return d.paidPence > d.agreedPence
        ? `Paid in full (${pounds(d.paidPence)} received)`
        : "Paid in full";
  }
}

// Default for a NEW request: the remaining balance (decision), never
// below zero. A fully paid partner defaults to 0, which the amount
// validation rejects, nudging the admin to type a deliberate figure.
export function defaultRequestPence(
  agreedPence: number,
  rows: readonly PaymentRequestRow[],
): number {
  return Math.max(0, agreedPence - paidTotalPence(rows));
}

// ---------------------------------------------------------------------------
// Individual request state.
// ---------------------------------------------------------------------------

export type RequestDisplayStatus = "pending" | "paid" | "cancelled" | "expired";

export function requestDisplayStatus(
  row: Pick<PaymentRequestRow, "status" | "expires_at">,
  now: Date,
): RequestDisplayStatus {
  if (row.status !== "pending") return row.status;
  return new Date(row.expires_at).getTime() <= now.getTime() ? "expired" : "pending";
}

// Whether the /pay page may mint a Checkout Session for this request.
// The webhook re-checks paid-ness on delivery, so this gate is about
// honouring expiry and endings, not double-spend safety.
export function canPayRequest(
  row: Pick<PaymentRequestRow, "status" | "expires_at">,
  partnerEnded: boolean,
  now: Date,
): boolean {
  return !partnerEnded && requestDisplayStatus(row, now) === "pending";
}

export function nextExpiry(now: Date): Date {
  return new Date(now.getTime() + PAYMENT_REQUEST_VALIDITY_DAYS * 24 * 60 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// Amounts.
// ---------------------------------------------------------------------------

export type AmountValidation =
  | { ok: true; pence: number }
  | { ok: false; error: string };

export function validateRequestAmountPounds(raw: unknown): AmountValidation {
  const text = typeof raw === "string" ? raw.trim().replace(/^£/, "") : "";
  if (!text) return { ok: false, error: "Enter the amount to request, in pounds." };
  const pounds = Number.parseFloat(text);
  if (!Number.isFinite(pounds) || pounds <= 0 || pounds > 1_000_000) {
    return { ok: false, error: "The amount must be a number of pounds above zero." };
  }
  return { ok: true, pence: Math.round(pounds * 100) };
}

// "£X + VAT (£Y total)" for the admin form and the request email. VAT
// here is presentation only: Stripe Tax computes the authoritative
// figure at payment time from the ex-VAT amount.
export function vatPence(exVatPence: number): number {
  return Math.round(exVatPence * UK_VAT_RATE);
}

export function amountWithVatLabel(exVatPence: number): string {
  const pounds = (p: number) => `£${(p / 100).toFixed(p % 100 === 0 ? 0 : 2)}`;
  return `${pounds(exVatPence)} + VAT (${pounds(exVatPence + vatPence(exVatPence))} total)`;
}

export function payUrl(siteUrl: string, token: string): string {
  return `${siteUrl.replace(/\/$/, "")}/pay/${token}`;
}
