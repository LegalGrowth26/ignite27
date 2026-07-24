import Image from "next/image";

// A single speaker tile. Photo variant renders a next/image portrait; when
// a real headshot isn't available yet, `initials` mode renders an elegant
// initials monogram on brand background. Both variants share the same
// outer footprint so the row stays visually uniform.
interface Photo {
  variant: "photo";
  src: string;
  alt: string;
}
interface Initials {
  variant: "initials";
  initials: string; // e.g. "SR"
}
interface Placeholder {
  variant: "placeholder";
  label: string; // e.g. "More speakers announced soon"
}

interface SpeakerCardProps {
  name?: string;
  topic?: string;
  media: Photo | Initials | Placeholder;
}

export function SpeakerCard({ name, topic, media }: SpeakerCardProps) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-ignite-line bg-ignite-white">
      <div className="relative aspect-square bg-ignite-cream">
        {media.variant === "photo" ? (
          <Image
            src={media.src}
            alt={media.alt}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
          />
        ) : media.variant === "initials" ? (
          <div className="flex h-full w-full items-center justify-center bg-ignite-black">
            <span
              aria-hidden
              className="font-bold text-ignite-white opacity-90"
              style={{ fontSize: "5rem", letterSpacing: "-0.04em" }}
            >
              {media.initials}
            </span>
            <span className="sr-only">{name ?? "Speaker"} — photo coming soon</span>
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-ignite-red/10">
            <span aria-hidden className="text-eyebrow uppercase text-ignite-red">
              Coming soon
            </span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        {media.variant === "placeholder" ? (
          <>
            <p className="text-eyebrow uppercase text-ignite-red">Watch this space</p>
            <p className="text-h3 text-ignite-ink">{media.label}</p>
            <p className="text-small text-ignite-muted">
              The 2027 line-up is being finalised. New names announced soon.
            </p>
          </>
        ) : (
          <>
            <p className="text-eyebrow uppercase text-ignite-red">Speaker</p>
            <p className="text-h3 text-ignite-ink">{name}</p>
            {topic ? <p className="text-body text-ignite-muted">{topic}</p> : null}
            {media.variant === "initials" ? (
              <p className="mt-1 text-small italic text-ignite-muted">Photo coming soon.</p>
            ) : null}
          </>
        )}
      </div>
    </article>
  );
}
