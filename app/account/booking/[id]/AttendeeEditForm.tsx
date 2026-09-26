"use client";

import { useActionState, useState } from "react";
import { DIETARY_REQUIREMENTS } from "@/lib/bookings/intent";
import { updateAttendeeAction, type AttendeeEditState } from "./actions";

const INPUT =
  "w-full rounded-xl border border-ignite-line bg-ignite-white px-3 py-2 text-small text-ignite-ink focus:border-ignite-red focus:outline-none";
const LABEL = "block text-small font-medium text-ignite-ink";

const DIETARY_LABELS: Record<string, string> = {
  none: "None",
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  gluten_free: "Gluten free",
  dairy_free: "Dairy free",
  nut_allergy: "Nut allergy",
  other: "Other",
};

export interface AttendeeEditDefaults {
  tbc: boolean;
  firstName: string;
  surname: string;
  email: string;
  mobile: string;
  jobTitle: string;
  dietaryRequirement: string;
  dietaryOther: string;
}

// Self-edit for one attendee slot on a multi-place booking. TBC both
// ways: tick it to park the slot, untick and fill in when you know.
export function AttendeeEditForm({
  bookingId,
  attendeeIndex,
  defaults,
}: {
  bookingId: string;
  attendeeIndex: number;
  defaults: AttendeeEditDefaults;
}) {
  const [state, formAction, isPending] = useActionState<AttendeeEditState, FormData>(
    updateAttendeeAction.bind(null, bookingId, attendeeIndex),
    { error: null, ok: null, values: null },
  );
  const v = (name: string, fallback: string) => state.values?.[name] ?? fallback;
  const [tbc, setTbc] = useState(
    state.values ? state.values.tbc === "on" : defaults.tbc,
  );
  const [dietary, setDietary] = useState(
    v("dietaryRequirement", defaults.dietaryRequirement) || "none",
  );

  return (
    <form action={formAction} className="mt-4 flex flex-col gap-3">
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          name="tbc"
          checked={tbc}
          onChange={(e) => setTbc(e.target.checked)}
          className="mt-1 h-4 w-4"
        />
        <span className="text-small text-ignite-ink">
          To be confirmed: we don&apos;t know who is coming yet
        </span>
      </label>

      {!tbc ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`firstName-${attendeeIndex}`} className={LABEL}>
                First name <span className="text-ignite-red">*</span>
              </label>
              <input
                id={`firstName-${attendeeIndex}`}
                name="firstName"
                maxLength={100}
                defaultValue={v("firstName", defaults.firstName)}
                className={INPUT}
              />
            </div>
            <div>
              <label htmlFor={`surname-${attendeeIndex}`} className={LABEL}>
                Surname <span className="text-ignite-red">*</span>
              </label>
              <input
                id={`surname-${attendeeIndex}`}
                name="surname"
                maxLength={100}
                defaultValue={v("surname", defaults.surname)}
                className={INPUT}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`email-${attendeeIndex}`} className={LABEL}>
                Email <span className="text-ignite-red">*</span>
              </label>
              <input
                id={`email-${attendeeIndex}`}
                name="email"
                inputMode="email"
                maxLength={200}
                defaultValue={v("email", defaults.email)}
                className={INPUT}
              />
            </div>
            <div>
              <label htmlFor={`mobile-${attendeeIndex}`} className={LABEL}>
                Mobile (optional)
              </label>
              <input
                id={`mobile-${attendeeIndex}`}
                name="mobile"
                inputMode="tel"
                maxLength={50}
                defaultValue={v("mobile", defaults.mobile)}
                className={INPUT}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor={`jobTitle-${attendeeIndex}`} className={LABEL}>
                Job title (optional)
              </label>
              <input
                id={`jobTitle-${attendeeIndex}`}
                name="jobTitle"
                maxLength={200}
                defaultValue={v("jobTitle", defaults.jobTitle)}
                className={INPUT}
              />
            </div>
            <div>
              <label htmlFor={`dietary-${attendeeIndex}`} className={LABEL}>
                Dietary (lunch is included)
              </label>
              <select
                id={`dietary-${attendeeIndex}`}
                name="dietaryRequirement"
                value={dietary}
                onChange={(e) => setDietary(e.target.value)}
                className={INPUT}
              >
                {DIETARY_REQUIREMENTS.map((d) => (
                  <option key={d} value={d}>
                    {DIETARY_LABELS[d]}
                  </option>
                ))}
              </select>
            </div>
            {dietary === "other" ? (
              <div>
                <label htmlFor={`dietaryOther-${attendeeIndex}`} className={LABEL}>
                  Tell us what to cater for
                </label>
                <input
                  id={`dietaryOther-${attendeeIndex}`}
                  name="dietaryOther"
                  maxLength={200}
                  defaultValue={v("dietaryOther", defaults.dietaryOther)}
                  className={INPUT}
                />
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      {state.error ? (
        <p className="rounded-xl border border-ignite-red/50 bg-ignite-red/5 p-3 text-small text-ignite-red">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="rounded-xl border border-ignite-line bg-ignite-cream p-3 text-small text-ignite-ink">
          {state.ok}
        </p>
      ) : null}

      <div>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-full bg-ignite-red px-5 py-2 text-small font-semibold text-ignite-white hover:bg-ignite-red/90 disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save this place"}
        </button>
      </div>
    </form>
  );
}
