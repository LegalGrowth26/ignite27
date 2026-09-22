"use client";

import { useActionState } from "react";
import {
  SOCIAL_PLATFORMS,
  SOCIAL_PLATFORM_LABELS,
  type SocialPlatform,
} from "@/lib/exhibitors/profile";
import { adminSaveSpeakerAction, type SpeakerAdminFormState } from "../../actions";

const INPUT =
  "w-full rounded-xl border border-ignite-line bg-ignite-white px-4 py-3 text-body text-ignite-ink focus:border-ignite-red focus:outline-none focus:ring-2 focus:ring-ignite-red/20";
const LABEL = "block text-small font-medium text-ignite-ink";
const HELP = "mt-1 text-small text-ignite-muted";

export interface AdminSpeakerDefaults {
  slug: string;
  displayName: string;
  bio: string;
  talkTitle: string;
  talkDescription: string;
  talkTakeaways: string;
  websiteUrl: string;
  socialUrls: Partial<Record<SocialPlatform, string>>;
  ctaLabel: string;
  ctaUrl: string;
  enquiriesEmail: string;
}

export function AdminSpeakerEditForm({
  profileId,
  defaults,
}: {
  profileId: string;
  defaults: AdminSpeakerDefaults;
}) {
  const [state, formAction, isPending] = useActionState<SpeakerAdminFormState, FormData>(
    adminSaveSpeakerAction.bind(null, profileId),
    { error: null },
  );

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div>
        <label htmlFor="slug" className={LABEL}>
          Slug (admin only)
        </label>
        <input
          id="slug"
          name="slug"
          defaultValue={defaults.slug}
          maxLength={50}
          required
          className={`${INPUT} font-mono`}
        />
        <p className={HELP}>
          The page URL: /speakers/&lt;slug&gt;. Changing it breaks links already
          shared to the old URL.
        </p>
      </div>

      <div>
        <label htmlFor="displayName" className={LABEL}>
          Name <span className="text-ignite-red">*</span>
        </label>
        <input
          id="displayName"
          name="displayName"
          defaultValue={defaults.displayName}
          maxLength={120}
          required
          className={INPUT}
        />
      </div>

      <div>
        <label htmlFor="bio" className={LABEL}>
          Bio
        </label>
        <textarea
          id="bio"
          name="bio"
          defaultValue={defaults.bio}
          maxLength={2000}
          rows={5}
          className={INPUT}
        />
      </div>

      <div className="grid gap-3">
        <div>
          <label htmlFor="talkTitle" className={LABEL}>
            Talk title
          </label>
          <input
            id="talkTitle"
            name="talkTitle"
            defaultValue={defaults.talkTitle}
            maxLength={200}
            className={INPUT}
          />
        </div>
        <div>
          <label htmlFor="talkDescription" className={LABEL}>
            Talk description
          </label>
          <textarea
            id="talkDescription"
            name="talkDescription"
            defaultValue={defaults.talkDescription}
            maxLength={2000}
            rows={5}
            className={INPUT}
          />
        </div>
        <div>
          <label htmlFor="talkTakeaways" className={LABEL}>
            What people will learn (one per line, up to 6)
          </label>
          <textarea
            id="talkTakeaways"
            name="talkTakeaways"
            defaultValue={defaults.talkTakeaways}
            rows={4}
            className={INPUT}
          />
        </div>
      </div>

      <div>
        <label htmlFor="websiteUrl" className={LABEL}>
          Website
        </label>
        <input
          id="websiteUrl"
          name="websiteUrl"
          defaultValue={defaults.websiteUrl}
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
                defaultValue={defaults.socialUrls[platform] ?? ""}
                inputMode="url"
                placeholder="https://"
                className={INPUT}
              />
            </div>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="ctaLabel" className={LABEL}>
            Button label
          </label>
          <input
            id="ctaLabel"
            name="ctaLabel"
            defaultValue={defaults.ctaLabel}
            maxLength={40}
            className={INPUT}
          />
        </div>
        <div>
          <label htmlFor="ctaUrl" className={LABEL}>
            Button link
          </label>
          <input
            id="ctaUrl"
            name="ctaUrl"
            defaultValue={defaults.ctaUrl}
            inputMode="url"
            placeholder="https://"
            className={INPUT}
          />
        </div>
      </div>

      <div>
        <label htmlFor="enquiriesEmail" className={LABEL}>
          Enquiries email (never rendered publicly)
        </label>
        <input
          id="enquiriesEmail"
          name="enquiriesEmail"
          defaultValue={defaults.enquiriesEmail}
          inputMode="email"
          className={INPUT}
        />
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
