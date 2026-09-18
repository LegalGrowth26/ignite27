import { Container } from "./Container";
import { Section } from "./Section";
import {
  AnnouncementCarousel,
  type AnnouncementCard,
} from "./AnnouncementCarousel";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

interface AnnouncementRow {
  id: string;
  headline: string;
  body: string;
  link_url: string | null;
  image_url: string | null;
}

// "Latest from IGNITE!" homepage strip. Reads PUBLISHED announcements
// via the public RLS policy and renders nothing at all (no section, no
// heading) while there are none, so the homepage is untouched until
// the first announcement goes live.
export async function LatestFromIgnite() {
  let rows: AnnouncementRow[] = [];
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("announcements")
      .select("id, headline, body, link_url, image_url")
      .not("published_at", "is", null)
      .order("sort_order", { ascending: true })
      .order("published_at", { ascending: false });
    if (error) {
      // Never let the strip take the homepage down.
      console.error("[announcements] fetch failed:", error.message);
      return null;
    }
    rows = (data ?? []) as AnnouncementRow[];
  } catch (err) {
    console.error("[announcements] fetch threw:", err);
    return null;
  }
  if (rows.length === 0) return null;

  const cards: AnnouncementCard[] = rows.map((r) => ({
    id: r.id,
    headline: r.headline,
    body: r.body,
    linkUrl: r.link_url,
    imageUrl: r.image_url,
  }));

  return (
    <Section tone="cream">
      <Container>
        <p className="text-eyebrow uppercase text-ignite-red">News</p>
        <h2 className="mt-3 text-h2">Latest from IGNITE!</h2>
        <div className="mt-8">
          <AnnouncementCarousel cards={cards} />
        </div>
      </Container>
    </Section>
  );
}
