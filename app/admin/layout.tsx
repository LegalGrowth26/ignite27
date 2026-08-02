import Link from "next/link";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { Container } from "@/components/Container";

export const dynamic = "force-dynamic";

const ADMIN_NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/bookings", label: "Bookings" },
  { href: "/admin/exhibitors", label: "Exhibitors" },
  { href: "/admin/discounts", label: "Discount codes" },
  { href: "/admin/emails", label: "Email lists" },
] as const;

// Every /admin route is gated here; non-admins 404 before any admin UI
// or data renders. Server actions and CSV route handlers each re-check
// independently (this layout does not protect POSTs or route handlers).
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSuperAdmin();

  return (
    <div className="min-h-screen bg-ignite-cream">
      <div className="border-b border-ignite-line bg-ignite-white">
        <Container className="flex flex-wrap items-center gap-x-6 gap-y-2 py-4">
          <span className="text-eyebrow uppercase text-ignite-red">Admin</span>
          <nav aria-label="Admin sections">
            <ul className="flex flex-wrap items-center gap-4 text-small font-medium text-ignite-ink">
              {ADMIN_NAV.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="hover:text-ignite-red">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </Container>
      </div>
      <Container className="py-10">{children}</Container>
    </div>
  );
}
