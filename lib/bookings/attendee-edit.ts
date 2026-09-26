import { DIETARY_REQUIREMENTS, type DietaryRequirement } from "./intent";

// Attendee self-edit on multi-place bookings (exhibitor and partner
// packages): pure validation shared by the account action and
// unit-tested. TBC is a first-class state, both directions: name a
// slot when you know, put it back to TBC when plans change. These
// bookings always include lunch, so dietary is always collected for
// a named person.

export interface AttendeeEditRow {
  first_name: string;
  surname: string;
  email: string;
  mobile: string | null;
  job_title: string | null;
  dietary_requirement: DietaryRequirement;
  dietary_other: string | null;
}

export type AttendeeEditValidation =
  | { ok: true; row: AttendeeEditRow }
  | { ok: false; error: string };

const MAX_NAME = 100;
const MAX_EMAIL = 200;
const MAX_MOBILE = 50;
const MAX_JOB = 200;
const MAX_DIETARY_OTHER = 200;

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function validateAttendeeEdit(input: {
  tbc?: unknown;
  firstName?: unknown;
  surname?: unknown;
  email?: unknown;
  mobile?: unknown;
  jobTitle?: unknown;
  dietaryRequirement?: unknown;
  dietaryOther?: unknown;
  // Where the slot's mail goes while it is TBC (the booking contact).
  fallbackEmail: string;
}): AttendeeEditValidation {
  if (input.tbc === "on" || input.tbc === true) {
    return {
      ok: true,
      row: {
        first_name: "TBC",
        surname: "",
        email: input.fallbackEmail,
        mobile: null,
        job_title: null,
        dietary_requirement: "none",
        dietary_other: null,
      },
    };
  }

  const firstName = str(input.firstName);
  const surname = str(input.surname);
  if (!firstName || firstName.length > MAX_NAME) {
    return { ok: false, error: "We need their first name (or tick 'to be confirmed')." };
  }
  if (!surname || surname.length > MAX_NAME) {
    return { ok: false, error: "We need their surname (or tick 'to be confirmed')." };
  }

  const email = str(input.email).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > MAX_EMAIL) {
    return { ok: false, error: "That email does not look right." };
  }

  const mobile = str(input.mobile);
  if (mobile.length > MAX_MOBILE) {
    return { ok: false, error: "That mobile number is too long." };
  }
  const jobTitle = str(input.jobTitle);
  if (jobTitle.length > MAX_JOB) {
    return { ok: false, error: "That job title is too long." };
  }

  const dietary = str(input.dietaryRequirement) as DietaryRequirement;
  if (!DIETARY_REQUIREMENTS.includes(dietary)) {
    return { ok: false, error: "Pick a dietary option." };
  }
  let dietaryOther = str(input.dietaryOther);
  if (dietary === "other") {
    if (!dietaryOther || dietaryOther.length > MAX_DIETARY_OTHER) {
      return { ok: false, error: "Tell us briefly what to cater for." };
    }
  } else {
    dietaryOther = "";
  }

  return {
    ok: true,
    row: {
      first_name: firstName,
      surname,
      email,
      mobile: mobile || null,
      job_title: jobTitle || null,
      dietary_requirement: dietary,
      dietary_other: dietaryOther || null,
    },
  };
}
