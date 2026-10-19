"use client";

import { useActionState } from "react";
import { refundBookingAction, type RefundActionState } from "./actions";

const INPUT =
  "rounded-xl border border-ignite-line bg-ignite-white px-3 py-2 text-small text-ignite-ink focus:border-ignite-red focus:outline-none";

// Refund and cancel from the dashboard. Blank amount = full refund;
// a pounds amount makes it partial (e.g. minus Stripe fees per the
// refund policy). Also the healer for "refunded straight in Stripe":
// Stripe reports the charge as already refunded and the booking is
// marked to match.
export function RefundForm({ bookingId }: { bookingId: string }) {
  const [state, formAction, isPending] = useActionState<RefundActionState, FormData>(
    refundBookingAction.bind(null, bookingId),
    { error: null, ok: null },
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label
            htmlFor="amountPounds"
            className="block text-small font-medium text-ignite-ink"
          >
            Amount (£, blank = full refund)
          </label>
          <input
            id="amountPounds"
            name="amountPounds"
            inputMode="decimal"
            placeholder="Full amount"
            className={`${INPUT} w-36`}
          />
        </div>
      </div>
      <label className="flex items-start gap-3">
        <input type="checkbox" name="confirm" className="mt-1 h-4 w-4" />
        <span className="text-small text-ignite-ink">
          Refund this payment and cancel the booking. It drops out of
          revenue, headcount, lunch numbers and exports. If Stripe already
          refunded it, this just aligns our records.
        </span>
      </label>

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
          {isPending ? "Refunding..." : "Refund and cancel booking"}
        </button>
      </div>
    </form>
  );
}
