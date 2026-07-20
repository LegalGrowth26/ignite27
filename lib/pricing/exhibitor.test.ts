import { describe, expect, it } from "vitest";
import {
  EXHIBITOR_STAND_CAP,
  exhibitorStandsRemaining,
  isExhibitorAvailable,
} from "./exhibitor";

describe("EXHIBITOR_STAND_CAP", () => {
  it("is a positive integer (placeholder value, TBC)", () => {
    expect(Number.isInteger(EXHIBITOR_STAND_CAP)).toBe(true);
    expect(EXHIBITOR_STAND_CAP).toBeGreaterThan(0);
  });
});

describe("exhibitorStandsRemaining", () => {
  it("returns the full cap when no stands are sold", () => {
    expect(exhibitorStandsRemaining(0)).toBe(EXHIBITOR_STAND_CAP);
  });

  it("returns one when a single stand is left", () => {
    expect(exhibitorStandsRemaining(EXHIBITOR_STAND_CAP - 1)).toBe(1);
  });

  it("returns zero exactly at the cap", () => {
    expect(exhibitorStandsRemaining(EXHIBITOR_STAND_CAP)).toBe(0);
  });

  it("clamps to zero when oversold (never negative)", () => {
    expect(exhibitorStandsRemaining(EXHIBITOR_STAND_CAP + 5)).toBe(0);
  });
});

describe("isExhibitorAvailable", () => {
  it("is available while below the cap", () => {
    expect(isExhibitorAvailable(0)).toBe(true);
    expect(isExhibitorAvailable(EXHIBITOR_STAND_CAP - 1)).toBe(true);
  });

  it("is unavailable exactly at the cap", () => {
    expect(isExhibitorAvailable(EXHIBITOR_STAND_CAP)).toBe(false);
  });

  it("is unavailable above the cap", () => {
    expect(isExhibitorAvailable(EXHIBITOR_STAND_CAP + 1)).toBe(false);
  });
});
