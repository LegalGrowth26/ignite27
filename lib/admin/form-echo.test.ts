import { describe, expect, it } from "vitest";
import { echoedChecked, echoFormValues } from "./form-echo";

describe("echoFormValues", () => {
  it("round-trips every string field so failed validation loses nothing", () => {
    const fd = new FormData();
    fd.set("headline", "Big news!");
    fd.set("body", "Everything the admin typed.");
    fd.set("linkUrl", "not-a-url");
    fd.set("file", new Blob(["x"]), "logo.png"); // files cannot be echoed
    const values = echoFormValues(fd);
    expect(values).toEqual({
      headline: "Big news!",
      body: "Everything the admin typed.",
      linkUrl: "not-a-url",
    });
  });
});

describe("echoedChecked", () => {
  it("uses the fallback before any submit, and the echo after one", () => {
    expect(echoedChecked(null, "visible", true)).toBe(true);
    expect(echoedChecked({ visible: "on" }, "visible", false)).toBe(true);
    expect(echoedChecked({}, "visible", true)).toBe(false);
  });
});
