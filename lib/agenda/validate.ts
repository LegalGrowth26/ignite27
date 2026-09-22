// Pure validation for the admin agenda-item form (main-stage running
// order). Mirrors the workshop form minus capacity.

export interface AgendaItemInput {
  title: string;
  description: string;
  speakerName: string | null;
  location: string | null;
  startsAt: Date;
  endsAt: Date;
}

export type AgendaItemValidation =
  | { ok: true; value: AgendaItemInput }
  | { ok: false; error: string };

const MAX_TITLE = 200;
const MAX_DESCRIPTION = 2000;
const MAX_SPEAKER = 120;
const MAX_LOCATION = 120;

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

// Same convention as the workshops form: UK wall-clock datetime-local
// values, January is GMT, server runs UTC.
function parseTime(value: unknown): Date | null {
  const raw = str(value);
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function validateAgendaItem(input: {
  title?: unknown;
  description?: unknown;
  speakerName?: unknown;
  location?: unknown;
  startsAt?: unknown;
  endsAt?: unknown;
}): AgendaItemValidation {
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

  const location = str(input.location);
  if (location.length > MAX_LOCATION) {
    return { ok: false, error: `Location is too long (max ${MAX_LOCATION} characters).` };
  }

  const startsAt = parseTime(input.startsAt);
  const endsAt = parseTime(input.endsAt);
  if (!startsAt || !endsAt) {
    return { ok: false, error: "Start and end times are both required." };
  }
  if (endsAt.getTime() <= startsAt.getTime()) {
    return { ok: false, error: "The end time must be after the start time." };
  }

  return {
    ok: true,
    value: {
      title,
      description,
      speakerName: speakerName || null,
      location: location || null,
      startsAt,
      endsAt,
    },
  };
}
