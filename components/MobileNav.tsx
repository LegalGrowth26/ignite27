"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ACCOUNT_NAV, BOOK_CTA_HREF, MAIN_NAV } from "./nav-items";

export function MobileNav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="xl:hidden">
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-ignite-line text-ignite-ink hover:border-ignite-red hover:text-ignite-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ignite-red focus-visible:ring-offset-2"
      >
        {open ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M5 5l14 14M19 5L5 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        )}
      </button>

      {open ? (
        <div
          id="mobile-nav-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Site navigation"
          className="fixed inset-0 z-50 bg-ignite-black text-ignite-white"
        >
          <div className="mx-auto flex h-full max-w-container flex-col px-6 pt-6 md:px-10">
            <div className="flex items-center justify-between">
              <Link
                href="/"
                onClick={() => setOpen(false)}
                aria-label="Ignite 27, home"
                className="inline-flex items-baseline font-bold text-lg tracking-tight text-ignite-white"
              >
                <span>Ignite</span>
                <span aria-hidden className="mx-[2px] inline-block h-1.5 w-1.5 translate-y-[-2px] rounded-full bg-ignite-red" />
                <span>27</span>
              </Link>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/30 text-ignite-white hover:border-ignite-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ignite-red focus-visible:ring-offset-2 focus-visible:ring-offset-ignite-black"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M5 5l14 14M19 5L5 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <nav className="mt-12 flex-1 overflow-y-auto" aria-label="Primary">
              <ul className="flex flex-col gap-1">
                {MAIN_NAV.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="block py-3 text-h2 font-semibold tracking-tight hover:text-ignite-red"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <ul className="mt-8 flex flex-col gap-1 border-t border-white/10 pt-6">
                {ACCOUNT_NAV.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="block py-2 text-body text-white/80 hover:text-ignite-white"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="py-6">
              <Link
                href={BOOK_CTA_HREF}
                onClick={() => setOpen(false)}
                className="inline-flex h-14 w-full items-center justify-center rounded-full bg-ignite-red px-8 text-body font-semibold text-ignite-white transition-all hover:bg-ignite-red-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ignite-red focus-visible:ring-offset-2 focus-visible:ring-offset-ignite-black"
              >
                Book your place
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
