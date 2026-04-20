import { describe, expect, it } from "vitest";
import {
  BOOKING_REF_ALPHABET,
  BOOKING_REF_BODY_LENGTH,
  BOOKING_REF_PREFIX,
  generateBookingReference,
  isValidBookingReferenceFormat,
} from "./reference";

describe("generateBookingReference", () => {
  it("starts with the I27- prefix", () => {
    for (let i = 0; i < 25; i++) {
      const ref = generateBookingReference();
      expect(ref.startsWith(BOOKING_REF_PREFIX)).toBe(true);
    }
  });

  it("has the configured body length", () => {
    const ref = generateBookingReference();
    expect(ref.length).toBe(BOOKING_REF_PREFIX.length + BOOKING_REF_BODY_LENGTH);
  });

  it("contains only characters from the approved alphabet", () => {
    for (let i = 0; i < 500; i++) {
      const ref = generateBookingReference();
      const body = ref.slice(BOOKING_REF_PREFIX.length);
      for (const ch of body) {
        expect(BOOKING_REF_ALPHABET).toContain(ch);
      }
    }
  });

  it("excludes visually ambiguous characters 0, 1, I, L, O, U", () => {
    const forbidden = ["0", "1", "I", "L", "O", "U"];
    for (const ch of forbidden) {
      expect(BOOKING_REF_ALPHABET).not.toContain(ch);
    }
  });

  it("produces distinct references across many calls", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) {
      seen.add(generateBookingReference());
    }
    expect(seen.size).toBe(500);
  });
});

describe("isValidBookingReferenceFormat", () => {
  it("accepts refs from generateBookingReference", () => {
    for (let i = 0; i < 50; i++) {
      expect(isValidBookingReferenceFormat(generateBookingReference())).toBe(true);
    }
  });

  it("rejects wrong prefix", () => {
    expect(isValidBookingReferenceFormat("I28-ABCDEFG")).toBe(false);
  });

  it("rejects wrong length", () => {
    expect(isValidBookingReferenceFormat("I27-ABC")).toBe(false);
    expect(isValidBookingReferenceFormat("I27-ABCDEFGH")).toBe(false);
  });

  it("rejects forbidden characters in body", () => {
    expect(isValidBookingReferenceFormat("I27-0BCDEFG")).toBe(false);
    expect(isValidBookingReferenceFormat("I27-IBCDEFG")).toBe(false);
  });
});
