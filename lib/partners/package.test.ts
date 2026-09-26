import { describe, expect, it } from "vitest";
import { buildPartnerAttendeeRows, PARTNER_PACKAGE_PLACES } from "./package";

describe("buildPartnerAttendeeRows", () => {
  const rows = buildPartnerAttendeeRows({
    bookingId: "b1",
    appUserId: "u1",
    companyName: "Impact",
    contactName: "Oliver Smith",
    contactEmail: "oliver@impact.example.com",
  });

  it("creates exactly the package's places", () => {
    expect(rows).toHaveLength(PARTNER_PACKAGE_PLACES);
  });

  it("slot 1 is the contact, primary, linked to their account", () => {
    expect(rows[0]).toMatchObject({
      first_name: "Oliver",
      surname: "Smith",
      email: "oliver@impact.example.com",
      user_id: "u1",
      is_primary_contact: true,
      attendee_index: 1,
    });
  });

  it("slot 2 starts TBC under the exhibitor conventions", () => {
    expect(rows[1]).toMatchObject({
      first_name: "TBC",
      surname: "",
      email: "oliver@impact.example.com",
      user_id: null,
      is_primary_contact: false,
      dietary_requirement: "none",
      attendee_index: 2,
    });
  });

  it("BOTH places always carry lunch (the whole point of the package)", () => {
    for (const row of rows) expect(row.lunch_entitlement).toBe(true);
  });
});
