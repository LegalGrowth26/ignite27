"use client";

import { useActionState } from "react";
import { Button } from "@/components/Button";
import {
  SOCIAL_PLATFORMS,
  SOCIAL_PLATFORM_LABELS,
  type SocialPlatform,
} from "@/lib/exhibitors/profile";
import { saveExhibitorProfileAction, type ProfileFormState } from "./actions";

const INPUT =
  "w-full rounded-xl border border-ignite-line bg-ignite-white px-4 py-3 text-body text-ignite-ink focus:border-ignite-red focus:outline-none focus:ring-2 focus:ring-ignite-red/20";
const LABEL = "block text-small font-medium text-ignite-ink";
const HELP = "mt-1 text-small text-ignite-muted";

export interface ProfileDefaults {
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

export function ProfileForm({
  bookingId,
  defaults,
}: {
  bookingId: string;
  defaults: ProfileDefaults;
}) {
  const [state, formAction, isPending] = useActionState<ProfileFormState, FormData>(
    saveExhibitorProfileAction.bind(null, bookingId),
    { error: null },
  );

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div>
        <label htmlFor="displayName" className={LABEL}>
          Company name <span className="text-ignite-red">*</span>
        </label>
        <input
          id="displayName"
          name="displayName"
          defaultValue={defaults.displayName}
          maxLength={120}
          required
          className={INPUT}
        />
        <p className={HELP}>The headline on your page and how you appear in the exhibitor list.</p>
      </div>

      <div>
        <label htmlFor="description" className={LABEL}>
          About your business (optional)
        </label>
        <textarea
          id="description"
          name="description"
          defaultValue={defaults.description}
          maxLength={2000}
          rows={7}
          className={INPUT}
        />
        <p className={HELP}>
          Up to 2000 characters. What you do, who you help, and why delegates should stop
          at your stand. Blank lines start a new paragraph.
        </p>
      </div>

      <div>
        <label htmlFor="websiteUrl" className={LABEL}>
          Website (optional)
        </label>
        <input
          id="websiteUrl"
          name="websiteUrl"
          defaultValue={defaults.websiteUrl}
          inputMode="url"
          placeholder="https://"
          className={INPUT}
        />
        <p className={HELP}>A direct link from your page, good for you and your search rankings.</p>
      </div>

      <fieldset>
        <legend className={LABEL}>Social links (optional)</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {SOCIAL_PLATFORMS.map((platform) => (
            <div key={platform}>
              <label htmlFor={`social_${platform}`} className="block text-small text-ignite-muted">
                {SOCIAL_PLATFORM_LABELS[platform]}
              </label>
              <input
                id={`social_${platform}`}
                name={`social_${platform}`}
                defaultValue={defaults.socialUrls[platform] ?? ""}
                inputMode="url"
                placeholder="https://"
                className={INPUT}
              />
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className={LABEL}>Buttons (optional, up to two)</legend>
        <p className={HELP}>
          Send visitors somewhere useful: book a call, see your prices, grab a freebie.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="ctaPrimaryLabel" className="block text-small text-ignite-muted">
              Button 1 label
            </label>
            <input
              id="ctaPrimaryLabel"
              name="ctaPrimaryLabel"
              defaultValue={defaults.ctaPrimaryLabel}
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
              defaultValue={defaults.ctaPrimaryUrl}
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
              defaultValue={defaults.ctaSecondaryLabel}
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
              defaultValue={defaults.ctaSecondaryUrl}
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
          <span>
            <span className="block text-body font-semibold text-ignite-ink">
              Show a contact email on your page
            </span>
            <span className="block text-small text-ignite-muted">
              Shown publicly, so expect it to be found by more than delegates.
            </span>
          </span>
        </label>
        <div className="mt-3">
          <label htmlFor="contactEmail" className="block text-small text-ignite-muted">
            Contact email
          </label>
          <input
            id="contactEmail"
            name="contactEmail"
            defaultValue={defaults.contactEmail}
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
        <Button variant="primary" size="lg" type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Save your page"}
        </Button>
      </div>
    </form>
  );
}
