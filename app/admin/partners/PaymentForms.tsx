"use client";

import { useActionState } from "react";
import {
  cancelPaymentRequestAction,
  resendPaymentRequestAction,
  sendPaymentRequestAction,
  type PaymentRequestFormState,
} from "./actions";

const INPUT =
  "rounded-xl border border-ignite-line bg-ignite-white px-3 py-2 text-small text-ignite-ink focus:border-ignite-red focus:outline-none";

// "Send payment request": amount defaults to the remaining balance
// (editable per send). Every send snapshots its own amount, so an
// edited agreed price never changes a link already in an inbox.
export function SendPaymentRequestForm({
  partnerId,
  defaultAmountPounds,
  vatPreviewNote,
}: {
  partnerId: string;
  defaultAmountPounds: string;
  vatPreviewNote: string;
}) {
  const [state, formAction, isPending] = useActionState<PaymentRequestFormState, FormData>(
    sendPaymentRequestAction.bind(null, partnerId),
    { error: null, ok: null, values: null },
  );

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div>
        <label htmlFor="amountPounds" className="block text-small font-medium text-ignite-ink">
          Amount (£, ex VAT)
        </label>
        <input
          id="amountPounds"
          name="amountPounds"
          inputMode="decimal"
          defaultValue={state.values?.amountPounds ?? defaultAmountPounds}
          className={`${INPUT} w-36`}
        />
        <p className="mt-1 text-small text-ignite-muted">{vatPreviewNote}</p>
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-full bg-ignite-red px-5 py-2 text-small font-semibold text-ignite-white hover:bg-ignite-red/90 disabled:opacity-50"
      >
        {isPending ? "Sending..." : "Send payment request"}
      </button>
      {state.error ? (
        <p className="w-full rounded-xl border border-ignite-red/50 bg-ignite-red/5 p-3 text-small text-ignite-red">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="w-full rounded-xl border border-ignite-line bg-ignite-cream p-3 text-small text-ignite-ink">
          {state.ok}
        </p>
      ) : null}
    </form>
  );
}

export function ResendPaymentRequestButton({ requestId }: { requestId: string }) {
  return (
    <form action={resendPaymentRequestAction.bind(null, requestId)}>
      <button
        type="submit"
        className="rounded-full border border-ignite-line px-4 py-1.5 text-small font-semibold text-ignite-ink hover:border-ignite-red"
      >
        Resend
      </button>
    </form>
  );
}

export function CancelPaymentRequestButton({ requestId }: { requestId: string }) {
  return (
    <form action={cancelPaymentRequestAction.bind(null, requestId)}>
      <button
        type="submit"
        className="rounded-full border border-ignite-line px-4 py-1.5 text-small font-semibold text-ignite-muted hover:border-ignite-red hover:text-ignite-red"
      >
        Cancel link
      </button>
    </form>
  );
}
