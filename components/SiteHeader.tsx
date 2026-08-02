import Link from "next/link";
import { getIsSuperAdmin } from "@/lib/admin/guard";
import { resolveAccountNav } from "@/lib/auth/session-nav";
import { Button } from "./Button";
import { Container } from "./Container";
import { LogoWordmark } from "./LogoWordmark";
import { MobileNav } from "./MobileNav";
import { BOOK_CTA_HREF, MAIN_NAV } from "./nav-items";

// Solid black at all scroll positions. Active / hover marker is a red
// bullet dot beneath the label (no box outline), keeping the row calm.
// Account nav is session-aware: "Login" for anonymous visitors,
// "Account" once signed in, plus an "Admin" link that renders only for
// super admins; everyone else never sees a hint that /admin exists.
export async function SiteHeader() {
  const [sessionNav, isAdmin] = await Promise.all([
    resolveAccountNav(),
    getIsSuperAdmin(),
  ]);
  const accountNav = isAdmin
    ? [...sessionNav, { href: "/admin", label: "Admin" }]
    : sessionNav;
  return (
    <header className="sticky top-0 z-40 bg-ignite-black text-ignite-white">
      <Container className="flex h-16 items-center justify-between gap-6 md:h-20">
        <LogoWordmark tone="dark" />

        <nav
          aria-label="Primary"
          className="hidden flex-1 items-center justify-center xl:flex"
        >
          <ul className="flex items-center gap-7 text-small font-medium text-white/85">
            {MAIN_NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="group relative py-2 transition-colors hover:text-ignite-white focus-visible:text-ignite-white focus-visible:outline-none"
                >
                  {item.label}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute left-1/2 top-full -translate-x-1/2 -translate-y-1 h-1.5 w-1.5 rounded-full bg-ignite-red opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-3">
          <ul className="hidden items-center gap-4 text-small text-white/70 xl:flex">
            {accountNav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="transition-colors hover:text-ignite-white"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="hidden sm:block">
            <Button href={BOOK_CTA_HREF} variant="primary" size="md">
              Book your place
            </Button>
          </div>
          <MobileNav accountNav={accountNav} />
        </div>
      </Container>
    </header>
  );
}
