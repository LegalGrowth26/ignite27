import type { ReactNode } from "react";

type SectionTone = "light" | "dark" | "cream";

type SectionProps = {
  children: ReactNode;
  tone?: SectionTone;
  id?: string;
  className?: string;
  as?: "section" | "div" | "footer" | "header";
};

const toneClasses: Record<SectionTone, string> = {
  light: "bg-ignite-white text-ignite-ink",
  dark: "bg-ignite-black text-ignite-white",
  cream: "bg-ignite-cream text-ignite-ink",
};

export function Section({
  children,
  tone = "light",
  id,
  className = "",
  as: Tag = "section",
}: SectionProps) {
  return (
    <Tag
      id={id}
      className={`py-section ${toneClasses[tone]} ${className}`}
    >
      {children}
    </Tag>
  );
}
