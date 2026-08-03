import Image from "next/image";
import { Container } from "./Container";

const FEATURES = [
  {
    icon: "🏪",
    title: "Real local restaurants",
    description: "Every partner is based right here in Silchar, verified before they go live.",
  },
  {
    icon: "⚡",
    title: "Fast local delivery",
    description: "Direct dispatch from Silchar kitchens to your doorstep in 30 minutes or less.",
  },
  {
    icon: "🤝",
    title: "Fair for vendors too",
    description: "Transparent commissions so local restaurants keep more of what they earn.",
  },
];

export function WhyZaavo() {
  return (
    <section id="for-restaurants" className="scroll-mt-24 py-14 sm:py-16">
      <Container className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div className="relative">
          <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl">
            <Image
              src="/decorative_dish.webp"
              alt="Fish curry from a Zaavo restaurant partner"
              fill
              sizes="(min-width: 1024px) 40vw, 90vw"
              className="object-cover"
            />
          </div>
          <div className="absolute -right-4 -top-4 flex h-16 w-16 flex-col items-center justify-center rounded-full bg-secondary-container text-center font-display font-extrabold text-on-secondary-container">
            <span className="text-lg leading-none">20%</span>
            <span className="text-[10px] leading-none">off</span>
          </div>
        </div>

        <div>
          <h2 className="font-display text-3xl font-extrabold tracking-[-0.01em] text-on-surface sm:text-4xl">
            Made for Silchar, not copied from a metro app
          </h2>
          <p className="mt-4 max-w-md text-base leading-6 text-on-surface-variant sm:text-lg sm:leading-7">
            A good food delivery app doesn&apos;t need to be complicated — it can be
            simple, fast, and built around the restaurants you already trust.
          </p>

          <div className="mt-8 space-y-4">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="flex items-start gap-4 rounded-xl border bg-surface-container-lowest p-4 transition-all hover:shadow-md"
                style={{ borderColor: "var(--color-card-border)" }}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl">
                  {feature.icon}
                </div>
                <div>
                  <h3 className="font-display text-base font-bold text-on-surface">{feature.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-on-surface-variant">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>

          <a
            href="#download"
            className="mt-8 inline-flex rounded-full bg-primary px-8 py-3.5 font-display text-sm font-bold text-on-primary transition-all hover:opacity-95 shadow-md hover:shadow-lg active:scale-95"
          >
            Get Started
          </a>
        </div>
      </Container>
    </section>
  );
}
