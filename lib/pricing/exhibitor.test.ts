import { describe, expect, it } from "vitest";
import {
  EXHIBITOR_STAND_CAP,
  exhibitorStandsRemaining,
  isExhibitorAvailable,
} from "./exhibitor";

describe("EXHIBITOR_STAND_CAP", () => {
  it("is 50 (may be raised later)", () => {
    expect(EXHIBITOR_STAND_CAP).toBe(50);
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

describe("publicStandAvailabilityNote", () => {
  it("stays urgency-neutral above the threshold: no numbers leak", async () => {
    const { publicStandAvailabilityNote } = await import("./exhibitor");
    expect(publicStandAvailabilityNote(50)).toBe("Stands are selling. Reserve yours.");
    expect(publicStandAvailabilityNote(11)).toBe("Stands are selling. Reserve yours.");
    expect(publicStandAvailabilityNote(11)).not.toMatch(/\d/);
  });

  it("shows the real number only at the threshold or below", async () => {
    const { publicStandAvailabilityNote } = await import("./exhibitor");
    expect(publicStandAvailabilityNote(10)).toBe("Only 10 stands left.");
    expect(publicStandAvailabilityNote(2)).toBe("Only 2 stands left.");
    expect(publicStandAvailabilityNote(1)).toBe("Only 1 stand left.");
  });

  it("handles the sold-out edge without going negative", async () => {
    const { publicStandAvailabilityNote } = await import("./exhibitor");
    expect(publicStandAvailabilityNote(0)).toBe("All stands are taken.");
  });
});
