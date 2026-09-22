// Speaker profile validation and shaping. Same regime as exhibitor
// profiles: plain text everywhere (React escapes at render), URLs
// http(s)-only, social platforms allow-listed (shared list), every
// field length-capped. Nothing here touches the database.

import {
  SOCIAL_PLATFORMS,
  type SocialLink,
} from "@/lib/exhibitors/profile";

export const MAX_TAKEAWAYS = 6;

export interface SpeakerContentInput {
  displayName: string;
  bio: string;
  talkTitle: string;
  talkDescription: string;
  talkTakeaways: string[];
  websiteUrl: string | null;
  socialLinks: SocialLink[];
  ctaLabel: string | null;
  ctaUrl: string | null;
  enquiriesEmail: string | null;
}

export type SpeakerContentValidation =
  | { ok: true; value: SpeakerContentInput }
  | { ok: false; error: string };

const MAX_NAME = 120;
const MAX_BIO = 2000;
const MAX_TALK_TITLE = 200;
const MAX_TALK_DESCRIPTION = 2000;
const MAX_TAKEAWAY = 200;
const MAX_URL = 500;
const MAX_CTA_LABEL = 40;

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 200;
}

// The "what you'll learn" bullets arrive as one textarea, a bullet per
// line. Blank lines are dropped; max 6 bullets of 200 chars.
export function parseTakeaways(raw: unknown): string[] | string {
  const lines = str(raw)
    .split(/\n+/)
    .map((l) => l.replace(/^[-•*]\s*/, "").trim())
    .filter((l) => l.length > 0);
  if (lines.length > MAX_TAKEAWAYS) {
    return `Keep "what you'll learn" to ${MAX_TAKEAWAYS} bullets or fewer.`;
  }
  const tooLong = lines.find((l) => l.length > MAX_TAKEAWAY);
  if (tooLong) {
    return `One of the bullets is too long (max ${MAX_TAKEAWAY} characters).`;
  }
  return lines;
}

export function validateSpeakerContent(input: {
  displayName?: unknown;
  bio?: unknown;
  talkTitle?: unknown;
  talkDescription?: unknown;
  talkTakeaways?: unknown; // textarea, one bullet per line
  websiteUrl?: unknown;
  socialLinks?: unknown; // Array<{platform, url}>
  ctaLabel?: unknown;
  ctaUrl?: unknown;
  enquiriesEmail?: unknown;
}): SpeakerContentValidation {
  const displayName = str(input.displayName);
  if (!displayName || displayName.length > MAX_NAME) {
    return { ok: false, error: `Name is required (max ${MAX_NAME} characters).` };
  }

  const bio = str(input.bio);
  if (bio.length > MAX_BIO) {
    return { ok: false, error: `Bio is too long (max ${MAX_BIO} characters).` };
  }

  const talkTitle = str(input.talkTitle);
  if (talkTitle.length > MAX_TALK_TITLE) {
    return { ok: false, error: `Talk title is too long (max ${MAX_TALK_TITLE} characters).` };
  }

  const talkDescription = str(input.talkDescription);
  if (talkDescription.length > MAX_TALK_DESCRIPTION) {
    return {
      ok: false,
      error: `Talk description is too long (max ${MAX_TALK_DESCRIPTION} characters).`,
    };
  }

  const takeaways = parseTakeaways(input.talkTakeaways);
  if (typeof takeaways === "string") return { ok: false, error: takeaways };

  const websiteUrl = str(input.websiteUrl);
  if (websiteUrl && (websiteUrl.length > MAX_URL || !isHttpUrl(websiteUrl))) {
    return { ok: false, error: "Website must be a full http(s) URL, or leave it blank." };
  }

  const socialLinks: SocialLink[] = [];
  if (Array.isArray(input.socialLinks)) {
    for (const raw of input.socialLinks) {
      const platform = str((raw as { platform?: unknown })?.platform) as SocialLink["platform"];
      const url = str((raw as { url?: unknown })?.url);
      if (!url) continue;
      if (!(SOCIAL_PLATFORMS as readonly string[]).includes(platform)) {
        return { ok: false, error: "One of the social links has an unknown platform." };
      }
      if (url.length > MAX_URL || !isHttpUrl(url)) {
        return { ok: false, error: `The ${platform} link must be a full http(s) URL.` };
      }
      if (socialLinks.some((l) => l.platform === platform)) {
        return { ok: false, error: `Only one ${platform} link, please.` };
      }
      socialLinks.push({ platform, url });
    }
  }

  const ctaLabel = str(input.ctaLabel);
  const ctaUrl = str(input.ctaUrl);
  if ((ctaLabel && !ctaUrl) || (!ctaLabel && ctaUrl)) {
    return { ok: false, error: "The button needs both a label and a link, or neither." };
  }
  if (ctaLabel.length > MAX_CTA_LABEL) {
    return { ok: false, error: `The button label is too long (max ${MAX_CTA_LABEL} characters).` };
  }
  if (ctaUrl && (ctaUrl.length > MAX_URL || !isHttpUrl(ctaUrl))) {
    return { ok: false, error: "The button link must be a full http(s) URL." };
  }

  const enquiriesEmail = str(input.enquiriesEmail).toLowerCase();
  if (enquiriesEmail && !isEmail(enquiriesEmail)) {
    return { ok: false, error: "The enquiries email does not look right, or leave it blank." };
  }

  return {
    ok: true,
    value: {
      displayName,
      bio,
      talkTitle,
      talkDescription,
      talkTakeaways: takeaways,
      websiteUrl: websiteUrl || null,
      socialLinks,
      ctaLabel: ctaLabel || null,
      ctaUrl: ctaUrl || null,
      enquiriesEmail: enquiriesEmail || null,
    },
  };
}

// Defensive parse of stored takeaways jsonb.
export function parseStoredTakeaways(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .slice(0, MAX_TAKEAWAYS);
}
