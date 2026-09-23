import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { PartnerForm } from "../../PartnerForm";

export const metadata: Metadata = {
  title: "Edit partner · IGNITE! 27",
  robots: { index: false, follow: false },
};

interface Row {
  id: string;
  company_name: string;
  contact_name: string;
  contact_email: string;
  tier: string;
  agreed_price_pence: number;
  status: string;
  notes: string;
  website_url: string | null;
  logo_path: string | null;
}

export default async function EditPartnerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { client } = await requireSuperAdmin();
  const { id } = await params;

  const { data, error } = await client
    .from("partners")
    .select(
      `id, company_name, contact_name, contact_email, tier,
       agreed_price_pence, status, notes, website_url, logo_path`,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) {
    return (
      <p className="rounded-2xl border-2 border-ignite-red bg-ignite-red/5 p-6 font-mono text-small">
        {error.message}
      </p>
    );
  }
  const partner = data as unknown as Row | null;
  if (!partner) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/admin/partners"
        className="text-small font-semibold text-ignite-red underline underline-offset-4"
      >
        Back to partners
      </Link>
      <h1 className="mt-4 text-h1">Edit partner</h1>
      <div className="mt-8">
        <PartnerForm
          partnerId={partner.id}
          submitLabel="Save partner"
          defaults={{
            companyName: partner.company_name,
            contactName: partner.contact_name,
            contactEmail: partner.contact_email,
            tier: partner.tier,
            agreedPricePounds: String(partner.agreed_price_pence / 100),
            status: partner.status,
            notes: partner.notes,
            websiteUrl: partner.website_url ?? "",
            hasLogo: Boolean(partner.logo_path),
          }}
        />
      </div>
    </div>
  );
}
