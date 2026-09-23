// Pure validation for the admin workshop SCHEDULE form, shared by the
// edit action and unit-tested without a database. Content (title,
// description) belongs to the host and never passes through here;
// capacity is the fixed WORKSHOP_CAPACITY constant, not a field.

import { WORKSHOP_ROOMS } from "./config";

export interface WorkshopScheduleInput {
  speakerName: string | null;
  room: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
}

export type WorkshopScheduleValidation =
  | { ok: true; value: WorkshopScheduleInput }
  | { ok: false; error: string };

const MAX_SPEAKER = 120;

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

// Times arrive as datetime-local strings entered as UK wall-clock time.
// The event is in January (GMT), and the server runs UTC, so new Date()
// on the raw string yields the right instant (same convention as the
// scheduled-emails form).
function parseTime(value: unknown): Date | null {
  const raw = str(value);
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function validateWorkshopSchedule(input: {
  speakerName?: unknown;
  room?: unknown;
  startsAt?: unknown;
  endsAt?: unknown;
}): WorkshopScheduleValidation {
  const speakerName = str(input.speakerName);
  if (speakerName.length > MAX_SPEAKER) {
    return { ok: false, error: `Speaker name is too long (max ${MAX_SPEAKER} characters).` };
  }

  const room = str(input.room);
  if (room && !(WORKSHOP_ROOMS as readonly string[]).includes(room)) {
    return { ok: false, error: "Pick a room from the list, or leave it unscheduled." };
  }

  const startsRaw = str(input.startsAt);
  const endsRaw = str(input.endsAt);
  if ((startsRaw && !endsRaw) || (!startsRaw && endsRaw)) {
    return { ok: false, error: "Set both the start and end time, or neither." };
  }
  const startsAt = parseTime(input.startsAt);
  const endsAt = parseTime(input.endsAt);
  if (startsRaw && (!startsAt || !endsAt)) {
    return { ok: false, error: "Those times do not look right." };
  }
  if (startsAt && endsAt && endsAt.getTime() <= startsAt.getTime()) {
    return { ok: false, error: "The end time must be after the start time." };
  }

  return {
    ok: true,
    value: {
      speakerName: speakerName || null,
      room: room || null,
      startsAt,
      endsAt,
    },
  };
}
