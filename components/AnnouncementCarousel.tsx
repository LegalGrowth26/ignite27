"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";

export interface AnnouncementCard {
  id: string;
  headline: string;
  body: string;
  linkUrl: string | null;
  imageUrl: string | null;
}

// Rotating, swipeable announcement strip. Built on horizontal
// scroll-snap so touch swiping is native; the prev/next buttons and
// dots drive the same scroll position, so keyboard users get the full
// deck. Gentle auto-advance every 6 seconds, paused while the visitor
// is hovering, focused inside, or has interacted, and disabled
// entirely under prefers-reduced-motion.
export function AnnouncementCarousel({ cards }: { cards: AnnouncementCard[] }) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState(0);
  const pausedRef = useRef(false);

  function scrollTo(index: number) {
    const track = trackRef.current;
    if (!track) return;
    const clamped = ((index % cards.length) + cards.length) % cards.length;
    const child = track.children[clamped] as HTMLElement | undefined;
    if (child) {
      track.scrollTo({ left: child.offsetLeft, behavior: "smooth" });
    }
  }

  // Track which card is in view as the user swipes.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    function onScroll() {
      if (!track) return;
      const children = [...track.children] as HTMLElement[];
      let best = 0;
      let bestDist = Number.POSITIVE_INFINITY;
      children.forEach((child, i) => {
        const dist = Math.abs(child.offsetLeft - track.scrollLeft);
        if (dist < bestDist) {
          bestDist = dist;
          best = i;
        }
      });
      setActive(best);
    }
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => track.removeEventListener("scroll", onScroll);
  }, []);

  // Auto-advance.
  useEffect(() => {
    if (cards.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      if (pausedRef.current) return;
      const track = trackRef.current;
      if (!track) return;
      const children = [...track.children] as HTMLElement[];
      let current = 0;
      children.forEach((child, i) => {
        if (Math.abs(child.offsetLeft - track.scrollLeft) < 8) current = i;
      });
      const next = (current + 1) % cards.length;
      track.scrollTo({ left: children[next]?.offsetLeft ?? 0, behavior: "smooth" });
    }, 6000);
    return () => clearInterval(id);
  }, [cards.length]);

  if (cards.length === 0) return null;

  return (
    <div
      onMouseEnter={() => (pausedRef.current = true)}
      onMouseLeave={() => (pausedRef.current = false)}
      onFocus={() => (pausedRef.current = true)}
      onBlur={() => (pausedRef.current = false)}
      onTouchStart={() => (pausedRef.current = true)}
    >
      <ul
        ref={trackRef}
        aria-label="Announcements"
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {cards.map((card) => {
          const inner = (
            <div className="flex h-full flex-col gap-3 sm:flex-row sm:gap-5">
              {card.imageUrl ? (
                <img
                  src={card.imageUrl}
                  alt=""
                  loading="lazy"
                  className="h-40 w-full rounded-xl object-cover sm:h-auto sm:w-48 sm:shrink-0"
                />
              ) : null}
              <div>
                <h3 className="text-h3 text-ignite-ink">{card.headline}</h3>
                <p className="mt-2 text-body text-ignite-muted">{card.body}</p>
                {card.linkUrl ? (
                  <p className="mt-3 text-small font-semibold text-ignite-red underline underline-offset-4">
                    Read more
                  </p>
                ) : null}
              </div>
            </div>
          );
          return (
            <li
              key={card.id}
              className="w-[85%] shrink-0 snap-start rounded-2xl border border-ignite-line bg-ignite-white p-6 sm:w-[70%] lg:w-[55%]"
            >
              {card.linkUrl ? (
                <a href={card.linkUrl} className="block h-full">
                  {inner}
                </a>
              ) : (
                inner
              )}
            </li>
          );
        })}
      </ul>

      {cards.length > 1 ? (
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            aria-label="Previous announcement"
            onClick={() => scrollTo(active - 1)}
            className="rounded-full border border-ignite-line bg-ignite-white px-4 py-2 text-small font-semibold text-ignite-ink hover:border-ignite-red"
          >
            Prev
          </button>
          <button
            type="button"
            aria-label="Next announcement"
            onClick={() => scrollTo(active + 1)}
            className="rounded-full border border-ignite-line bg-ignite-white px-4 py-2 text-small font-semibold text-ignite-ink hover:border-ignite-red"
          >
            Next
          </button>
          <div className="ml-1 flex gap-1.5" aria-hidden>
            {cards.map((card, i) => (
              <span
                key={card.id}
                className={`h-1.5 w-1.5 rounded-full ${i === active ? "bg-ignite-red" : "bg-ignite-line"}`}
              />
            ))}
          </div>
          <span className="sr-only" aria-live="polite">
            Announcement {active + 1} of {cards.length}
          </span>
        </div>
      ) : null}
    </div>
  );
}
