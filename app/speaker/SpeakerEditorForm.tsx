"use client";

import { useActionState } from "react";
import { Button } from "@/components/Button";
import {
  SOCIAL_PLATFORMS,
  SOCIAL_PLATFORM_LABELS,
  type SocialPlatform,
} from "@/lib/exhibitors/profile";
import { hostsWorkshops, type SpeakerProfileType } from "@/lib/speakers/profile";
import { saveSpeakerProfileAction, type SpeakerEditorState } from "./actions";

const INPUT =
  "w-full rounded-xl border border-ignite-line bg-ignite-white px-4 py-3 text-body text-ignite-ink focus:border-ignite-red focus:outline-none focus:ring-2 focus:ring-ignite-red/20";
const LABEL = "block text-small font-medium text-ignite-ink";
const HELP = "mt-1 text-small text-ignite-muted";

export interface SpeakerEditorDefaults {
  displayName: string;
  hasPhoto: boolean;
  hasLogo: boolean;
  bio: string;
  talkTitle: string;
  talkDescription: string;
  talkTakeaways: string; // one bullet per line
  websiteUrl: string;
  socialUrls: Partial<Record<SocialPlatform, string>>;
  ctaLabel: string;
  ctaUrl: string;
  enquiriesEmail: string;
}

export function SpeakerEditorForm({
  defaults,
  profileType,
}: {
  defaults: SpeakerEditorDefaults;
  // Everyone edits the session fields. For a workshop host they ARE
  // the workshop (synced to /workshops on save), so the labels talk
  // about the workshop; for main-stage (and both) they are the talk.
  profileType: SpeakerProfileType;
}) {
  const [state, formAction, isPending] = useActionState<SpeakerEditorState, FormData>(
    saveSpeakerProfileAction,
    { error: null, values: null },
  );
  // A failed save echoes typed values back; they win over the stored
  // defaults so React 19's form reset never wipes work (file pickers
  // cannot be echoed; everything text comes back).
  const v = (name: string, fallback: string) => state.values?.[name] ?? fallback;
  const isHost = hostsWorkshops(profileType);
  const workshopLabels = profileType === "workshop_host";

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div>
        <label htmlFor="displayName" className={LABEL}>
          Your name <span className="text-ignite-red">*</span>
        </label>
        <input
          id="displayName"
          name="displayName"
          defaultValue={v("displayName", defaults.displayName)}
          maxLength={120}
          required
          className={INPUT}
        />
      </div>

      <div>
        <label htmlFor="photo" className={LABEL}>
          Photo {defaults.hasPhoto ? "(already uploaded, choose a file to replace it)" : "(optional)"}
        </label>
        <input
          id="photo"
          name="photo"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="mt-1 w-full text-small"
        />
        <p className={HELP}>JPG, PNG, or WebP up to 2MB. Square crops look best.</p>
      </div>

      <div>
        <label htmlFor="bio" className={LABEL}>
          Bio (optional)
        </label>
        <textarea
          id="bio"
          name="bio"
          defaultValue={v("bio", defaults.bio)}
          maxLength={2000}
          rows={5}
          className={INPUT}
        />
        <p className={HELP}>Blank lines start a new paragraph.</p>
      </div>

      {isHost ? (
        <div>
          <label htmlFor="logo" className={LABEL}>
            Your logo {defaults.hasLogo ? "(already uploaded, choose a file to replace it)" : "(optional)"}
          </label>
          <input
            id="logo"
            name="logo"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="mt-1 w-full text-small"
          />
          <p className={HELP}>JPG, PNG, or WebP up to 2MB. Shown on your page.</p>
        </div>
      ) : null}

      <fieldset className="rounded-2xl border border-ignite-line p-4">
        <legend className="px-2 text-body font-semibold text-ignite-ink">
          {workshopLabels ? "Your workshop" : "Your session"}
        </legend>
        {workshopLabels ? (
          <p className={`${HELP} mb-3 mt-0`}>
            This is the bit that sells your workshop, and it is yours to
            write. It goes live on the workshops page as soon as you save.
            The room and time are on us; we&apos;ll confirm those with you.
          </p>
        ) : null}
        <div className="grid gap-3">
          <div>
            <label htmlFor="talkTitle" className={LABEL}>
              {workshopLabels ? "Workshop title" : "Talk title"}
            </label>
            <input
              id="talkTitle"
              name="talkTitle"
              defaultValue={v("talkTitle", defaults.talkTitle)}
              maxLength={200}
              className={INPUT}
            />
          </div>
          <div>
            <label htmlFor="talkDescription" className={LABEL}>
              {workshopLabels ? "What your workshop covers" : "What the session covers"}
            </label>
            <textarea
              id="talkDescription"
              name="talkDescription"
              defaultValue={v("talkDescription", defaults.talkDescription)}
              maxLength={2000}
              rows={5}
              className={INPUT}
            />
          </div>
          <div>
            <label htmlFor="talkTakeaways" className={LABEL}>
              {workshopLabels
                ? "What you'll leave with (one per line, up to 6)"
                : "What people will learn (one per line, up to 6)"}
            </label>
            <textarea
              id="talkTakeaways"
              name="talkTakeaways"
              defaultValue={v("talkTakeaways", defaults.talkTakeaways)}
              rows={4}
              className={INPUT}
            />
          </div>
        </div>
      </fieldset>

      <div>
        <label htmlFor="websiteUrl" className={LABEL}>
          Website (optional)
        </label>
        <input
          id="websiteUrl"
          name="websiteUrl"
          defaultValue={v("websiteUrl", defaults.websiteUrl)}
          inputMode="url"
          placeholder="https://"
          className={INPUT}
        />
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
                defaultValue={v(`social_${platform}`, defaults.socialUrls[platform] ?? "")}
                inputMode="url"
                placeholder="https://"
                className={INPUT}
              />
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className={LABEL}>Button (optional)</legend>
        <p className={HELP}>Send visitors somewhere useful: your book, your course, a call.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="ctaLabel" className="block text-small text-ignite-muted">
              Label
            </label>
            <input
              id="ctaLabel"
              name="ctaLabel"
              defaultValue={v("ctaLabel", defaults.ctaLabel)}
              maxLength={40}
              className={INPUT}
            />
          </div>
          <div>
            <label htmlFor="ctaUrl" className="block text-small text-ignite-muted">
              Link
            </label>
            <input
              id="ctaUrl"
              name="ctaUrl"
              defaultValue={v("ctaUrl", defaults.ctaUrl)}
              inputMode="url"
              placeholder="https://"
              className={INPUT}
            />
          </div>
        </div>
      </fieldset>

      <div>
        <label htmlFor="enquiriesEmail" className={LABEL}>
          Enquiries email (optional)
        </label>
        <input
          id="enquiriesEmail"
          name="enquiriesEmail"
          defaultValue={v("enquiriesEmail", defaults.enquiriesEmail)}
          inputMode="email"
          className={INPUT}
        />
        <p className={HELP}>
          Where &quot;Get in touch&quot; messages land. Leave blank to use your account
          email. Never shown on the page either way.
        </p>
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
