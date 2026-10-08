import { describe, expect, it } from "vitest";
import { reminderParagraphs } from "./reminder";

const base = {
  firstName: "Dan",
  promoCode: "DANINCE20",
  discountPercent: 20,
  shareUrl: "https://ignite27.co.uk/?ref=dan-ince",
  compAllowance: 2,
  compsUsed: 1,
};

describe("reminderParagraphs", () => {
  it("carries code, link, and the guest-ticket position", () => {
    const text = reminderParagraphs(base).join("\n");
    expect(text).toContain("DANINCE20");
    expect(text).toContain("20% off delegate and VIP tickets");
    expect(text).toContain("https://ignite27.co.uk/?ref=dan-ince");
    expect(text).toContain("1 of your 2 guest tickets");
    expect(text).toContain("Tom");
  });

  it("omits the code line when there is no live code", () => {
    const text = reminderParagraphs({ ...base, promoCode: null }).join("\n");
    expect(text).not.toContain("Your code");
    expect(text).toContain("Your share link");
  });

  it("celebrates a fully used allowance and stays quiet at zero allowance", () => {
    expect(reminderParagraphs({ ...base, compsUsed: 2 }).join("\n")).toContain(
      "All 2 of your guest tickets have been claimed",
    );
    const none = reminderParagraphs({ ...base, compAllowance: 0, compsUsed: 0 }).join("\n");
    expect(none).not.toContain("guest ticket");
  });

  it("reads singular at one remaining", () => {
    expect(reminderParagraphs({ ...base, compsUsed: 1 }).join("\n")).toContain(
      "still have 1 of your 2",
    );
  });
});
