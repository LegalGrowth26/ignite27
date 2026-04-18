import { describe, expect, it } from "vitest";
import {
  EVENT_DAY_CHARITY_UPLIFT_PENCE,
  ExhibitorBookingsClosedOnEventDayError,
  getCharityUplift,
  getDelegatePrice,
  getExhibitorPrice,
  LUNCH_ADDON_PENCE,
} from "./prices";
import type { PricingWindow } from "./windows";

describe("LUNCH_ADDON_PENCE", () => {
  it("is £15 fixed across all windows", () => {
    expect(LUNCH_ADDON_PENCE).toBe(1500);
  });
});

describe("getDelegatePrice — regular without lunch", () => {
  const cases: Array<[PricingWindow, number]> = [
    ["window_1", 3900],
    ["window_2", 4900],
    ["window_3", 5900],
    ["christmas_drop", 4900],
    ["window_4", 6900],
    ["event_day", 6900],
  ];

  it.each(cases)("%s returns %d pence", (window, expected) => {
    expect(getDelegatePrice(window, "regular", false)).toBe(expected);
  });
});

describe("getDelegatePrice — regular with lunch adds £15", () => {
  const cases: Array<[PricingWindow, number]> = [
    ["window_1", 3900 + 1500],
    ["window_2", 4900 + 1500],
    ["window_3", 5900 + 1500],
    ["christmas_drop", 4900 + 1500],
    ["window_4", 6900 + 1500],
    ["event_day", 6900 + 1500],
  ];

  it.each(cases)("%s with lunch returns %d pence", (window, expected) => {
    expect(getDelegatePrice(window, "regular", true)).toBe(expected);
  });
});

describe("getDelegatePrice — vip always includes lunch", () => {
  const cases: Array<[PricingWindow, number]> = [
    ["window_1", 9900],
    ["window_2", 11900],
    ["window_3", 13900],
    ["christmas_drop", 11900],
    ["window_4", 15900],
    ["event_day", 15900],
  ];

  it.each(cases)("%s returns %d pence", (window, expected) => {
    expect(getDelegatePrice(window, "vip")).toBe(expected);
  });

  it("Christmas drop reverts VIP to window_2 price", () => {
    expect(getDelegatePrice("christmas_drop", "vip")).toBe(
      getDelegatePrice("window_2", "vip"),
    );
  });
});

describe("getDelegatePrice — Christmas drop matches Window 2 across ticket types", () => {
  it("regular christmas_drop = window_2 regular", () => {
    expect(getDelegatePrice("christmas_drop", "regular", false)).toBe(
      getDelegatePrice("window_2", "regular", false),
    );
  });

  it("regular christmas_drop with lunch = window_2 regular with lunch", () => {
    expect(getDelegatePrice("christmas_drop", "regular", true)).toBe(
      getDelegatePrice("window_2", "regular", true),
    );
  });
});

describe("getDelegatePrice — event-day ticket price excludes charity uplift", () => {
  it("regular event_day equals window_4 regular (uplift is separate)", () => {
    expect(getDelegatePrice("event_day", "regular", false)).toBe(
      getDelegatePrice("window_4", "regular", false),
    );
  });

  it("vip event_day equals window_4 vip (uplift is separate)", () => {
    expect(getDelegatePrice("event_day", "vip")).toBe(
      getDelegatePrice("window_4", "vip"),
    );
  });
});

describe("getExhibitorPrice", () => {
  const cases: Array<[PricingWindow, number]> = [
    ["window_1", 20000],
    ["window_2", 25000],
    ["window_3", 32500],
    ["christmas_drop", 25000],
    ["window_4", 40000],
  ];

  it.each(cases)("%s returns %d pence", (window, expected) => {
    expect(getExhibitorPrice(window)).toBe(expected);
  });

  it("Christmas drop exhibitor price equals Window 2 exhibitor price", () => {
    expect(getExhibitorPrice("christmas_drop")).toBe(getExhibitorPrice("window_2"));
  });

  it("throws on event_day", () => {
    expect(() => getExhibitorPrice("event_day")).toThrow(
      ExhibitorBookingsClosedOnEventDayError,
    );
  });
});

describe("getCharityUplift", () => {
  it("returns £5 on event_day", () => {
    expect(getCharityUplift("event_day")).toBe(EVENT_DAY_CHARITY_UPLIFT_PENCE);
    expect(EVENT_DAY_CHARITY_UPLIFT_PENCE).toBe(500);
  });

  const zeroCases: PricingWindow[] = [
    "window_1",
    "window_2",
    "window_3",
    "christmas_drop",
    "window_4",
  ];

  it.each(zeroCases)("returns 0 on %s", (window) => {
    expect(getCharityUplift(window)).toBe(0);
  });
});

describe("Event-day total (ticket + uplift) matches SPEC public price", () => {
  it("regular total = £74", () => {
    const total = getDelegatePrice("event_day", "regular", false) + getCharityUplift("event_day");
    expect(total).toBe(7400);
  });

  it("vip total = £164", () => {
    const total = getDelegatePrice("event_day", "vip") + getCharityUplift("event_day");
    expect(total).toBe(16400);
  });

  it("regular + lunch total = £89", () => {
    const total = getDelegatePrice("event_day", "regular", true) + getCharityUplift("event_day");
    expect(total).toBe(8900);
  });
});
