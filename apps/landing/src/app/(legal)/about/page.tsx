import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "About Us — Zaavo",
  description: "Why Zaavo exists and what we're building for Silchar, Assam.",
};

const VALUES = [
  {
    icon: "🏪",
    title: "Local-first",
    badge: "Community Focused",
    description:
      "Every restaurant on Zaavo is a real, independent kitchen in Silchar — not a metro chain reskinned for a new city.",
  },
  {
    icon: "🤝",
    title: "Fair for restaurants",
    badge: "Transparent Payouts",
    description:
      "Transparent commissions and fast payouts, so the culinary partners who make the food actually keep more of what they earn.",
  },
  {
    icon: "⚡",
    title: "Built for how Silchar orders",
    badge: "Fast & Reliable",
    description:
      "Fast, simple, and reliable — no bloated features borrowed from apps designed for a different city entirely.",
  },
];

const STATS = [
  { value: "100%", label: "Local Silchar Focus" },
  { value: "<30m", label: "Average Delivery Time" },
  { value: "0%", label: "Hidden Menu Markup" },
];

export default function AboutPage() {
  return (
    <article className="space-y-16">
      {/* Header / Story Hero Section */}
      <div className="space-y-6">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-semibold text-primary">
          <span className="h-2 w-2 rounded-full bg-primary" />
          Our Story &amp; Mission
        </span>

        <h1 className="font-display text-4xl font-extrabold tracking-[-0.02em] text-on-surface sm:text-5xl lg:leading-tight">
          Building a food delivery platform <span className="text-primary">specifically for Silchar.</span>
        </h1>

        <div className="space-y-4 text-base leading-relaxed text-on-surface-variant sm:text-lg">
          <p>
            Zaavo was born out of a simple observation: Silchar deserved a delivery experience that actually understands the city — its unique food culture, its streets, its favorite local restaurants, and the people ordering from them.
          </p>
          <p>
            Instead of copying an app designed for a metro city and dropping it into a new region, we built Zaavo from the ground up to connect people directly with the local kitchens they already know and trust.
          </p>
        </div>
      </div>

      {/* Impact Stats Highlight Bar */}
      <div className="grid grid-cols-3 gap-4 rounded-xl border border-[var(--color-card-border)] bg-surface-container-lowest p-6 shadow-sm">
        {STATS.map((stat, index) => (
          <div
            key={stat.label}
            className={`text-center ${index > 0 ? "border-l border-outline-variant/40" : ""}`}
          >
            <p className="tnum font-display text-2xl font-extrabold text-primary sm:text-3xl">
              {stat.value}
            </p>
            <p className="mt-1 text-xs font-medium text-on-surface-variant sm:text-sm">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Core Values Section */}
      <div className="space-y-8">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-on-surface sm:text-3xl">
            What drives Zaavo
          </h2>
          <p className="mt-2 text-base text-on-surface-variant">
            Our core principles for supporting local kitchens and diners.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          {VALUES.map((value) => (
            <div
              key={value.title}
              className="group flex flex-col justify-between rounded-xl border bg-surface-container-lowest p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
              style={{ borderColor: "var(--color-card-border)" }}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-3xl">{value.icon}</span>
                  <span className="rounded-full bg-surface-container-low px-2.5 py-1 text-[11px] font-semibold text-on-surface-variant">
                    {value.badge}
                  </span>
                </div>
                <h3 className="mt-5 font-display text-lg font-bold text-on-surface group-hover:text-primary">
                  {value.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
                  {value.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Partner Call to Action Card */}
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-[#06180c] to-[#0d2e18] p-8 text-white shadow-xl sm:p-10">
        <div className="max-w-xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-400">
            For Restaurant Owners
          </span>
          <h2 className="mt-4 font-display text-2xl font-extrabold text-white sm:text-3xl">
            Want to bring your restaurant onto Zaavo?
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[#a4b5a6] sm:text-base">
            Partner with us to reach thousands of food lovers across Silchar with transparent commissions, fast payouts, and dedicated local support.
          </p>
          
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/#for-restaurants"
              className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-7 py-3.5 font-display text-sm font-bold text-[#2a1800] transition-all hover:bg-amber-400 active:scale-95 shadow-md"
            >
              <span>Partner with Zaavo</span>
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-6 py-3.5 font-display text-sm font-semibold text-white transition-colors hover:bg-white/20"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
