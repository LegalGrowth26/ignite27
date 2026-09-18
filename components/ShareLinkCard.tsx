"use client";

import { useState } from "react";

// Copy + native-share controls for the ambassador's link. Native share
// where the browser offers it (mobile), clipboard everywhere.
export function ShareLinkCard({ shareUrl }: { shareUrl: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the visible URL below is selectable.
    }
  }

  async function share() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: "IGNITE! 27",
          text: "Join me at IGNITE! 27, Thursday 21 January at Kelham Hall.",
          url: shareUrl,
        });
        return;
      } catch {
        // Cancelled or unsupported mid-flight; fall through to copy.
      }
    }
    await copy();
  }

  return (
    <div>
      <p className="break-all rounded-xl border border-ignite-line bg-ignite-cream p-3 font-mono text-small text-ignite-ink">
        {shareUrl}
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={copy}
          className="rounded-full bg-ignite-red px-5 py-2 text-small font-semibold text-ignite-white hover:bg-ignite-red-hover"
        >
          {copied ? "Copied!" : "Copy link"}
        </button>
        <button
          type="button"
          onClick={share}
          className="rounded-full border border-ignite-line bg-ignite-white px-5 py-2 text-small font-semibold text-ignite-ink hover:border-ignite-red"
        >
          Share
        </button>
      </div>
    </div>
  );
}
