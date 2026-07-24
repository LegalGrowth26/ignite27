import Image from "next/image";
import Link from "next/link";

type LogoWordmarkProps = {
  tone?: "light" | "dark";
  className?: string;
};

// The wordmark asset lives at public/images/brand/wordmark-a.png. This
// is the red "IGNITE!" typography on transparent background. Reads on
// both light and dark surfaces without a second asset. Source aspect
// ratio is 2000:600 (~3.33:1). We constrain by HEIGHT so a taller
// header row doesn't inflate the width, and set width via the aspect
// ratio.
//
// The other file, logo.png (2880x1292 dark decorative slash mark), is
// the favicon source, not the header wordmark. Do not swap.
const WORDMARK_ASPECT = 2000 / 600;
const HEIGHT = 40;
const WIDTH = Math.round(HEIGHT * WORDMARK_ASPECT);

export function LogoWordmark({ tone = "light", className = "" }: LogoWordmarkProps) {
  // Slight brightness bump on dark backgrounds keeps the red typography
  // legible without shipping a separate white-on-red asset.
  const toneClass = tone === "dark" ? "brightness-110 saturate-125" : "";
  return (
    <Link
      href="/"
      aria-label="Ignite 27, home"
      className={`inline-flex items-center ${className}`}
    >
      <Image
        src="/images/brand/wordmark-a.png"
        alt=""
        width={WIDTH}
        height={HEIGHT}
        priority
        // Height-constrained: `h-10` locks vertical; `w-auto` derives
        // width from the intrinsic aspect ratio. Prevents the cropped
        // dark-rectangle bug that came from pointing at the wrong asset
        // (the dark decorative mark) with a stretched-width container.
        className={`h-10 w-auto ${toneClass}`}
      />
    </Link>
  );
}
