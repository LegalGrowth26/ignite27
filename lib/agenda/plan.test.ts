import { describe, expect, it } from "vitest";
import { buildDayPlan, type PlanSourceItem } from "./plan";

const at = (h: number, m = 0) => new Date(Date.UTC(2027, 0, 21, h, m));

function item(
  id: string,
  title: string,
  startH: number,
  startM: number,
  endH: number,
  endM: number,
): PlanSourceItem {
  return {
    id,
    title,
    speakerName: null,
    location: null,
    startsAt: at(startH, startM),
    endsAt: at(endH, endM),
  };
}

describe("buildDayPlan", () => {
  const keynote = item("a1", "Opening keynote", 9, 30, 10, 30);
  const panel = item("a2", "Growth panel", 11, 0, 12, 0);
  const closing = item("a3", "Closing talk", 15, 0, 16, 0);

  it("merges talks and workshops in time order", () => {
    const workshop = item("w1", "AI workshop", 10, 30, 11, 0);
    const plan = buildDayPlan([panel, keynote, closing], [workshop]);
    expect(plan.map((e) => e.title)).toEqual([
      "Opening keynote",
      "AI workshop",
      "Growth panel",
      "Closing talk",
    ]);
    expect(plan.map((e) => e.kind)).toEqual([
      "main_stage",
      "workshop",
      "main_stage",
      "main_stage",
    ]);
  });

  it("flags a workshop that overlaps one talk: you'll miss part of it", () => {
    const workshop = item("w1", "Email workshop", 11, 30, 12, 30);
    const plan = buildDayPlan([keynote, panel], [workshop]);
    const entry = plan.find((e) => e.id === "w1")!;
    expect(entry.missedTalks).toEqual(["Growth panel"]);
  });

  it("flags every talk a long workshop overlaps, in running order", () => {
    const workshop = item("w1", "Deep dive", 10, 0, 15, 30);
    const plan = buildDayPlan([closing, keynote, panel], [workshop]);
    const entry = plan.find((e) => e.id === "w1")!;
    expect(entry.missedTalks).toEqual([
      "Opening keynote",
      "Growth panel",
      "Closing talk",
    ]);
  });

  it("back-to-back with a talk is not a miss", () => {
    const workshop = item("w1", "Social workshop", 10, 30, 11, 0);
    const plan = buildDayPlan([keynote, panel], [workshop]);
    expect(plan.find((e) => e.id === "w1")!.missedTalks).toEqual([]);
  });

  it("main-stage entries never carry warnings and sort first on ties", () => {
    const workshop = item("w1", "Tie workshop", 9, 30, 10, 0);
    const plan = buildDayPlan([keynote], [workshop]);
    expect(plan[0]!.kind).toBe("main_stage");
    expect(plan[0]!.missedTalks).toEqual([]);
    expect(plan[1]!.missedTalks).toEqual(["Opening keynote"]);
  });

  it("empty inputs produce an empty plan", () => {
    expect(buildDayPlan([], [])).toEqual([]);
  });
});
