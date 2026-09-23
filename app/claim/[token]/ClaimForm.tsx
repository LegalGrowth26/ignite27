"use client";

import { useActionState } from "react";
import { Button } from "@/components/Button";
import { claimCompAction, type ClaimFormState } from "./actions";

const INPUT =
  "w-full rounded-xl border border-ignite-line bg-ignite-white px-4 py-3 text-body text-ignite-ink focus:border-ignite-red focus:outline-none focus:ring-2 focus:ring-ignite-red/20";
const LABEL = "block text-small font-medium text-ignite-ink";

export function ClaimForm({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState<ClaimFormState, FormData>(
    claimCompAction.bind(null, token),
    { error: null, values: null },
  );
  const v = (key: string) => state.values?.[key] ?? "";

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {/* Honeypot: humans never see it; bots fill it. */}
      <div className="hidden" aria-hidden>
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="firstName" className={LABEL}>
            First name <span className="text-ignite-red">*</span>
          </label>
          <input
            id="firstName"
            name="firstName"
            required
            maxLength={100}
            defaultValue={v("firstName")}
            className={INPUT}
          />
        </div>
        <div>
          <label htmlFor="surname" className={LABEL}>
            Surname <span className="text-ignite-red">*</span>
          </label>
          <input
            id="surname"
            name="surname"
            required
            maxLength={100}
            defaultValue={v("surname")}
            className={INPUT}
          />
        </div>
      </div>

      <div>
        <label htmlFor="email" className={LABEL}>
          Email <span className="text-ignite-red">*</span>
        </label>
        <input
          id="email"
          name="email"
          inputMode="email"
          required
          maxLength={200}
          defaultValue={v("email")}
          className={INPUT}
        />
        <p className="mt-1 text-small text-ignite-muted">
          Your ticket confirmation lands here.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="mobile" className={LABEL}>
            Mobile (optional)
          </label>
          <input
            id="mobile"
            name="mobile"
            inputMode="tel"
            maxLength={50}
            defaultValue={v("mobile")}
            className={INPUT}
          />
        </div>
        <div>
          <label htmlFor="company" className={LABEL}>
            Company (optional)
          </label>
          <input
            id="company"
            name="company"
            maxLength={200}
            defaultValue={v("company")}
            className={INPUT}
          />
        </div>
        <div>
          <label htmlFor="jobTitle" className={LABEL}>
            Job title (optional)
          </label>
          <input
            id="jobTitle"
            name="jobTitle"
            maxLength={200}
            defaultValue={v("jobTitle")}
            className={INPUT}
          />
        </div>
      </div>

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          name="marketingOptIn"
          defaultChecked={state.values ? state.values.marketingOptIn === "on" : false}
          className="mt-1 h-4 w-4"
        />
        <span className="text-small text-ignite-ink">
          Keep me posted about IGNITE! events and useful marketing bits. No
          spam, unsubscribe any time.
        </span>
      </label>

      {state.error ? (
        <p className="rounded-xl border border-ignite-red/50 bg-ignite-red/5 p-3 text-small text-ignite-red">
          {state.error}
        </p>
      ) : null}

      <div>
        <Button variant="primary" size="lg" type="submit" disabled={isPending}>
          {isPending ? "Booking your place..." : "Claim my free ticket"}
        </Button>
      </div>
    </form>
  );
}
