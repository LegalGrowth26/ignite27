import Link from "next/link";
import { Container } from "./Container";
import { LogoWordmark } from "./LogoWordmark";
import { LEGAL_NAV } from "./nav-items";

type FooterColumn = {
  heading: string;
  items: ReadonlyArray<{ href: string; label: string }>;
};

const FOOTER_COLUMNS: readonly FooterColumn[] = [
  {
    heading: "Attend",
    items: [
      { href: "/attend", label: "Book your place" },
      { href: "/exhibit", label: "Reserve a stand" },
      { href: "/sponsors", label: "Sponsor Ignite" },
      { href: "/partners", label: "Become a partner" },
    ],
  },
  {
    heading: "The day",
    items: [
      { href: "/agenda", label: "Agenda" },
      { href: "/speakers", label: "Speakers" },
      { href: "/venue", label: "Venue" },
    ],
  },
  {
    heading: "Help",
    items: [
      { href: "/faq", label: "FAQ" },
      { href: "/contact", label: "Contact" },
      { href: "/login", label: "Login" },
    ],
  },
];

const SOCIALS: ReadonlyArray<{ label: string; href: string; icon: "linkedin" | "instagram" | "x" }> = [
  { label: "Ignite 27 on LinkedIn", href: "#", icon: "linkedin" },
  { label: "Ignite 27 on Instagram", href: "#", icon: "instagram" },
  { label: "Ignite 27 on X", href: "#", icon: "x" },
];

function SocialIcon({ icon }: { icon: "linkedin" | "instagram" | "x" }) {
  if (icon === "linkedin") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M4.98 3.5C4.98 4.88 3.87 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM.24 8h4.52V22H.24V8zm7.44 0h4.33v1.92h.06c.6-1.14 2.08-2.34 4.28-2.34 4.58 0 5.43 3.02 5.43 6.94V22H17.2v-6.08c0-1.45-.03-3.3-2.01-3.3-2.01 0-2.32 1.57-2.32 3.2V22H8.55V8h-.87z" />
      </svg>
    );
  }
  if (icon === "instagram") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2H21l-6.54 7.47L22 22h-6.828l-4.77-6.23L4.8 22H2.04l7.002-8L2 2h6.914l4.33 5.72L18.244 2zm-2.397 18.3h1.85L7.3 3.6H5.325l10.522 16.7z" />
    </svg>
  );
}

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-ignite-black text-ignite-white">
      <Container className="py-section">
        <div className="flex flex-col gap-12 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <LogoWordmark tone="dark" />
            <p className="mt-4 text-small text-white/70">
              Sunday 31 January 2027. The Renaissance at Kelham Hall, Newark.
            </p>
            <ul className="mt-6 flex items-center gap-3">
              {SOCIALS.map((s) => (
                <li key={s.label}>
                  <a
                    href={s.href}
                    aria-label={s.label}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-white/80 transition-colors hover:border-ignite-red hover:text-ignite-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ignite-red focus-visible:ring-offset-2 focus-visible:ring-offset-ignite-black"
                  >
                    <SocialIcon icon={s.icon} />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <nav aria-label="Footer" className="grid flex-1 grid-cols-2 gap-8 sm:grid-cols-3 md:max-w-2xl">
            {FOOTER_COLUMNS.map((col) => (
              <div key={col.heading}>
                <h2 className="text-eyebrow uppercase text-ignite-red">{col.heading}</h2>
                <ul className="mt-4 flex flex-col gap-2.5">
                  {col.items.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="text-small text-white/80 hover:text-ignite-white"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-16 flex flex-col gap-4 border-t border-white/10 pt-6 text-small text-white/60 md:flex-row md:items-center md:justify-between">
          <p>&copy; {year} Ignite 27. All rights reserved.</p>
          <ul className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {LEGAL_NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="hover:text-ignite-white">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </footer>
  );
}
