import Image from "next/image";
import { Container } from "./Container";

const STEPS = [
  {
    number: "01",
    title: "Browse & Select",
    description: "Explore curated menus from top-rated local restaurants near you.",
    image: "/step_1.webp",
  },
  {
    number: "02",
    title: "Place Your Order",
    description: "Customize your meal, add special instructions, and pay securely.",
    image: "/step_2.webp",
  },
  {
    number: "03",
    title: "Fast Delivery",
    description: "Track your order in real-time as it travels from kitchen to door.",
    image: "/step_3.webp",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-24 py-14 sm:py-16">
      <Container>
        <div className="max-w-xl">
          <h2 className="font-display text-3xl font-extrabold tracking-[-0.01em] text-on-surface sm:text-4xl">
            Order in 3 simple steps
          </h2>
          <p className="mt-3 text-base text-on-surface-variant sm:text-lg">
            From craving to doorstep in under 30 minutes.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {STEPS.map((step) => (
            <div
              key={step.number}
              className="overflow-hidden rounded-lg border bg-surface-container-lowest"
              style={{ borderColor: "var(--color-card-border)" }}
            >
              <div className="relative aspect-square w-full">
                <Image
                  src={step.image}
                  alt={step.title}
                  fill
                  sizes="(min-width: 640px) 33vw, 100vw"
                  className="object-cover"
                />
              </div>
              <div className="p-6">
                <p className="tnum font-display text-sm font-bold text-secondary">{step.number}</p>
                <h3 className="mt-1 font-display text-lg font-bold text-on-surface">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-on-surface-variant">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
