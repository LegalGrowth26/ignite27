import Image from "next/image";
import { Container } from "./Container";
import { Section } from "./Section";

// A wide band of two or three photos, no headings. Used on /attend and
// /exhibit to add atmosphere between content blocks. All srcs must be
// landscape webps from public/images/photos/ or public/images/brand/.
interface PhotoBandProps {
  photos: ReadonlyArray<{ src: string; alt: string }>;
  tone?: "light" | "cream";
}

export function PhotoBand({ photos, tone = "light" }: PhotoBandProps) {
  return (
    <Section tone={tone}>
      <Container>
        <div
          className={`grid gap-3 ${
            photos.length === 3
              ? "sm:grid-cols-3"
              : photos.length === 2
                ? "sm:grid-cols-2"
                : "sm:grid-cols-1"
          }`}
        >
          {photos.map((p) => (
            <figure
              key={p.src}
              className="relative aspect-[16/9] overflow-hidden rounded-2xl bg-ignite-line"
            >
              <Image
                src={p.src}
                alt={p.alt}
                fill
                loading="lazy"
                sizes={photos.length === 3 ? "(min-width: 640px) 33vw, 100vw" : "(min-width: 640px) 50vw, 100vw"}
                className="object-cover"
              />
            </figure>
          ))}
        </div>
      </Container>
    </Section>
  );
}
