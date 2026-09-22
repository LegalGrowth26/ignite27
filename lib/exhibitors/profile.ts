// Exhibitor profile pages: pure validation, slugs, and shaping. All
// content is plain text (React escapes it at render), URLs are
// http(s)-only, social platforms are allow-listed, and every field is
// length-capped. Nothing here touches the database.

export const SOCIAL_PLATFORMS = [
  "linkedin",
  "x",
  "instagram",
  "facebook",
  "tiktok",
  "youtube",
] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export const SOCIAL_PLATFORM_LABELS: Record<SocialPlatform, string> = {
  linkedin: "LinkedIn",
  x: "X",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  youtube: "YouTube",
};

export interface SocialLink {
  platform: SocialPlatform;
  url: string;
}

export interface ProfileContentInput {
  displayName: string;
  description: string | null;
  websiteUrl: string | null;
  socialLinks: SocialLink[];
  ctaPrimaryLabel: string | null;
  ctaPrimaryUrl: string | null;
  ctaSecondaryLabel: string | null;
  ctaSecondaryUrl: string | null;
  showContactEmail: boolean;
  contactEmail: string | null;
}

export type ProfileValidation =
  | { ok: true; value: ProfileContentInput }
  | { ok: false; error: string };

const MAX_NAME = 120;
const MAX_DESCRIPTION = 2000;
const MAX_URL = 500;
const MAX_CTA_LABEL = 40;

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

// One CTA slot: label and URL together or neither.
function validateCta(
  label: string,
  url: string,
  slot: string,
): { label: string | null; url: string | null } | string {
  if (!label && !url) return { label: null, url: null };
  if (!label || !url) {
    return `The ${slot} button needs both a label and a link, or neither.`;
  }
  if (label.length > MAX_CTA_LABEL) {
    return `The ${slot} button label is too long (max ${MAX_CTA_LABEL} characters).`;
  }
  if (url.length > MAX_URL || !isHttpUrl(url)) {
    return `The ${slot} button link must be a full http(s) URL.`;
  }
  return { label, url };
}

export function validateProfileContent(input: {
  displayName?: unknown;
  description?: unknown;
  websiteUrl?: unknown;
  socialLinks?: unknown; // Array<{platform, url}>
  ctaPrimaryLabel?: unknown;
  ctaPrimaryUrl?: unknown;
  ctaSecondaryLabel?: unknown;
  ctaSecondaryUrl?: unknown;
  showContactEmail?: unknown;
  contactEmail?: unknown;
}): ProfileValidation {
  const displayName = str(input.displayName);
  if (!displayName || displayName.length > MAX_NAME) {
    return { ok: false, error: `Company name is required (max ${MAX_NAME} characters).` };
  }

  const description = str(input.description);
  if (description.length > MAX_DESCRIPTION) {
    return { ok: false, error: `Description is too long (max ${MAX_DESCRIPTION} characters).` };
  }

  const websiteUrl = str(input.websiteUrl);
  if (websiteUrl && (websiteUrl.length > MAX_URL || !isHttpUrl(websiteUrl))) {
    return { ok: false, error: "Website must be a full http(s) URL, or leave it blank." };
  }

  const socialLinks: SocialLink[] = [];
  if (Array.isArray(input.socialLinks)) {
    for (const raw of input.socialLinks) {
      const platform = str((raw as { platform?: unknown })?.platform) as SocialPlatform;
      const url = str((raw as { url?: unknown })?.url);
      if (!url) continue; // empty slot
      if (!SOCIAL_PLATFORMS.includes(platform)) {
        return { ok: false, error: "One of the social links has an unknown platform." };
      }
      if (url.length > MAX_URL || !isHttpUrl(url)) {
        return {
          ok: false,
          error: `The ${SOCIAL_PLATFORM_LABELS[platform]} link must be a full http(s) URL.`,
        };
      }
      if (socialLinks.some((l) => l.platform === platform)) {
        return { ok: false, error: `Only one ${SOCIAL_PLATFORM_LABELS[platform]} link, please.` };
      }
      socialLinks.push({ platform, url });
    }
  }

  const primary = validateCta(str(input.ctaPrimaryLabel), str(input.ctaPrimaryUrl), "first");
  if (typeof primary === "string") return { ok: false, error: primary };
  const secondary = validateCta(
    str(input.ctaSecondaryLabel),
    str(input.ctaSecondaryUrl),
    "second",
  );
  if (typeof secondary === "string") return { ok: false, error: secondary };

  const showContactEmail = input.showContactEmail === true || input.showContactEmail === "on";
  const contactEmail = str(input.contactEmail).toLowerCase();
  if (showContactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return { ok: false, error: "Add a valid contact email, or untick showing it." };
  }

  return {
    ok: true,
    value: {
      displayName,
      description: description || null,
      websiteUrl: websiteUrl || null,
      socialLinks,
      ctaPrimaryLabel: primary.label,
      ctaPrimaryUrl: primary.url,
      ctaSecondaryLabel: secondary.label,
      ctaSecondaryUrl: secondary.url,
      showContactEmail,
      contactEmail: contactEmail || null,
    },
  };
}

// URL slug from a company name: lowercase alnum + hyphens, trimmed,
// capped, never empty. "Impact Marketing Ltd." -> "impact-marketing-ltd".
export function slugifyCompany(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/g, "");
  return slug.length >= 2 ? slug : "exhibitor";
}

// Deterministic collision handling: base, base-2, base-3... against
// the set of slugs already taken.
export function pickAvailableSlug(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  for (let i = 2; i < 100; i += 1) {
    const candidate = `${base}-${i}`.slice(0, 50);
    if (!taken.has(candidate)) return candidate;
  }
  // 100 identically-named exhibitors is not a real scenario; make the
  // impossible loud rather than looping forever.
  throw new Error(`could not find an available slug for ${base}`);
}
