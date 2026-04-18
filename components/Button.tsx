import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";

type Variant = "primary" | "secondary";
type Size = "md" | "lg";
type Tone = "light" | "dark";

type ButtonProps = {
  variant?: Variant;
  size?: Size;
  tone?: Tone;
  href?: string;
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  "aria-label"?: string;
  children: ReactNode;
};

const base =
  "inline-flex items-center justify-center font-semibold rounded-full transition-all duration-150 ease-out " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ignite-red focus-visible:ring-offset-2 " +
  "disabled:opacity-50 disabled:pointer-events-none select-none";

const sizeClasses: Record<Size, string> = {
  md: "h-11 px-5 text-small",
  lg: "h-14 px-8 text-body",
};

function variantClasses(variant: Variant, tone: Tone): string {
  if (variant === "primary") {
    return (
      "bg-ignite-red text-ignite-white shadow-[0_1px_0_0_rgba(0,0,0,0.05)] " +
      "hover:bg-ignite-red-hover hover:-translate-y-0.5 hover:shadow-lg " +
      "active:translate-y-0 active:shadow-md"
    );
  }
  if (tone === "dark") {
    return (
      "bg-transparent text-ignite-white border border-white/30 " +
      "hover:border-ignite-white hover:-translate-y-0.5 " +
      "focus-visible:ring-offset-ignite-black"
    );
  }
  return (
    "bg-transparent text-ignite-ink border border-ignite-line " +
    "hover:border-ignite-red hover:text-ignite-red hover:-translate-y-0.5"
  );
}

export function Button({
  variant = "primary",
  size = "md",
  tone = "light",
  href,
  type = "button",
  disabled,
  onClick,
  className = "",
  "aria-label": ariaLabel,
  children,
}: ButtonProps) {
  const classes = `${base} ${sizeClasses[size]} ${variantClasses(variant, tone)} ${className}`;

  if (href) {
    return (
      <Link href={href} aria-label={ariaLabel} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
      className={classes}
    >
      {children}
    </button>
  );
}
