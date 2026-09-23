"use client";

import { useActionState } from "react";
import {
  PARTNER_CATEGORIES,
  PARTNER_STATUSES,
  PARTNER_TIERS,
  PARTNER_TIER_META,
} from "@/lib/partners/validate";
import type { EchoedValues } from "@/lib/admin/form-echo";
import { savePartnerAction, type PartnerFormState } from "./actions";

const INPUT =
  "w-full rounded-xl border border-ignite-line bg-ignite-white px-4 py-3 text-body text-ignite-ink focus:border-ignite-red focus:outline-none focus:ring-2 focus:ring-ignite-red/20";
const LABEL = "block text-small font-medium text-ignite-ink";
const HELP = "mt-1 text-small text-ignite-muted";

const STATUS_LABELS: Record<string, string> = {
  agreed: "Agreed (invoiced, awaiting payment)",
  paid: "Paid",
  ended: "Ended (off the site)",
};

export interface PartnerDefaults {
  companyName: string;
  contactName: string;
  contactEmail: string;
  tier: string;
  agreedPricePounds: string; // "" = standard tier price
  category: string;
  status: string;
  notes: string;
  websiteUrl: string;
  hasLogo: boolean;
}

export function PartnerForm({
  partnerId,
  defaults,
  submitLabel,
}: {
  partnerId: string | null;
  defaults: PartnerDefaults;
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState<PartnerFormState, FormData>(
    savePartnerAction.bind(null, partnerId),
    { error: null, clashWith: null, values: null },
  );
  // Echoed values (validation error or clash warning) beat defaults,
  // so the add-anyway resubmit carries everything already typed.
  const echoed: EchoedValues | null = state.values;
  const v = (key: keyof PartnerDefaults) =>
    (echoed?.[key] as string | undefined) ?? String(defaults[key] ?? "");

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="companyName" className={LABEL}>
            Company <span className="text-ignite-red">*</span>
          </label>
          <input
            id="companyName"
            name="companyName"
            defaultValue={v("companyName")}
            maxLength={200}
            required
            className={INPUT}
          />
        </div>
        <div>
          <label htmlFor="websiteUrl" className={LABEL}>
            Website (the strip links here)
          </label>
          <input
            id="websiteUrl"
            name="websiteUrl"
            defaultValue={v("websiteUrl")}
            inputMode="url"
            placeholder="https://"
            className={INPUT}
          />
        </div>
        <div>
          <label htmlFor="contactName" className={LABEL}>
            Contact name <span className="text-ignite-red">*</span>
          </label>
          <input
            id="contactName"
            name="contactName"
            defaultValue={v("contactName")}
            maxLength={120}
            required
            className={INPUT}
          />
        </div>
        <div>
          <label htmlFor="contactEmail" className={LABEL}>
            Contact email <span className="text-ignite-red">*</span>
          </label>
          <input
            id="contactEmail"
            name="contactEmail"
            defaultValue={v("contactEmail")}
            inputMode="email"
            maxLength={200}
            required
            className={INPUT}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="tier" className={LABEL}>
            Tier <span className="text-ignite-red">*</span>
          </label>
          <select id="tier" name="tier" defaultValue={v("tier")} className={INPUT}>
            {PARTNER_TIERS.map((t) => (
              <option key={t} value={t}>
                {PARTNER_TIER_META[t].label} (£
                {(PARTNER_TIER_META[t].standardPricePence / 100).toLocaleString("en-GB")})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="agreedPricePounds" className={LABEL}>
            Agreed price (£, ex VAT)
          </label>
          <input
            id="agreedPricePounds"
            name="agreedPricePounds"
            defaultValue={v("agreedPricePounds")}
            inputMode="decimal"
            placeholder="Standard tier price"
            className={INPUT}
          />
          <p className={HELP}>Blank = the tier&apos;s standard price. Real deals vary.</p>
        </div>
        <div>
          <label htmlFor="status" className={LABEL}>
            Status <span className="text-ignite-red">*</span>
          </label>
          <select id="status" name="status" defaultValue={v("status")} className={INPUT}>
            {PARTNER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="category" className={LABEL}>
            Category (exclusivity) <span className="text-ignite-red">*</span>
          </label>
          <select
            id="category"
            name="category"
            defaultValue={v("category")}
            className={INPUT}
          >
            {PARTNER_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="logo" className={LABEL}>
            Logo {defaults.hasLogo ? "(uploaded, choose a file to replace it)" : "(optional)"}
          </label>
          <input
            id="logo"
            name="logo"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="mt-1 w-full text-small"
          />
          <p className={HELP}>PNG, JPG, WebP, or SVG up to 2MB. Shown on the public strip.</p>
        </div>
      </div>

      <div>
        <label htmlFor="notes" className={LABEL}>
          Notes (admin only)
        </label>
        <textarea
          id="notes"
          name="notes"
          defaultValue={v("notes")}
          maxLength={2000}
          rows={3}
          className={INPUT}
        />
      </div>

      {state.clashWith ? (
        <div className="rounded-xl border-2 border-ignite-red bg-ignite-red/5 p-4">
          <p className="text-body font-semibold text-ignite-ink">
            Category clash: {state.clashWith} already holds this category.
          </p>
          <label className="mt-3 flex items-start gap-3">
            <input type="checkbox" name="confirmClash" className="mt-1 h-4 w-4" />
            <span className="text-body text-ignite-ink">
              Add anyway (I know about the exclusivity overlap)
            </span>
          </label>
          <p className="mt-2 text-small text-ignite-muted">
            Tick the box and submit again to save regardless.
          </p>
        </div>
      ) : null}

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
