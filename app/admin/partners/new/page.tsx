import Link from "next/link";
import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { PartnerForm } from "../PartnerForm";

export const metadata: Metadata = {
  title: "Add partner · IGNITE! 27",
  robots: { index: false, follow: false },
};

export default async function NewPartnerPage() {
  await requireSuperAdmin();

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/admin/partners"
        className="text-small font-semibold text-ignite-red underline underline-offset-4"
      >
        Back to partners
      </Link>
      <h1 className="mt-4 text-h1">Add partner</h1>
      <p className="mt-3 text-small text-ignite-muted">
        Recorded here after the deal is agreed; invoicing stays offline.
        Agreed and paid partners appear on the public strip straight away
        (toggle visibility from the list if needed).
      </p>
      <div className="mt-8">
        <PartnerForm
          partnerId={null}
          submitLabel="Add partner"
          defaults={{
            companyName: "",
            contactName: "",
            contactEmail: "",
            tier: "partner",
            agreedPricePounds: "",
            notes: "",
            websiteUrl: "",
            hasLogo: false,
          }}
        />
      </div>
    </div>
  );
}
