// Pure validation + ordering helpers for homepage announcements,
// shared by the admin create and edit actions and unit-tested without
// a database.

export interface AnnouncementInput {
  headline: string;
  body: string;
  linkUrl: string | null;
  imageUrl: string | null;
}

export type AnnouncementValidation =
  | { ok: true; value: AnnouncementInput }
  | { ok: false; error: string };

const MAX_HEADLINE = 120;
const MAX_BODY = 500;
const MAX_URL = 500;

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateAnnouncement(input: {
  headline?: unknown;
  body?: unknown;
  linkUrl?: unknown;
  imageUrl?: unknown;
}): AnnouncementValidation {
  const headline = typeof input.headline === "string" ? input.headline.trim() : "";
  const body = typeof input.body === "string" ? input.body.trim() : "";
  const linkRaw = typeof input.linkUrl === "string" ? input.linkUrl.trim() : "";
  const imageRaw = typeof input.imageUrl === "string" ? input.imageUrl.trim() : "";

  if (headline.length === 0 || headline.length > MAX_HEADLINE) {
    return { ok: false, error: `Headline is required (max ${MAX_HEADLINE} characters).` };
  }
  if (body.length === 0 || body.length > MAX_BODY) {
    return { ok: false, error: `Body is required (max ${MAX_BODY} characters).` };
  }
  if (linkRaw && (linkRaw.length > MAX_URL || !isHttpUrl(linkRaw))) {
    return { ok: false, error: "Link must be a full http(s) URL, or leave it blank." };
  }
  // Images: an absolute http(s) URL or a site-relative path such as
  // /images/photos/photo-01.webp (v1 takes a URL; no upload flow).
  if (
    imageRaw &&
    (imageRaw.length > MAX_URL || !(isHttpUrl(imageRaw) || imageRaw.startsWith("/")))
  ) {
    return { ok: false, error: "Image must be a full http(s) URL or a /path on this site." };
  }

  return {
    ok: true,
    value: {
      headline,
      body,
      linkUrl: linkRaw || null,
      imageUrl: imageRaw || null,
    },
  };
}

// Reordering: swap the target's sort_order with its neighbour in the
// given direction. Returns the two updates to apply, or null when the
// move is a no-op (already at the edge, or id unknown). Rows arrive in
// display order (sort_order ascending).
export interface OrderedRow {
  id: string;
  sort_order: number;
}

export function computeReorderSwap(
  rows: readonly OrderedRow[],
  id: string,
  direction: "up" | "down",
): Array<{ id: string; sort_order: number }> | null {
  const index = rows.findIndex((r) => r.id === id);
  if (index === -1) return null;
  const neighbourIndex = direction === "up" ? index - 1 : index + 1;
  if (neighbourIndex < 0 || neighbourIndex >= rows.length) return null;
  const a = rows[index]!;
  const b = rows[neighbourIndex]!;
  // Equal sort_orders (legacy defaults) would swap into the same value
  // and not actually move; nudge deterministically instead.
  if (a.sort_order === b.sort_order) {
    return direction === "up"
      ? [{ id: a.id, sort_order: b.sort_order - 1 }]
      : [{ id: a.id, sort_order: b.sort_order + 1 }];
  }
  return [
    { id: a.id, sort_order: b.sort_order },
    { id: b.id, sort_order: a.sort_order },
  ];
}
