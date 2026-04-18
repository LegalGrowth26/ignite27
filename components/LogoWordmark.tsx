import Link from "next/link";

type LogoWordmarkProps = {
  tone?: "light" | "dark";
  className?: string;
};

export function LogoWordmark({ tone = "light", className = "" }: LogoWordmarkProps) {
  const textColour = tone === "dark" ? "text-ignite-white" : "text-ignite-ink";
  return (
    <Link
      href="/"
      aria-label="Ignite 27, home"
      className={`inline-flex items-baseline font-bold text-lg tracking-tight ${textColour} ${className}`}
    >
      <span>Ignite</span>
      <span aria-hidden className="mx-[2px] inline-block h-1.5 w-1.5 translate-y-[-2px] rounded-full bg-ignite-red" />
      <span>27</span>
    </Link>
  );
}
