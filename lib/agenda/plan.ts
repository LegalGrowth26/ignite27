import { timesOverlap } from "@/lib/workshops/access";

// The /my-day plan: published main-stage agenda items (shown to
// everyone) merged with the caller's booked workshops, in time order,
// with an honest warning on every workshop that overlaps a talk:
// "You'll miss part of X". Pure and unit-tested; the page just renders
// what this returns.

export interface PlanSourceItem {
  id: string;
  title: string;
  speakerName: string | null;
  location: string | null;
  startsAt: Date;
  endsAt: Date;
}

export interface PlanEntry extends PlanSourceItem {
  kind: "main_stage" | "workshop";
  // Workshop entries only: titles of main-stage items this workshop
  // overlaps, in running order.
  missedTalks: string[];
}

export function buildDayPlan(
  agendaItems: readonly PlanSourceItem[],
  bookedWorkshops: readonly PlanSourceItem[],
): PlanEntry[] {
  const agenda = [...agendaItems].sort(
    (a, b) => a.startsAt.getTime() - b.startsAt.getTime(),
  );

  const entries: PlanEntry[] = [
    ...agenda.map(
      (item): PlanEntry => ({ ...item, kind: "main_stage", missedTalks: [] }),
    ),
    ...bookedWorkshops.map(
      (w): PlanEntry => ({
        ...w,
        kind: "workshop",
        missedTalks: agenda
          .filter((item) =>
            timesOverlap(w.startsAt, w.endsAt, item.startsAt, item.endsAt),
          )
          .map((item) => item.title),
      }),
    ),
  ];

  // Time order; when a workshop and a talk start together, the talk
  // reads first (it is the backdrop the workshop pulls you out of).
  return entries.sort((a, b) => {
    const byStart = a.startsAt.getTime() - b.startsAt.getTime();
    if (byStart !== 0) return byStart;
    if (a.kind !== b.kind) return a.kind === "main_stage" ? -1 : 1;
    return a.title.localeCompare(b.title, "en-GB");
  });
}
