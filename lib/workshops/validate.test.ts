import { describe, expect, it } from "vitest";
import { validateWorkshop } from "./validate";

const valid = {
  title: "Practical AI for small teams",
  description: "Hands-on session.",
  speakerName: "Stephine Robinson",
  room: "Workshop room 1",
  startsAt: "2027-01-21T10:00",
  endsAt: "2027-01-21T11:00",
  capacity: "30",
};

describe("validateWorkshop", () => {
  it("accepts a full workshop and normalises optionals", () => {
    const result = validateWorkshop({ ...valid, speakerName: "", room: "  " });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.speakerName).toBeNull();
    expect(result.value.room).toBeNull();
    expect(result.value.capacity).toBe(30);
    expect(result.value.startsAt.toISOString()).toBe("2027-01-21T10:00:00.000Z");
  });

  it("requires a title and both times", () => {
    expect(validateWorkshop({ ...valid, title: "" }).ok).toBe(false);
    expect(validateWorkshop({ ...valid, startsAt: "" }).ok).toBe(false);
    expect(validateWorkshop({ ...valid, endsAt: "not-a-time" }).ok).toBe(false);
  });

  it("rejects end before or equal to start", () => {
    expect(validateWorkshop({ ...valid, endsAt: "2027-01-21T10:00" }).ok).toBe(false);
    expect(validateWorkshop({ ...valid, endsAt: "2027-01-21T09:00" }).ok).toBe(false);
  });

  it("bounds capacity to 1..1000 whole numbers", () => {
    expect(validateWorkshop({ ...valid, capacity: "0" }).ok).toBe(false);
    expect(validateWorkshop({ ...valid, capacity: "1001" }).ok).toBe(false);
    expect(validateWorkshop({ ...valid, capacity: "abc" }).ok).toBe(false);
    expect(validateWorkshop({ ...valid, capacity: "1" }).ok).toBe(true);
  });
});
