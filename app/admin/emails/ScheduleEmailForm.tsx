"use client";

import { useActionState } from "react";
import {
  createScheduledEmailAction,
  testSendAction,
  type ScheduledEmailActionState,
} from "./actions";

const INPUT =
  "w-full rounded-xl border border-ignite-line bg-ignite-white px-3 py-2 text-small text-ignite-ink focus:border-ignite-red focus:outline-none";
const LABEL = "block text-small font-medium text-ignite-ink";

const IDLE: ScheduledEmailActionState = { error: null, ok: null };

// One form, two submit buttons: "Send test to me" posts the same
// fields to the test action (immediate, admin only); "Schedule" books
// the real send. formAction on the buttons routes between them.
export function ScheduleEmailForm() {
  const [scheduleState, scheduleAction, schedulePending] = useActionState(
    createScheduledEmailAction,
    IDLE,
  );
  const [testState, testAction, testPending] = useActionState(testSendAction, IDLE);

  return (
    <form className="flex flex-col gap-4">
      <div>
        <label htmlFor="subject" className={LABEL}>
          Subject <span className="text-ignite-red">*</span>
        </label>
        <input id="subject" name="subject" required maxLength={200} className={INPUT} />
      </div>
      <div>
        <label htmlFor="body" className={LABEL}>
          Body <span className="text-ignite-red">*</span>
        </label>
        <textarea id="body" name="body" required rows={8} className={INPUT} />
        <p className="mt-1 text-small text-ignite-muted">
          Plain paragraphs separated by a blank line. Bare links
          (https://...) become clickable automatically. It renders in the
          same branded frame as the booking confirmations.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="audience" className={LABEL}>Audience</label>
          <select id="audience" name="audience" className={INPUT}>
            <option value="all_attendees">All attendees</option>
            <option value="delegates">Delegates (includes comp guests)</option>
            <option value="vips">VIPs</option>
            <option value="exhibitors">Exhibitors (named attendees)</option>
          </select>
        </div>
        <div>
          <label htmlFor="sendAt" className={LABEL}>Send date and time (UK)</label>
          <input id="sendAt" name="sendAt" type="datetime-local" className={INPUT} />
          <p className="mt-1 text-small text-ignite-muted">
            Sends within about 5 minutes of this time.
          </p>
        </div>
      </div>

      {scheduleState.error || testState.error ? (
        <p className="rounded-xl border border-ignite-red/50 bg-ignite-red/5 p-3 text-small text-ignite-red">
          {scheduleState.error ?? testState.error}
        </p>
      ) : null}
      {scheduleState.ok || testState.ok ? (
        <p className="rounded-xl border border-ignite-line bg-ignite-cream p-3 text-small text-ignite-ink">
          {scheduleState.ok ?? testState.ok}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          formAction={testAction}
          disabled={testPending || schedulePending}
          className="rounded-full border border-ignite-line bg-ignite-white px-5 py-2 text-small font-semibold text-ignite-ink hover:border-ignite-red disabled:opacity-50"
        >
          {testPending ? "Sending test..." : "Send test to me"}
        </button>
        <button
          type="submit"
          formAction={scheduleAction}
          disabled={schedulePending || testPending}
          className="rounded-full bg-ignite-red px-5 py-2 text-small font-semibold text-ignite-white disabled:opacity-50"
        >
          {schedulePending ? "Scheduling..." : "Schedule send"}
        </button>
      </div>
    </form>
  );
}
