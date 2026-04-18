import { Button } from "./Button";

type CtaActive = { label: string; href: string };
type CtaDisabled = { disabledLabel: string };

type PriceCardProps = {
  tier: string;
  tierTone?: "default" | "accent";
  chip?: string;
  price: string;
  included: readonly string[];
  summaryLine?: string;
  cta: CtaActive | CtaDisabled;
  emphasised?: boolean;
  extraNote?: string;
  footnote?: string;
  className?: string;
};

export function PriceCard({
  tier,
  tierTone = "default",
  chip,
  price,
  included,
  summaryLine,
  cta,
  emphasised = false,
  extraNote,
  footnote,
  className = "",
}: PriceCardProps) {
  const eyebrowColor = tierTone === "accent" ? "text-ignite-red" : "text-ignite-muted";
  const borderClass = emphasised
    ? "border-2 border-ignite-red shadow-sm md:-translate-y-1"
    : "border border-ignite-line";

  return (
    <div
      className={`relative flex h-full flex-col rounded-3xl bg-ignite-white p-6 sm:p-8 ${borderClass} ${className}`}
    >
      {chip ? (
        <span className="mb-4 inline-flex self-start rounded-full bg-ignite-ink/5 px-3 py-1 text-eyebrow uppercase text-ignite-muted">
          {chip}
        </span>
      ) : null}
      <p className={`text-eyebrow uppercase ${eyebrowColor}`}>{tier}</p>
      <p className="mt-3 text-h1">{price}</p>
      <ul className="mt-6 space-y-2.5 text-body">
        {included.map((item) => (
          <li key={item} className="flex gap-2.5">
            <span
              aria-hidden
              className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ignite-red"
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      {summaryLine ? (
        <p className="mt-5 text-body font-semibold">{summaryLine}</p>
      ) : null}
      {extraNote ? (
        <p className="mt-3 text-small text-ignite-muted">{extraNote}</p>
      ) : null}
      <div className="mt-auto pt-6">
        {"href" in cta ? (
          <Button href={cta.href} variant="primary" size="lg" className="w-full">
            {cta.label}
          </Button>
        ) : (
          <Button variant="secondary" size="lg" disabled className="w-full">
            {cta.disabledLabel}
          </Button>
        )}
      </div>
      {footnote ? (
        <p className="mt-3 text-small text-ignite-muted">{footnote}</p>
      ) : null}
    </div>
  );
}
