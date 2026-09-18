import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/Container";
import { Section } from "@/components/Section";
import {
  fetchMyWorkshopIds,
  fetchPublishedWorkshop,
  fetchWorkshopEligibility,
} from "@/lib/workshops/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";
import {
  BookingControls,
  StatusBanner,
  formatWorkshopDate,
  formatWorkshopTime,
  type BookingViewer,
} from "../shared";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string; error?: string }>;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadWorkshop(id: string) {
  if (!UUID_PATTERN.test(id)) return null;
  try {
    return await fetchPublishedWorkshop(createSupabaseServiceClient(), id);
  } catch (err) {
    console.error("[workshop-page] fetch failed:", err);
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const workshop = await loadWorkshop(id);
  if (!workshop) return { title: "Workshop not found · IGNITE! 27" };
  return {
    title: `${workshop.title} · IGNITE! 27 workshops`,
    description: workshop.description.slice(0, 160) || undefined,
  };
}

export default async function WorkshopDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { status, error } = await searchParams;
  const workshop = await loadWorkshop(id);
  if (!workshop) notFound();

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const signedIn = Boolean(userData?.user);
  const viewer: BookingViewer = {
    signedIn,
    eligibility: signedIn
      ? await fetchWorkshopEligibility(supabase)
      : { hasBooking: false, isVip: false },
    bookedIds: signedIn ? await fetchMyWorkshopIds(supabase) : new Set(),
  };

  const paragraphs = workshop.description
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  return (
    <Section tone="light">
      <Container>
        <div className="mx-auto max-w-3xl">
          <Link
            href="/workshops"
            className="text-small font-semibold text-ignite-red underline underline-offset-4"
          >
            All workshops
          </Link>

          <div className="mt-6 grid gap-4">
            <StatusBanner status={status} error={error} />
          </div>

          <p className="mt-4 text-eyebrow uppercase text-ignite-red">
            {formatWorkshopDate(workshop.starts_at)} ·{" "}
            {formatWorkshopTime(workshop.starts_at, workshop.ends_at)}
            {workshop.room ? ` · ${workshop.room}` : ""}
          </p>
          <h1 className="mt-3 text-h1">{workshop.title}</h1>
          {workshop.speaker_name ? (
            <p className="mt-3 text-lead text-ignite-muted">with {workshop.speaker_name}</p>
          ) : null}

          <div className="mt-6">
            {paragraphs.length > 0 ? (
              paragraphs.map((p, i) => (
                <p key={i} className={`text-body text-ignite-ink ${i > 0 ? "mt-4" : ""}`}>
                  {p}
                </p>
              ))
            ) : (
              <p className="text-body text-ignite-muted">
                Full session details are on their way.
              </p>
            )}
          </div>

          <div className="mt-8 rounded-2xl border border-ignite-line bg-ignite-white p-6">
            <p className="text-body font-semibold text-ignite-ink">
              {workshop.spacesLeft > 0
                ? `${workshop.spacesLeft} of ${workshop.capacity} places left.`
                : "This workshop is full."}
            </p>
            <p className="mt-1 text-small text-ignite-muted">
              Free for IGNITE! 27 ticket holders. You can un-book up to the day
              before the event if your plans change.
            </p>
            <div className="mt-4">
              <BookingControls
                workshop={workshop}
                viewer={viewer}
                returnTo={`/workshops/${workshop.id}`}
              />
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
