import Image from "next/image";
import { Container } from "./Container";

export function Hero() {
  return (
    <section id="home" className="relative scroll-mt-24 overflow-hidden pt-8 pb-16 sm:pt-12 sm:pb-24">
      {/* Thinner Dark Arc Curve on the Right Side */}
      <div aria-hidden="true" className="pointer-events-none absolute top-0 right-0 bottom-0 hidden lg:block lg:w-[35%] xl:w-[38%]">
        <svg
          className="h-full w-full text-[#1f242d]"
          viewBox="0 0 400 800"
          fill="currentColor"
          preserveAspectRatio="none"
        >
          <path d="M 220 0 C 80 220, 80 580, 240 800 L 400 800 L 400 0 Z" />
        </svg>
      </div>

      <Container className="relative grid items-center gap-12 lg:grid-cols-2 lg:gap-12">
        <div className="z-10 lg:py-6">
          <span className="inline-flex items-center rounded-full border border-outline-variant bg-surface-container-low px-4 py-1.5 text-xs font-medium text-on-surface-variant">
            Now delivering across Silchar
          </span>

          <h1 className="mt-5 font-display text-4xl font-extrabold leading-tight tracking-[-0.02em] text-on-surface sm:text-5xl lg:text-[56px] lg:leading-[1.05]">
            Silchar&apos;s best food,
            <br />
            delivered <span className="text-primary">fresh.</span>
          </h1>

          <p className="mt-5 max-w-md text-base leading-6 text-on-surface-variant sm:text-lg sm:leading-7">
            Order from Silchar&apos;s favorite local restaurants and get hot, fresh
            food delivered to your door in under 30 minutes.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-5">
            <a
              href="#download"
              className="rounded-full bg-primary px-7 py-3.5 font-display text-sm font-bold text-on-primary transition-opacity hover:opacity-90"
            >
              Get Started
            </a>
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-center lg:justify-center">
          <div className="relative w-full max-w-[420px] sm:max-w-[480px]">
            {/* Dish Image */}
            <div className="relative aspect-square w-full">
              <Image
                src="/hero.webp"
                alt="A signature dish from a Zaavo restaurant partner"
                fill
                priority
                sizes="(min-width: 1024px) 45vw, 90vw"
                className="scale-[1.35] object-cover"
              />
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
