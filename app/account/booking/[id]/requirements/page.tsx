import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { Container } from "@/components/Container";
import { RequirementsForm } from "./RequirementsForm";
import { Section } from "@/components/Section";
import { SectionHeader } from "@/components/SectionHeader";
import { fetchOwnBookingDetail, resolveOwnAppUserId } from "@/lib/account/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Stand requirements · IGNITE! 27",
  robots: { index: false, follow: false },
};

interface ExistingRequirements {
  needs_power: boolean;
  needs_table_chairs: boolean;
  signage_name: string;
  logo_path: string | null;
  website_url: string | null;
  approved_at: string | null;
}

export default async function RequirementsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect(`/login?return_to=${encodeURIComponent(`/account/booking/${id}/requirements`)}`);
  }
  const appUserId = await resolveOwnAppUserId(supabase);
  if (!appUserId) notFound();

  const { data: booking } = await fetchOwnBookingDetail(supabase, appUserId, id);
  if (!booking || (booking as { booking_type: string }).booking_type !== "exhibitor") {
    notFound();
  }

  const { data: existing } = await supabase
    .from("exhibitor_requirements")
    .select("needs_power, needs_table_chairs, signage_name, logo_path, website_url, approved_at")
    .eq("booking_id", id)
    .maybeSingle();
  const req = existing as ExistingRequirements | null;

  return (
    <Section tone="light">
      <Container>
        <div className="mx-auto max-w-2xl">
          <Link
            href={`/account/booking/${id}`}
            className="text-small font-semibold text-ignite-red underline underline-offset-4"
          >
            Back to your booking
          </Link>
          <div className="mt-4">
            <SectionHeader
              eyebrow="Exhibitor stand"
              heading="Tell us what your stand needs."
              lede="Power, furniture, and how your company should appear. Your logo and website only go on the public site after we approve them, nothing publishes automatically."
              as="h1"
            />
          </div>
          {req?.approved_at ? (
            <p className="mt-6 rounded-xl border border-ignite-line bg-ignite-cream p-3 text-small text-ignite-ink">
              Your details are live on the public site. Saving changes here
              updates our records; the public listing updates after we
              re-approve.
            </p>
          ) : null}
          <div className="mt-8">
            <RequirementsForm
              bookingId={id}
              defaults={{
                needsPower: req?.needs_power ?? false,
                needsTableChairs: req?.needs_table_chairs ?? true,
                signageName: req?.signage_name ?? "",
                websiteUrl: req?.website_url ?? "",
                hasLogo: Boolean(req?.logo_path),
              }}
            />
          </div>
        </div>
      </Container>
    </Section>
  );
}
