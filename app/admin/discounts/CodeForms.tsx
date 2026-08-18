"use client";

import { useActionState, useState } from "react";
import {
  createCompCodeAction,
  createDiscountCodeAction,
  type CodeActionState,
} from "./actions";

const INPUT =
  "w-full rounded-xl border border-ignite-line bg-ignite-white px-3 py-2 text-small text-ignite-ink focus:border-ignite-red focus:outline-none";
const LABEL = "block text-small font-medium text-ignite-ink";

const IDLE: CodeActionState = { error: null, created: null };

export function CreateCodeForm() {
  const [state, formAction, isPending] = useActionState(createDiscountCodeAction, IDLE);
  const [kind, setKind] = useState<"percent" | "fixed">("percent");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <label htmlFor="code" className={LABEL}>
          Code <span className="text-ignite-red">*</span>
        </label>
        <input
          id="code"
          name="code"
          required
          placeholder="STEPHINE20"
          className={`${INPUT} uppercase`}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="kind" className={LABEL}>Type</label>
          <select
            id="kind"
            name="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value === "fixed" ? "fixed" : "percent")}
            className={INPUT}
          >
            <option value="percent">Percent off</option>
            <option value="fixed">Fixed £ off</option>
          </select>
        </div>
        {kind === "percent" ? (
          <div>
            <label htmlFor="percentOff" className={LABEL}>Percent off</label>
            <input
              id="percentOff"
              name="percentOff"
              type="number"
              min={1}
              max={100}
              placeholder="20"
              className={INPUT}
            />
          </div>
        ) : (
          <div>
            <label htmlFor="amountOffPounds" className={LABEL}>£ off (ex VAT)</label>
            <input
              id="amountOffPounds"
              name="amountOffPounds"
              type="number"
              min={0.01}
              step="0.01"
              placeholder="10.00"
              className={INPUT}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="expiresAt" className={LABEL}>Expiry date (optional)</label>
          <input id="expiresAt" name="expiresAt" type="date" className={INPUT} />
        </div>
        <div>
          <label htmlFor="maxRedemptions" className={LABEL}>Max uses (optional)</label>
          <input
            id="maxRedemptions"
            name="maxRedemptions"
            type="number"
            min={1}
            placeholder="unlimited"
            className={INPUT}
          />
        </div>
      </div>

      <div>
        <label htmlFor="appliesTo" className={LABEL}>Applies to</label>
        <select id="appliesTo" name="appliesTo" defaultValue="everything" className={INPUT}>
          <option value="everything">Everything (default)</option>
          <option value="delegates_only">Delegates only</option>
          <option value="vip_only">VIP only</option>
          <option value="exhibitors_only">Exhibitors only</option>
          <option value="everything_except_lunch">Everything except lunch</option>
        </select>
        <p className="mt-1 text-small text-ignite-muted">
          Restricted codes only discount the matching ticket line at
          checkout; the lunch add-on and other lines stay full price.
        </p>
      </div>

      <div>
        <label htmlFor="note" className={LABEL}>Note (optional, internal)</label>
        <input id="note" name="note" placeholder="e.g. Stephine's newsletter promo" className={INPUT} />
      </div>

      {state.error ? (
        <p className="rounded-xl border border-ignite-red/50 bg-ignite-red/5 p-3 text-small text-ignite-red">
          {state.error}
        </p>
      ) : null}
      {state.created ? (
        <p className="rounded-xl border border-ignite-line bg-ignite-cream p-3 text-small text-ignite-ink">
          Created <span className="font-mono font-semibold">{state.created}</span>. It is live immediately.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-full bg-ignite-red px-5 py-2 text-small font-semibold text-ignite-white disabled:opacity-50"
      >
        {isPending ? "Creating..." : "Create code"}
      </button>
    </form>
  );
}

export function CreateCompForm() {
  const [state, formAction, isPending] = useActionState(createCompCodeAction, IDLE);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <label htmlFor="compFor" className={LABEL}>Who is it for? (optional note)</label>
        <input id="compFor" name="compFor" placeholder="e.g. Jane Smith, headline speaker guest" className={INPUT} />
        <p className="mt-1 text-small text-ignite-muted">
          Creates a single-use 100%-off code named COMP-... that you can
          send them. Their booking lands with payment status comp.
        </p>
      </div>

      {state.error ? (
        <p className="rounded-xl border border-ignite-red/50 bg-ignite-red/5 p-3 text-small text-ignite-red">
          {state.error}
        </p>
      ) : null}
      {state.created ? (
        <p className="rounded-xl border border-ignite-line bg-ignite-cream p-3 text-small text-ignite-ink">
          Comp code <span className="font-mono font-semibold">{state.created}</span> created. Single use, 100% off.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-full border border-ignite-line bg-ignite-white px-5 py-2 text-small font-semibold text-ignite-ink hover:border-ignite-red disabled:opacity-50"
      >
        {isPending ? "Creating..." : "Create comp code"}
      </button>
    </form>
  );
}
