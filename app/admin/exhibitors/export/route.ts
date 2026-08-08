import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { resolveAdminContext } from "@/lib/admin/guard";
import { csvResponse, toCsv } from "@/lib/admin/csv";
import { buildExhibitorListing } from "@/lib/exhibitors/listing";

export const dynamic = "force-dynamic";

interface Row {
  booking_reference: string | null;
  company_name: string | null;
  company_contact_name: string | null;
  company_contact_email: string | null;
  company_website: string | null;
  payment_status: string;
  booking_status: string;
  stripe_checkout_session_id: string | null;
  listing_hidden_at: string | null;
  exhibitor_requirements: {
    needs_power: boolean;
    needs_table_chairs: boolean;
    signage_name: string;
    website_url: string | null;
  } | null;
  booking_attendees: ReadonlyArray<{
    first_name: string;
    surname: string;
    email: string;
    dietary_requirement: string;
  }>;
}

export async function GET(): Promise<Response> {
  const client = await createSupabaseServerClient();
  const ctx = await resolveAdminContext(client);
  if (!ctx) return new Response("Not found", { status: 404 });

  const { data, error } = await client
    .from("bookings")
    .select(
      `booking_reference, company_name, company_contact_name,
       company_contact_email, company_website, payment_status,
       booking_status, stripe_checkout_session_id, listing_hidden_at,
       exhibitor_requirements (needs_power, needs_table_chairs, signage_name, website_url),
       booking_attendees (first_name, surname, email, dietary_requirement)`,
    )
    .eq("booking_type", "exhibitor")
    .order("created_at", { ascending: true });
  if (error) return new Response(`query failed: ${error.message}`, { status: 500 });

  const rows = (data ?? []) as unknown as Row[];
  const csv = toCsv<Row>(rows, [
    { header: "Reference", value: (r) => r.booking_reference },
    { header: "Company", value: (r) => r.company_name },
    { header: "Signage name", value: (r) => r.exhibitor_requirements?.signage_name ?? "" },
    { header: "Contact", value: (r) => r.company_contact_name },
    { header: "Contact email", value: (r) => r.company_contact_email },
    { header: "Website", value: (r) => r.exhibitor_requirements?.website_url ?? r.company_website ?? "" },
    { header: "Needs power", value: (r) => r.exhibitor_requirements ? (r.exhibitor_requirements.needs_power ? "yes" : "no") : "" },
    { header: "Table + chairs", value: (r) => r.exhibitor_requirements ? (r.exhibitor_requirements.needs_table_chairs ? "yes" : "no") : "" },
    {
      header: "Listed on public site",
      value: (r) =>
        buildExhibitorListing([
          {
            bookingId: r.booking_reference ?? "",
            companyName: r.company_name,
            signageName: r.exhibitor_requirements?.signage_name ?? null,
            websiteUrl: null,
            logoPath: null,
            paymentStatus: r.payment_status,
            bookingStatus: r.booking_status,
            stripeCheckoutSessionId: r.stripe_checkout_session_id,
            listingHiddenAt: r.listing_hidden_at,
          },
        ]).length > 0
          ? "yes"
          : r.listing_hidden_at
            ? "hidden by admin"
            : "no",
    },
    { header: "Payment status", value: (r) => r.payment_status },
    {
      header: "Attendees",
      value: (r) =>
        r.booking_attendees
          .map((a) => `${a.first_name} ${a.surname} <${a.email}> (${a.dietary_requirement})`)
          .join("; "),
    },
  ]);

  return csvResponse(csv, "ignite27-exhibitors.csv");
}
