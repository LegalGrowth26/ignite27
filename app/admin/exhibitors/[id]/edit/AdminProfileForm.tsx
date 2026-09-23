"use client";

import { useActionState } from "react";
import {
  SOCIAL_PLATFORMS,
  SOCIAL_PLATFORM_LABELS,
  type SocialPlatform,
} from "@/lib/exhibitors/profile";
import type { EchoedValues } from "@/lib/admin/form-echo";
import {
  adminSaveExhibitorProfileAction,
  type AdminProfileFormState,
} from "../../actions";

const INPUT =
  "w-full rounded-xl border border-ignite-line bg-ignite-white px-4 py-3 text-body text-ignite-ink focus:border-ignite-red focus:outline-none focus:ring-2 focus:ring-ignite-red/20";
const LABEL = "block text-small font-medium text-ignite-ink";
const HELP = "mt-1 text-small text-ignite-muted";

export interface AdminProfileDefaults {
  slug: string;
  displayName: string;
  description: string;
  websiteUrl: string;
  socialUrls: Partial<Record<SocialPlatform, string>>;
  ctaPrimaryLabel: string;
  ctaPrimaryUrl: string;
  ctaSecondaryLabel: string;
  ctaSecondaryUrl: string;
  showContactEmail: boolean;
  contactEmail: string;
}

export function AdminProfileForm({
  bookingId,
  defaults,
}: {
  bookingId: string;
  defaults: AdminProfileDefaults;
}) {
  const [state, formAction, isPending] = useActionState<AdminProfileFormState, FormData>(
    adminSaveExhibitorProfileAction.bind(null, bookingId),
    { error: null, values: null },
  );
  // Echoed values from a failed save beat the stored defaults.
  const echoed: EchoedValues | null = state.values;
  const v = (key: keyof AdminProfileDefaults) =>
    (echoed?.[key] as string | undefined) ?? String(defaults[key] ?? "");

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div>
        <label htmlFor="slug" className={LABEL}>
          Slug (admin only)
        </label>
        <input
          id="slug"
          name="slug"
          defaultValue={v("slug")}
          maxLength={50}
          required
          className={`${INPUT} font-mono`}
        />
        <p className={HELP}>
          The page URL: /exhibitors/&lt;slug&gt;. Changing it breaks any link
          already shared to the old URL, so only change it for a company
          rename or a typo caught early.
        </p>
      </div>

      <div>
        <label htmlFor="displayName" className={LABEL}>
          Company name <span className="text-ignite-red">*</span>
        </label>
        <input
          id="displayName"
          name="displayName"
          defaultValue={v("displayName")}
          maxLength={120}
          required
          className={INPUT}
        />
      </div>

      <div>
        <label htmlFor="description" className={LABEL}>
          About the business
        </label>
        <textarea
          id="description"
          name="description"
          defaultValue={v("description")}
          maxLength={2000}
          rows={7}
          className={INPUT}
        />
      </div>

      <div>
        <label htmlFor="websiteUrl" className={LABEL}>
          Website
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

      <fieldset>
        <legend className={LABEL}>Social links</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {SOCIAL_PLATFORMS.map((platform) => (
            <div key={platform}>
              <label htmlFor={`social_${platform}`} className="block text-small text-ignite-muted">
                {SOCIAL_PLATFORM_LABELS[platform]}
              </label>
              <input
                id={`social_${platform}`}
                name={`social_${platform}`}
                defaultValue={echoed?.[`social_${platform}`] ?? defaults.socialUrls[platform] ?? ""}
                inputMode="url"
                placeholder="https://"
                className={INPUT}
              />
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className={LABEL}>Buttons (up to two)</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="ctaPrimaryLabel" className="block text-small text-ignite-muted">
              Button 1 label
            </label>
            <input
              id="ctaPrimaryLabel"
              name="ctaPrimaryLabel"
              defaultValue={v("ctaPrimaryLabel")}
              maxLength={40}
              className={INPUT}
            />
          </div>
          <div>
            <label htmlFor="ctaPrimaryUrl" className="block text-small text-ignite-muted">
              Button 1 link
            </label>
            <input
              id="ctaPrimaryUrl"
              name="ctaPrimaryUrl"
              defaultValue={v("ctaPrimaryUrl")}
              inputMode="url"
              placeholder="https://"
              className={INPUT}
            />
          </div>
          <div>
            <label htmlFor="ctaSecondaryLabel" className="block text-small text-ignite-muted">
              Button 2 label
            </label>
            <input
              id="ctaSecondaryLabel"
              name="ctaSecondaryLabel"
              defaultValue={v("ctaSecondaryLabel")}
              maxLength={40}
              className={INPUT}
            />
          </div>
          <div>
            <label htmlFor="ctaSecondaryUrl" className="block text-small text-ignite-muted">
              Button 2 link
            </label>
            <input
              id="ctaSecondaryUrl"
              name="ctaSecondaryUrl"
              defaultValue={v("ctaSecondaryUrl")}
              inputMode="url"
              placeholder="https://"
              className={INPUT}
            />
          </div>
        </div>
      </fieldset>

      <div className="rounded-2xl border border-ignite-line p-4">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="showContactEmail"
            defaultChecked={defaults.showContactEmail}
            className="mt-1 h-4 w-4"
          />
          <span className="text-body font-semibold text-ignite-ink">
            Show a contact email on the page
          </span>
        </label>
        <div className="mt-3">
          <label htmlFor="contactEmail" className="block text-small text-ignite-muted">
            Contact email
          </label>
          <input
            id="contactEmail"
            name="contactEmail"
            defaultValue={v("contactEmail")}
            inputMode="email"
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
          {isPending ? "Saving..." : "Save page"}
        </button>
      </div>
    </form>
  );
}
