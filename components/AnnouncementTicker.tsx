import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

// Homepage announcements as a news tickertape (September 2026,
// replacing the carousel): a full-width dark strip directly below the
// nav, published headlines scrolling right-to-left on a seamless loop.
//
// Mechanics, all CSS (no client JS):
//   - the track holds TWO identical copies of the headline list
//     (second one aria-hidden) and animates translateX(-50%), so the
//     loop never shows a seam;
//   - duration scales with how much text there is, keeping the speed
//     steady and readable whatever is published;
//   - hover (and keyboard focus inside) pauses the animation;
//   - prefers-reduced-motion gets a STATIC strip that scrolls
//     horizontally by hand, with the duplicate list hidden.
// Keyframes and the motion rules live in globals.css under .ticker.
//
// Headlines link out when the announcement has a link; otherwise they
// render as plain text (bodies are not shown here; they stay stored
// and visible in admin). Renders nothing at all while there are no
// published announcements, so the homepage is untouched until the
// first one goes live.

interface AnnouncementRow {
  id: string;
  headline: string;
  link_url: string | null;
}

function TickerItem({ item }: { item: AnnouncementRow }) {
  return (
    <li className="flex items-center gap-6 whitespace-nowrap">
      {item.link_url ? (
        <Link
          href={item.link_url}
          className="text-small font-semibold text-ignite-white underline-offset-4 hover:text-ignite-red hover:underline"
        >
          {item.headline}
        </Link>
      ) : (
        <span className="text-small font-semibold text-ignite-white">{item.headline}</span>
      )}
      {/* The brand mark as divider. */}
      <span aria-hidden className="text-small font-bold text-ignite-red">
        !
      </span>
    </li>
  );
}

export async function AnnouncementTicker() {
  let rows: AnnouncementRow[] = [];
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("announcements")
      .select("id, headline, link_url")
      .not("published_at", "is", null)
      .order("sort_order", { ascending: true })
      .order("published_at", { ascending: false });
    if (error) {
      // Never let the ticker take the homepage down.
      console.error("[announcement-ticker] fetch failed:", error.message);
      return null;
    }
    rows = (data ?? []) as AnnouncementRow[];
  } catch (err) {
    console.error("[announcement-ticker] fetch threw:", err);
    return null;
  }
  if (rows.length === 0) return null;

  // Steady speed regardless of content: roughly 6 characters per
  // second, clamped so one short headline still drifts calmly and a
  // full board never blurs past.
  const totalChars = rows.reduce((sum, r) => sum + r.headline.length + 4, 0);
  const durationSeconds = Math.min(90, Math.max(18, Math.round(totalChars / 6)));

  const list = (hidden: boolean) => (
    <ul
      aria-hidden={hidden || undefined}
      className="ticker-group flex items-center gap-6 pr-6"
    >
      {rows.map((r) => (
        <TickerItem key={`${hidden ? "dup-" : ""}${r.id}`} item={r} />
      ))}
    </ul>
  );

  return (
    <div
      className="ticker overflow-hidden border-b border-white/10 bg-ignite-black py-2.5"
      aria-label="Latest from IGNITE!"
    >
      <div
        className="ticker-track flex w-max"
        style={{ "--ticker-duration": `${durationSeconds}s` } as React.CSSProperties}
      >
        {list(false)}
        {list(true)}
      </div>
    </div>
  );
}
