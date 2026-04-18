export type NavItem = { href: string; label: string };

export const MAIN_NAV: readonly NavItem[] = [
  { href: "/attend", label: "Attend" },
  { href: "/exhibit", label: "Exhibit" },
  { href: "/agenda", label: "Agenda" },
  { href: "/speakers", label: "Speakers" },
  { href: "/venue", label: "Venue" },
  { href: "/sponsors", label: "Sponsors" },
  { href: "/partners", label: "Partners" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
];

export const ACCOUNT_NAV: readonly NavItem[] = [
  { href: "/login", label: "Login" },
];

export const LEGAL_NAV: readonly NavItem[] = [
  { href: "/terms", label: "Terms" },
  { href: "/refund-policy", label: "Refund policy" },
  { href: "/privacy-policy", label: "Privacy policy" },
];

export const BOOK_CTA_HREF = "/attend";
