export type NavItem = { href: string; label: string };

// Only pages that currently exist ship in nav. Dead links (sponsors,
// partners, faq, terms, privacy-policy) are hidden until the pages land.
// Partner content now lives on /exhibit (see the PartnerPackage block).
export const MAIN_NAV: readonly NavItem[] = [
  { href: "/attend", label: "Attend" },
  { href: "/exhibit", label: "Exhibit" },
  { href: "/agenda", label: "Agenda" },
  { href: "/speakers", label: "Speakers" },
  { href: "/venue", label: "Venue" },
  { href: "/contact", label: "Contact" },
];

export const ACCOUNT_NAV: readonly NavItem[] = [
  { href: "/login", label: "Login" },
];

export const LEGAL_NAV: readonly NavItem[] = [
  { href: "/refund-policy", label: "Refund policy" },
];

export const BOOK_CTA_HREF = "/attend";
