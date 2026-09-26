import { describe, expect, it } from "vitest";
import { validateAttendeeEdit } from "./attendee-edit";

const named = {
  firstName: "Priya",
  surname: "Shah",
  email: "Priya@Example.com",
  mobile: "",
  jobTitle: "Marketing lead",
  dietaryRequirement: "vegan",
  dietaryOther: "",
  fallbackEmail: "contact@company.example.com",
};

describe("validateAttendeeEdit", () => {
  it("a named attendee saves with a lowercased email and dietary", () => {
    const result = validateAttendeeEdit(named);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row).toMatchObject({
      first_name: "Priya",
      surname: "Shah",
      email: "priya@example.com",
      job_title: "Marketing lead",
      dietary_requirement: "vegan",
      dietary_other: null,
      mobile: null,
    });
  });

  it("TBC parks the slot on the contact's email, both directions", () => {
    const result = validateAttendeeEdit({ ...named, tbc: "on" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row).toMatchObject({
      first_name: "TBC",
      surname: "",
      email: "contact@company.example.com",
      dietary_requirement: "none",
    });
  });

  it("names and email are required unless TBC", () => {
    expect(validateAttendeeEdit({ ...named, firstName: "" }).ok).toBe(false);
    expect(validateAttendeeEdit({ ...named, surname: " " }).ok).toBe(false);
    expect(validateAttendeeEdit({ ...named, email: "not-an-email" }).ok).toBe(false);
  });

  it("dietary 'other' needs the detail; other options clear it", () => {
    expect(
      validateAttendeeEdit({ ...named, dietaryRequirement: "other", dietaryOther: "" }).ok,
    ).toBe(false);
    const withDetail = validateAttendeeEdit({
      ...named,
      dietaryRequirement: "other",
      dietaryOther: "No shellfish",
    });
    expect(withDetail.ok).toBe(true);
    if (withDetail.ok) expect(withDetail.row.dietary_other).toBe("No shellfish");
    const cleared = validateAttendeeEdit({ ...named, dietaryOther: "stale text" });
    if (cleared.ok) expect(cleared.row.dietary_other).toBeNull();
  });

  it("rejects unknown dietary values", () => {
    expect(validateAttendeeEdit({ ...named, dietaryRequirement: "astronaut" }).ok).toBe(false);
  });
});
