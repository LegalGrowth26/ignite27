import { describe, expect, it } from "vitest";
import { interpretSpeakerSave } from "./save-result";

describe("interpretSpeakerSave", () => {
  it("a real save returns the row's slug", () => {
    expect(
      interpretSpeakerSave({ error: null, rows: [{ slug: "mike-wistow" }], fallbackSlug: "x" }),
    ).toEqual({ ok: true, slug: "mike-wistow" });
  });

  // Regression: the relinked-account case. RLS makes a broken
  // ownership link look like a zero-row update with NO error; that
  // must read as a loud failure, never as "Saved."
  it("zero rows under RLS is a LOUD failure, not success", () => {
    const outcome = interpretSpeakerSave({ error: null, rows: [], fallbackSlug: "x" });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error).toContain("did NOT save");
    expect(outcome.error).toContain("not linked to the account");
  });

  it("a database error surfaces its real reason", () => {
    const outcome = interpretSpeakerSave({
      error: { message: "permission denied for table speaker_profiles" },
      rows: null,
      fallbackSlug: "x",
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error).toContain("permission denied");
  });

  it("null rows without an error also fails loud (never trusts absence)", () => {
    expect(interpretSpeakerSave({ error: null, rows: null, fallbackSlug: "x" }).ok).toBe(false);
  });
});
