"use client";

import { useActionState } from "react";
import type { EchoedValues } from "@/lib/admin/form-echo";
import type { WorkshopFormState } from "./actions";

const INPUT =
  "w-full rounded-xl border border-ignite-line bg-ignite-white px-4 py-3 text-body text-ignite-ink focus:border-ignite-red focus:outline-none focus:ring-2 focus:ring-ignite-red/20";
const LABEL = "block text-small font-medium text-ignite-ink";
const HELP = "mt-1 text-small text-ignite-muted";

export interface ScheduleDefaults {
  speakerName: string;
  hostProfileId: string; // "" = no linked host
  room: string; // "" = not scheduled yet
  startsAt: string; // datetime-local value (UK time), "" = TBC
  endsAt: string;
}

export interface HostOption {
  id: string;
  name: string;
}

// Schedule only: the workshop's title and description belong to the
// host (edited from their /speaker page, synced automatically), and
// capacity is fixed at 24 everywhere. The admin sets the room and
// times here; a published workshop shows "time and room to be
// confirmed" until they are.
export function WorkshopScheduleForm({
  action,
  defaults,
  rooms,
  hostOptions,
}: {
  action: (prev: WorkshopFormState, formData: FormData) => Promise<WorkshopFormState>;
  defaults: ScheduleDefaults;
  rooms: readonly string[];
  hostOptions: HostOption[];
}) {
  const [state, formAction, isPending] = useActionState<WorkshopFormState, FormData>(
    action,
    { error: null, values: null },
  );
  // Failed validation echoes typed values back; they win over defaults
  // so nothing the admin entered is lost to React 19's form reset.
  const echoed: EchoedValues | null = state.values;
  const v = (key: keyof ScheduleDefaults) => echoed?.[key] ?? defaults[key];

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="hostProfileId" className={LABEL}>
            Host (linked profile)
          </label>
          <select
            id="hostProfileId"
            name="hostProfileId"
            defaultValue={v("hostProfileId")}
            className={INPUT}
          >
            <option value="">No linked host</option>
            {hostOptions.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
          <p className={HELP}>
            Workshop-host and both-type profiles only. The workshop shows
            and links their page.
          </p>
        </div>
        <div>
          <label htmlFor="speakerName" className={LABEL}>
            Host name (fallback)
          </label>
          <input
            id="speakerName"
            name="speakerName"
            defaultValue={v("speakerName")}
            maxLength={120}
            className={INPUT}
          />
          <p className={HELP}>Shown only when no linked host is set.</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="room" className={LABEL}>
            Room
          </label>
          <select id="room" name="room" defaultValue={v("room")} className={INPUT}>
            <option value="">To be confirmed</option>
            {rooms.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="startsAt" className={LABEL}>
            Starts (UK time)
          </label>
          <input
            id="startsAt"
            name="startsAt"
            type="datetime-local"
            defaultValue={v("startsAt")}
            className={INPUT}
          />
        </div>
        <div>
          <label htmlFor="endsAt" className={LABEL}>
            Ends (UK time)
          </label>
          <input
            id="endsAt"
            name="endsAt"
            type="datetime-local"
            defaultValue={v("endsAt")}
            className={INPUT}
          />
        </div>
      </div>
      <p className={HELP}>
        Leave the times blank while the slot is undecided; the public page
        says &quot;time and room to be confirmed&quot;. Set both together when
        scheduling. Event day is Thursday 21 January 2027.
      </p>

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
          {isPending ? "Saving..." : "Save schedule"}
        </button>
      </div>
    </form>
  );
}
