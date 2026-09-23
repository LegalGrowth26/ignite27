import { describe, expect, it } from "vitest";
import { buildHostWorkshopContent } from "./sync";

describe("buildHostWorkshopContent", () => {
  it("mirrors trimmed host content onto the workshop row", () => {
    const content = buildHostWorkshopContent({
      displayName: "  Dan Ince ",
      talkTitle: " LinkedIn that actually generates work ",
      talkDescription: "  Hands-on session. ",
    });
    expect(content).toEqual({
      title: "LinkedIn that actually generates work",
      description: "Hands-on session.",
      speaker_name: "Dan Ince",
    });
  });

  it("returns null while the host has not written a title yet", () => {
    expect(
      buildHostWorkshopContent({
        displayName: "Dan Ince",
        talkTitle: "   ",
        talkDescription: "Something",
      }),
    ).toBeNull();
  });

  it("allows an empty description once there is a title", () => {
    const content = buildHostWorkshopContent({
      displayName: "Elsie Green",
      talkTitle: "Network building",
      talkDescription: "",
    });
    expect(content?.description).toBe("");
  });
});
