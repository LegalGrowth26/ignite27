"use client";

import { useActionState } from "react";
import type { WorkshopFormState } from "./actions";

const INPUT =
  "w-full rounded-xl border border-ignite-line bg-ignite-white px-4 py-3 text-body text-ignite-ink focus:border-ignite-red focus:outline-none focus:ring-2 focus:ring-ignite-red/20";
const LABEL = "block text-small font-medium text-ignite-ink";
const HELP = "mt-1 text-small text-ignite-muted";

export interface WorkshopDefaults {
  title: string;
  description: string;
  speakerName: string;
  room: string;
  startsAt: string; // datetime-local value (UK time)
  endsAt: string;
  capacity: string;
}

export function WorkshopForm({
  action,
  defaults,
  submitLabel,
}: {
  action: (prev: WorkshopFormState, formData: FormData) => Promise<WorkshopFormState>;
  defaults: WorkshopDefaults;
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState<WorkshopFormState, FormData>(
    action,
    { error: null },
  );

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div>
        <label htmlFor="title" className={LABEL}>
          Title <span className="text-ignite-red">*</span>
        </label>
        <input
          id="title"
          name="title"
          defaultValue={defaults.title}
          maxLength={200}
          required
          className={INPUT}
        />
      </div>

      <div>
        <label htmlFor="description" className={LABEL}>
          Description
        </label>
        <textarea
          id="description"
          name="description"
          defaultValue={defaults.description}
          maxLength={5000}
          rows={6}
          className={INPUT}
        />
        <p className={HELP}>Blank lines start a new paragraph on the public page.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="speakerName" className={LABEL}>
            Speaker (optional)
          </label>
          <input
            id="speakerName"
            name="speakerName"
            defaultValue={defaults.speakerName}
            maxLength={120}
            className={INPUT}
          />
        </div>
        <div>
          <label htmlFor="room" className={LABEL}>
            Room (optional)
          </label>
          <input
            id="room"
            name="room"
            defaultValue={defaults.room}
            maxLength={120}
            className={INPUT}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="startsAt" className={LABEL}>
            Starts (UK time) <span className="text-ignite-red">*</span>
          </label>
          <input
            id="startsAt"
            name="startsAt"
            type="datetime-local"
            defaultValue={defaults.startsAt}
            required
            className={INPUT}
          />
        </div>
        <div>
          <label htmlFor="endsAt" className={LABEL}>
            Ends (UK time) <span className="text-ignite-red">*</span>
          </label>
          <input
            id="endsAt"
            name="endsAt"
            type="datetime-local"
            defaultValue={defaults.endsAt}
            required
            className={INPUT}
          />
        </div>
        <div>
          <label htmlFor="capacity" className={LABEL}>
            Capacity <span className="text-ignite-red">*</span>
          </label>
          <input
            id="capacity"
            name="capacity"
            type="number"
            min={1}
            max={1000}
            defaultValue={defaults.capacity}
            required
            className={INPUT}
          />
        </div>
      </div>

      {state.error ? (
        <p className="rounded-xl border border-ignite-red/50 bg-ignite-red/5 p-3 text-small text-ignite-red">
          {state.error}
        </p>
      ) : null}

      <div>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-full bg-ignite-red px-6 py-3 text-body font-semibold text-ignite-white hover:bg-ignite-red/90 disabled:opacity-50"
        >
          {isPending ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
