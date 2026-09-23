import { describe, expect, it } from "vitest";
import {
  computeReorderSwap,
  validateAnnouncement,
  type OrderedRow,
} from "./validate";

describe("validateAnnouncement", () => {
  const valid = {
    headline: "Stephine Robinson joins the lineup",
    body: "Practical AI for small businesses, live on the main stage.",
    linkUrl: "https://www.ignite27.co.uk/speakers",
    imageUrl: "/images/speakers/stephine-robinson.webp",
  };

  it("accepts a full announcement and trims fields", () => {
    const result = validateAnnouncement({ ...valid, headline: `  ${valid.headline}  ` });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.headline).toBe(valid.headline);
  });

  it("link and image are optional, normalised to null", () => {
    const result = validateAnnouncement({ ...valid, linkUrl: "", imageUrl: "  " });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.linkUrl).toBeNull();
    expect(result.value.imageUrl).toBeNull();
  });

  it("rejects missing or oversize headline and body", () => {
    expect(validateAnnouncement({ ...valid, headline: "" }).ok).toBe(false);
    expect(validateAnnouncement({ ...valid, headline: "x".repeat(121) }).ok).toBe(false);
    expect(validateAnnouncement({ ...valid, body: "" }).ok).toBe(false);
    expect(validateAnnouncement({ ...valid, body: "x".repeat(501) }).ok).toBe(false);
  });

  it("rejects malformed links; image accepts http(s) or site-relative paths only", () => {
    expect(validateAnnouncement({ ...valid, linkUrl: "not-a-url" }).ok).toBe(false);
    expect(validateAnnouncement({ ...valid, imageUrl: "images/no-leading-slash.webp" }).ok).toBe(false);
    expect(validateAnnouncement({ ...valid, imageUrl: "https://cdn.example.com/a.webp" }).ok).toBe(true);
  });
});

describe("computeReorderSwap", () => {
  const rows: OrderedRow[] = [
    { id: "a", sort_order: 10 },
    { id: "b", sort_order: 20 },
    { id: "c", sort_order: 30 },
  ];

  it("swaps sort orders with the neighbour", () => {
    expect(computeReorderSwap(rows, "b", "up")).toEqual([
      { id: "b", sort_order: 10 },
      { id: "a", sort_order: 20 },
    ]);
    expect(computeReorderSwap(rows, "b", "down")).toEqual([
      { id: "b", sort_order: 30 },
      { id: "c", sort_order: 20 },
    ]);
  });

  it("no-ops at the edges and for unknown ids", () => {
    expect(computeReorderSwap(rows, "a", "up")).toBeNull();
    expect(computeReorderSwap(rows, "c", "down")).toBeNull();
    expect(computeReorderSwap(rows, "zz", "up")).toBeNull();
  });

  it("nudges past equal sort orders instead of swapping into place", () => {
    const tied: OrderedRow[] = [
      { id: "a", sort_order: 100 },
      { id: "b", sort_order: 100 },
    ];
    expect(computeReorderSwap(tied, "b", "up")).toEqual([{ id: "b", sort_order: 99 }]);
  });
});

describe("blank link handling (regression: 'leave it blank' must work)", () => {
  const base = { headline: "News", body: "Body text.", imageUrl: "" };

  it("empty and whitespace-only links validate as blank -> null", () => {
    for (const linkUrl of ["", "   ", "\t"]) {
      const result = validateAnnouncement({ ...base, linkUrl });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.linkUrl).toBeNull();
    }
  });

  it("invisible characters (zero-width space, BOM, word joiner) count as blank", () => {
    for (const linkUrl of ["​", "﻿", "⁠", " ​ "]) {
      const result = validateAnnouncement({ ...base, linkUrl });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.linkUrl).toBeNull();
    }
  });

  it("a real but invalid link still fails with the blank option offered", () => {
    const result = validateAnnouncement({ ...base, linkUrl: "not-a-url" });
    expect(result.ok).toBe(false);
  });
});
