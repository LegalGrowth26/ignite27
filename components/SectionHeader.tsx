import type { ReactNode } from "react";

type HeadingLevel = "h1" | "h2" | "h3";

type SectionHeaderProps = {
  eyebrow?: string;
  heading: ReactNode;
  lede?: ReactNode;
  align?: "left" | "center";
  as?: HeadingLevel;
  tone?: "light" | "dark";
  className?: string;
};

const sizeByLevel: Record<HeadingLevel, string> = {
  h1: "text-h1",
  h2: "text-h2",
  h3: "text-h3",
};

export function SectionHeader({
  eyebrow,
  heading,
  lede,
  align = "left",
  as = "h2",
  tone = "light",
  className = "",
}: SectionHeaderProps) {
  const HeadingTag = as;
  const alignClass = align === "center" ? "text-center mx-auto" : "text-left";
  const maxWidth = align === "center" ? "max-w-3xl" : "";
  const ledeClass =
    tone === "dark" ? "text-white/75" : "text-ignite-muted";

  return (
    <div className={`${alignClass} ${maxWidth} ${className}`}>
      {eyebrow ? (
        <p className="text-eyebrow uppercase text-ignite-red mb-4">{eyebrow}</p>
      ) : null}
      <HeadingTag className={sizeByLevel[as]}>{heading}</HeadingTag>
      {lede ? (
        <p className={`text-lead mt-4 ${ledeClass}`}>{lede}</p>
      ) : null}
    </div>
  );
}
