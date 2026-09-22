// Pure validation for the admin workshop form, shared by create and
// edit actions and unit-tested without a database.

export interface WorkshopInput {
  title: string;
  description: string;
  speakerName: string | null;
  room: string | null;
  startsAt: Date;
  endsAt: Date;
  capacity: number;
}

export type WorkshopValidation =
  | { ok: true; value: WorkshopInput }
  | { ok: false; error: string };

const MAX_TITLE = 200;
const MAX_DESCRIPTION = 5000;
const MAX_SPEAKER = 120;
const MAX_ROOM = 120;

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

export function validateWorkshop(input: {
  title?: unknown;
  description?: unknown;
  speakerName?: unknown;
  room?: unknown;
  startsAt?: unknown;
  endsAt?: unknown;
  capacity?: unknown;
}): WorkshopValidation {
  const title = str(input.title);
  if (!title || title.length > MAX_TITLE) {
    return { ok: false, error: `Title is required (max ${MAX_TITLE} characters).` };
  }

  const description = str(input.description);
  if (description.length > MAX_DESCRIPTION) {
    return { ok: false, error: `Description is too long (max ${MAX_DESCRIPTION} characters).` };
  }

  const speakerName = str(input.speakerName);
  if (speakerName.length > MAX_SPEAKER) {
    return { ok: false, error: `Speaker name is too long (max ${MAX_SPEAKER} characters).` };
  }

  const room = str(input.room);
  if (room.length > MAX_ROOM) {
    return { ok: false, error: `Room is too long (max ${MAX_ROOM} characters).` };
  }

  const startsAt = parseTime(input.startsAt);
  const endsAt = parseTime(input.endsAt);
  if (!startsAt || !endsAt) {
    return { ok: false, error: "Start and end times are both required." };
  }
  if (endsAt.getTime() <= startsAt.getTime()) {
    return { ok: false, error: "The end time must be after the start time." };
  }

  const capacityRaw = str(input.capacity);
  const capacity = Number.parseInt(capacityRaw, 10);
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 1000) {
    return { ok: false, error: "Capacity must be a whole number between 1 and 1000." };
  }

  return {
    ok: true,
    value: {
      title,
      description,
      speakerName: speakerName || null,
      room: room || null,
      startsAt,
      endsAt,
      capacity,
    },
  };
}
