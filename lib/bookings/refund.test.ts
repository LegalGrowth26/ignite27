import { describe, expect, it } from "vitest";
import { refundPaymentStatus, shouldRemoveCrmTag } from "./refund";

describe("refundPaymentStatus", () => {
  it("Stripe's fully-refunded flag decides full vs partial", () => {
    expect(
      refundPaymentStatus({ fullyRefunded: true, amountRefundedPence: 3000 }),
    ).toBe("refunded");
    // The fees-deducted policy refund is partial in Stripe's eyes but
    // still cancels the booking; the status just records it honestly.
    expect(
      refundPaymentStatus({ fullyRefunded: false, amountRefundedPence: 2850 }),
    ).toBe("partially_refunded");
  });
});

describe("shouldRemoveCrmTag", () => {
  it("removes the tag only when no other active booking carries it", () => {
    expect(shouldRemoveCrmTag(0)).toBe(true);
    // Someone with two tickets who refunds one keeps their tag.
    expect(shouldRemoveCrmTag(1)).toBe(false);
    expect(shouldRemoveCrmTag(3)).toBe(false);
  });
});
