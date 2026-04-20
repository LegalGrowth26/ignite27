import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Button } from "@/components/Button";
import { Container } from "@/components/Container";
import { Section } from "@/components/Section";
import { SectionHeader } from "@/components/SectionHeader";
import { formatPoundsFromPence } from "@/lib/pricing";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your account — Ignite 27",
};

interface BookingRow {
  id: string;
  booking_reference: string | null;
  booking_type: "delegate" | "exhibitor";
  ticket_type: "regular" | "vip" | "exhibitor";
  gross_amount_pence: number;
  payment_status: string;
  booking_status: string;
  created_at: string;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function ticketLabel(row: BookingRow): string {
  if (row.booking_type === "exhibitor") return "Exhibitor";
  return row.ticket_type === "vip" ? "VIP" : "Regular";
}

export default async function AccountHome() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect(`/login?return_to=${encodeURIComponent("/account")}`);
  }

  const { data: bookings, error } = await supabase
    .from("bookings")
    .select(
      "id, booking_reference, booking_type, ticket_type, gross_amount_pence, payment_status, booking_status, created_at",
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[account] list bookings error:", error);
  }

  const rows = (bookings ?? []) as BookingRow[];

  return (
    <Section tone="light">
      <Container>
        <div className="mx-auto max-w-4xl">
          <div className="flex items-start justify-between gap-4">
            <SectionHeader eyebrow="Your account" heading="Your bookings." />
            <form action="/logout" method="post">
              <Button variant="secondary" size="md" type="submit">
                Log out
              </Button>
            </form>
          </div>

          {rows.length === 0 ? (
            <div className="mt-10 rounded-2xl border border-ignite-line bg-ignite-cream p-6">
              <p className="text-body text-ignite-ink">No bookings yet.</p>
              <div className="mt-4">
                <Button href="/attend" variant="primary" size="md">
                  Book your place
                </Button>
              </div>
            </div>
          ) : (
            <ul className="mt-10 flex flex-col gap-4">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="rounded-2xl border border-ignite-line bg-ignite-white p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-eyebrow uppercase text-ignite-red">
                        {ticketLabel(row)}
                      </p>
                      <p className="mt-2 text-h3 text-ignite-ink">
                        {row.booking_reference ?? "I27-PENDING"}
                      </p>
                      <p className="mt-1 text-small text-ignite-muted">
                        Booked {formatDate(row.created_at)} · Status {row.booking_status}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-h3 text-ignite-ink">
                        {formatPoundsFromPence(row.gross_amount_pence)}
                      </p>
                      <p className="text-small text-ignite-muted">{row.payment_status}</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <Link
                      href={`/account/booking/${row.id}`}
                      className="text-small font-semibold text-ignite-red underline underline-offset-4"
                    >
                      View details
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Container>
    </Section>
  );
}
