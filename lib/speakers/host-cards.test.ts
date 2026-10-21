import { describe, expect, it } from "vitest";
import { hostHasSubmitted } from "./queries";

describe("hostHasSubmitted", () => {
  it("any submitted content qualifies: workshop title, bio, or photo", () => {
    expect(
      hostHasSubmitted({ talk_title: "LinkedIn that works", bio: "", photo_path: null }),
    ).toBe(true);
    expect(hostHasSubmitted({ talk_title: "", bio: "Twenty years in.", photo_path: null })).toBe(
      true,
    );
    expect(hostHasSubmitted({ talk_title: "", bio: "", photo_path: "x/photo.jpg" })).toBe(true);
  });

  it("accepted-but-blank profiles stay off the page", () => {
    expect(hostHasSubmitted({ talk_title: "", bio: "", photo_path: null })).toBe(false);
    expect(hostHasSubmitted({ talk_title: "  ", bio: null, photo_path: null })).toBe(false);
  });
});
