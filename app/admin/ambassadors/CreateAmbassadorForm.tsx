"use client";

import { useActionState } from "react";
import { createAmbassadorAction, type AmbassadorActionState } from "./actions";

const INPUT =
  "w-full rounded-xl border border-ignite-line bg-ignite-white px-3 py-2 text-small text-ignite-ink focus:border-ignite-red focus:outline-none";
const LABEL = "block text-small font-medium text-ignite-ink";

const IDLE: AmbassadorActionState = { error: null, created: null, values: null };

export function CreateAmbassadorForm() {
  const [state, formAction, isPending] = useActionState(createAmbassadorAction, IDLE);
  // Failed validation echoes typed values back (React 19 resets forms).
  const v = state.values ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="firstName" className={LABEL}>
            First name <span className="text-ignite-red">*</span>
          </label>
          <input id="firstName" name="firstName" required defaultValue={v.firstName ?? ""} className={INPUT} />
        </div>
        <div>
          <label htmlFor="surname" className={LABEL}>
            Surname <span className="text-ignite-red">*</span>
          </label>
          <input id="surname" name="surname" required defaultValue={v.surname ?? ""} className={INPUT} />
        </div>
        <div>
          <label htmlFor="email" className={LABEL}>
            Email <span className="text-ignite-red">*</span>
          </label>
          <input id="email" name="email" type="email" required defaultValue={v.email ?? ""} className={INPUT} />
        </div>
        <div>
          <label htmlFor="company" className={LABEL}>Company</label>
          <input id="company" name="company" defaultValue={v.company ?? ""} className={INPUT} />
        </div>
        <div>
          <label htmlFor="type" className={LABEL}>Type</label>
          <select id="type" name="type" defaultValue={v.type ?? "speaker"} className={INPUT}>
            <option value="speaker">Speaker</option>
            <option value="partner">Partner</option>
          </select>
        </div>
        <div>
          <label htmlFor="slug" className={LABEL}>
            Link slug <span className="text-ignite-red">*</span>
          </label>
          <input
            id="slug"
            name="slug"
            required
            placeholder="stephine"
            defaultValue={v.slug ?? ""}
            className={`${INPUT} lowercase`}
          />
          <p className="mt-1 text-small text-ignite-muted">
            Their link becomes ignite27.co.uk/?ref=slug
          </p>
        </div>
        <div>
          <label htmlFor="compAllowance" className={LABEL}>Comp ticket allowance</label>
          <input
            id="compAllowance"
            name="compAllowance"
            type="number"
            min={0}
            defaultValue={v.compAllowance ?? 0}
            className={INPUT}
          />
        </div>
        <div>
          <label htmlFor="discountPercent" className={LABEL}>Personal discount % (optional)</label>
          <input
            id="discountPercent"
            name="discountPercent"
            type="number"
            min={1}
            max={100}
            placeholder="none"
            defaultValue={v.discountPercent ?? ""}
            className={INPUT}
          />
          <p className="mt-1 text-small text-ignite-muted">
            Recorded now; their personal code goes live in phase 2.
          </p>
        </div>
      </div>

      {state.error ? (
        <p className="rounded-xl border border-ignite-red/50 bg-ignite-red/5 p-3 text-small text-ignite-red">
          {state.error}
        </p>
      ) : null}
      {state.created ? (
        <p className="rounded-xl border border-ignite-line bg-ignite-cream p-3 text-small text-ignite-ink">
          Ambassador created with link slug{" "}
          <span className="font-mono font-semibold">{state.created}</span>. Their
          invite email is on its way.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-full bg-ignite-red px-5 py-2 text-small font-semibold text-ignite-white disabled:opacity-50"
      >
        {isPending ? "Creating..." : "Add ambassador"}
      </button>
    </form>
  );
}
