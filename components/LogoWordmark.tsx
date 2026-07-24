import Image from "next/image";
import Link from "next/link";

type LogoWordmarkProps = {
  tone?: "light" | "dark";
  className?: string;
};

// The logo asset lives at public/images/brand/logo.png (800px wide, palette
// PNG with alpha). The SVG at logo.svg wraps the same PNG for cases where a
// scalable asset is preferred (favicon, share image). Aspect ratio 2880:1292.
const LOGO_ASPECT = 2880 / 1292;
const HEIGHT = 44;
const WIDTH = Math.round(HEIGHT * LOGO_ASPECT);

export function LogoWordmark({ tone = "light", className = "" }: LogoWordmarkProps) {
  return (
    <Link
      href="/"
      aria-label="Ignite 27, home"
      className={`inline-flex items-center ${className}`}
    >
      <Image
        src="/images/brand/logo.png"
        alt=""
        width={WIDTH}
        height={HEIGHT}
        priority
        // Slight brightness bump on dark backgrounds keeps a mixed-tone
        // wordmark legible without needing a second asset.
        className={tone === "dark" ? "brightness-110" : ""}
      />
    </Link>
  );
}
