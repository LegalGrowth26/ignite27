import { describe, expect, it } from "vitest";
import { speakerProfileInsertRow } from "./create-profile";

// Regression for the production draft-invitee failure: the draft add
// writes an EXPLICIT published_at null (the column default is now()),
// which requires the column to be nullable (migration 20260513). The
// normal add must NOT carry the key at all, so the default still
// publishes immediately.
describe("speakerProfileInsertRow", () => {
  it("draft invitees carry an explicit published_at null", () => {
    const row = speakerProfileInsertRow(
      {
        displayName: "Dan Ince",
        talkTitle: "LinkedIn",
        profileType: "workshop_host",
        startUnpublished: true,
      },
      "dan-ince",
    );
    expect("published_at" in row).toBe(true);
    expect(row.published_at).toBeNull();
    expect(row.profile_type).toBe("workshop_host");
    expect(row.slug).toBe("dan-ince");
  });

  it("normal adds omit published_at so the default publishes now", () => {
    const row = speakerProfileInsertRow(
      { displayName: "Stephine Robinson", talkTitle: "Talk" },
      "stephine-robinson",
    );
    expect("published_at" in row).toBe(false);
    expect(row.profile_type).toBe("main_stage");
  });

  it("trims and caps the name and title", () => {
    const row = speakerProfileInsertRow(
      { displayName: `  ${"x".repeat(200)}  `, talkTitle: ` ${"t".repeat(300)} ` },
      "x",
    );
    expect((row.display_name as string).length).toBe(120);
    expect((row.talk_title as string).length).toBe(200);
  });
});
