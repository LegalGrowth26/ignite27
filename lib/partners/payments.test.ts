import { describe, expect, it } from "vitest";
import {
  amountWithVatLabel,
  canPayRequest,
  defaultRequestPence,
  derivePaymentState,
  nextExpiry,
  paymentStateLabel,
  payUrl,
  requestDisplayStatus,
  validateRequestAmountPounds,
  type PaymentRequestRow,
} from "./payments";

const NOW = new Date("2026-09-23T12:00:00Z");
const FUTURE = "2026-10-23T12:00:00Z";
const PAST = "2026-09-01T12:00:00Z";

function req(over: Partial<PaymentRequestRow>): PaymentRequestRow {
  return {
    id: "r1",
    amount_ex_vat_pence: 50000,
    status: "pending",
    expires_at: FUTURE,
    sent_at: null,
    paid_at: null,
    ...over,
  };
}

describe("derivePaymentState", () => {
  it("no money = unpaid; pending and cancelled requests count nothing", () => {
    const d = derivePaymentState(250000, [
      req({ status: "pending" }),
      req({ status: "cancelled" }),
    ]);
    expect(d.state).toBe("unpaid");
    expect(d.paidPence).toBe(0);
  });

  it("part-payments accumulate towards the agreed price", () => {
    const d = derivePaymentState(250000, [
      req({ status: "paid", amount_ex_vat_pence: 50000 }),
      req({ status: "paid", amount_ex_vat_pence: 50000 }),
    ]);
    expect(d.state).toBe("part_paid");
    expect(paymentStateLabel(d)).toBe("Part-paid: £1,000 of £2,500".replace(/,/g, ""));
  });

  it("covering the agreed price reads paid in full", () => {
    const d = derivePaymentState(100000, [
      req({ status: "paid", amount_ex_vat_pence: 100000 }),
    ]);
    expect(d.state).toBe("paid_in_full");
    expect(paymentStateLabel(d)).toBe("Paid in full");
  });

  it("overpayment shows paid in full with the true figure, never blocked", () => {
    const d = derivePaymentState(100000, [
      req({ status: "paid", amount_ex_vat_pence: 150000 }),
    ]);
    expect(d.state).toBe("paid_in_full");
    expect(paymentStateLabel(d)).toContain("£1500 received");
  });
});

describe("defaultRequestPence", () => {
  it("defaults a new request to the remaining balance", () => {
    expect(
      defaultRequestPence(250000, [req({ status: "paid", amount_ex_vat_pence: 100000 })]),
    ).toBe(150000);
  });

  it("never goes below zero", () => {
    expect(
      defaultRequestPence(100000, [req({ status: "paid", amount_ex_vat_pence: 150000 })]),
    ).toBe(0);
  });
});

describe("requestDisplayStatus / canPayRequest", () => {
  it("a pending request past its expiry reads expired and cannot pay", () => {
    const row = req({ expires_at: PAST });
    expect(requestDisplayStatus(row, NOW)).toBe("expired");
    expect(canPayRequest(row, false, NOW)).toBe(false);
  });

  it("a live pending request can pay unless the partnership ended", () => {
    const row = req({});
    expect(canPayRequest(row, false, NOW)).toBe(true);
    expect(canPayRequest(row, true, NOW)).toBe(false);
  });

  it("paid and cancelled are terminal regardless of expiry", () => {
    expect(requestDisplayStatus(req({ status: "paid", expires_at: PAST }), NOW)).toBe("paid");
    expect(canPayRequest(req({ status: "cancelled" }), false, NOW)).toBe(false);
  });
});

describe("amounts", () => {
  it("validates pounds into pence", () => {
    expect(validateRequestAmountPounds("2500")).toEqual({ ok: true, pence: 250000 });
    expect(validateRequestAmountPounds("£500.50")).toEqual({ ok: true, pence: 50050 });
    expect(validateRequestAmountPounds("0").ok).toBe(false);
    expect(validateRequestAmountPounds("lots").ok).toBe(false);
    expect(validateRequestAmountPounds("").ok).toBe(false);
  });

  it("renders the ex-VAT + total label at 20%", () => {
    expect(amountWithVatLabel(250000)).toBe("£2500 + VAT (£3000 total)");
  });
});

describe("expiry and urls", () => {
  it("expiry is 30 days out", () => {
    expect(nextExpiry(NOW).toISOString()).toBe("2026-10-23T12:00:00.000Z");
  });

  it("builds the pay URL without a double slash", () => {
    expect(payUrl("https://ignite27.co.uk/", "tok")).toBe("https://ignite27.co.uk/pay/tok");
  });
});
