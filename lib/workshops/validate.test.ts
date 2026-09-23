import { describe, expect, it } from "vitest";
import { WORKSHOP_ROOMS } from "./config";
import { validateWorkshopSchedule } from "./validate";

const valid = {
  speakerName: "Dan Ince",
  room: WORKSHOP_ROOMS[0],
  startsAt: "2027-01-21T10:00",
  endsAt: "2027-01-21T11:00",
};

describe("validateWorkshopSchedule", () => {
  it("accepts a full schedule and normalises optionals", () => {
    const result = validateWorkshopSchedule({ ...valid, speakerName: "  " });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.speakerName).toBeNull();
    expect(result.value.room).toBe("Workshop Room One");
    expect(result.value.startsAt?.toISOString()).toBe("2027-01-21T10:00:00.000Z");
  });

  it("accepts a fully unscheduled workshop (times and room TBC)", () => {
    const result = validateWorkshopSchedule({
      speakerName: "",
      room: "",
      startsAt: "",
      endsAt: "",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.room).toBeNull();
    expect(result.value.startsAt).toBeNull();
    expect(result.value.endsAt).toBeNull();
  });

  it("only accepts rooms from the fixed list", () => {
    expect(validateWorkshopSchedule({ ...valid, room: "Workshop Room Two" }).ok).toBe(true);
    expect(validateWorkshopSchedule({ ...valid, room: "Main hall" }).ok).toBe(false);
  });

  it("requires times as a pair", () => {
    expect(validateWorkshopSchedule({ ...valid, endsAt: "" }).ok).toBe(false);
    expect(validateWorkshopSchedule({ ...valid, startsAt: "" }).ok).toBe(false);
    expect(validateWorkshopSchedule({ ...valid, endsAt: "not-a-time" }).ok).toBe(false);
  });

  it("rejects end before or equal to start", () => {
    expect(validateWorkshopSchedule({ ...valid, endsAt: "2027-01-21T10:00" }).ok).toBe(false);
    expect(validateWorkshopSchedule({ ...valid, endsAt: "2027-01-21T09:00" }).ok).toBe(false);
  });
});
