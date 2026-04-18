import Link from "next/link";
import { Button } from "./Button";
import { Container } from "./Container";
import { LogoWordmark } from "./LogoWordmark";
import { MobileNav } from "./MobileNav";
import { ACCOUNT_NAV, BOOK_CTA_HREF, MAIN_NAV } from "./nav-items";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-ignite-line bg-ignite-white">
      <Container className="flex h-16 items-center justify-between gap-6 md:h-20">
        <LogoWordmark />

        <nav
          aria-label="Primary"
          className="hidden flex-1 items-center justify-center xl:flex"
        >
          <ul className="flex items-center gap-7 text-small font-medium text-ignite-ink">
            {MAIN_NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="relative py-2 hover:text-ignite-red"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-3">
          <ul className="hidden items-center gap-4 text-small text-ignite-muted xl:flex">
            {ACCOUNT_NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="hover:text-ignite-red">
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
          <MobileNav />
        </div>
      </Container>
    </header>
  );
}
