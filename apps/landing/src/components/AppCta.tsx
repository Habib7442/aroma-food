"use client";

import { useState } from "react";
import Image from "next/image";
import { Container } from "./Container";
import { ArrowRightIcon } from "./icons";

export function AppCta() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStore, setSelectedStore] = useState<"Google Play" | "App Store">("Google Play");

  const openWaitlistModal = (storeName: "Google Play" | "App Store") => {
    setSelectedStore(storeName);
    setIsModalOpen(true);
  };

  const handleJoinWaitlistWhatsapp = () => {
    const prefilledText = `Hi Zaavo Team, I would like to join the VIP Waitlist for early access to the Zaavo ${selectedStore} app in Silchar!`;
    const whatsappUrl = `https://wa.me/917637989226?text=${encodeURIComponent(prefilledText)}`;
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    setIsModalOpen(false);
  };

  return (
    <section id="download" className="scroll-mt-24 py-16 sm:py-24">
      <Container>
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#06180c] via-[#0b2915] to-[#032f12] px-8 py-14 text-white shadow-2xl sm:px-14 sm:py-20 lg:grid lg:grid-cols-2 lg:items-center lg:gap-16">
          {/* Background Ambient Glow */}
          <div aria-hidden="true" className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl" />

          {/* Left Text & Real Download Badges */}
          <div className="relative z-10">
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs font-bold text-amber-400">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              Available on iOS &amp; Android
            </span>

            <h2 className="mt-6 font-display text-3xl font-extrabold leading-tight tracking-[-0.02em] text-white sm:text-4xl lg:text-5xl">
              Get the <span className="text-amber-400">Zaavo app</span>
            </h2>

            <p className="mt-4 max-w-md text-base leading-relaxed text-[#a4b5a6] sm:text-lg">
              Track your order live, save your favorite Silchar restaurants, and get exclusive app-only discounts delivered straight to your doorstep.
            </p>

            {/* Official Store Buttons */}
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => openWaitlistModal("Google Play")}
                aria-label="Download Zaavo on Google Play"
                className="relative h-[52px] w-[176px] transition-transform hover:scale-105 active:scale-95"
              >
                <Image src="/Google Play.webp" alt="Get it on Google Play" fill sizes="176px" className="object-contain" />
              </button>

              <button
                type="button"
                onClick={() => openWaitlistModal("App Store")}
                aria-label="Download Zaavo on the App Store"
                className="relative h-[52px] w-[176px] transition-transform hover:scale-105 active:scale-95"
              >
                <Image src="/App Store.webp" alt="Download on the App Store" fill sizes="176px" className="object-contain" />
              </button>
            </div>
          </div>

          {/* Right Phone Mockups (Visible only on desktop screens) */}
          <div className="relative mt-12 z-10 hidden lg:flex items-center justify-center gap-5 lg:mt-0 lg:justify-end">
            {/* Phone 1 */}
            <div className="relative aspect-[9/19] w-52 sm:w-60 rounded-[2.5rem] border-[8px] border-[#181c24] ring-1 ring-white/30 bg-slate-950 p-2 shadow-2xl translate-y-6 transition-transform hover:-translate-y-1">
              <div className="relative h-full w-full overflow-hidden rounded-[2rem] bg-[#f9faf4]">
                <Image
                  src="/mobile_screen_1.webp"
                  alt="Zaavo Customer App Home Screen"
                  fill
                  sizes="(min-width: 1024px) 240px, 208px"
                  className="object-cover object-top"
                />
                <div className="absolute top-2 left-1/2 h-3.5 w-18 -translate-x-1/2 rounded-full bg-slate-900 z-20" />
              </div>
            </div>

            {/* Phone 2 */}
            <div className="relative aspect-[9/19] w-52 sm:w-60 rounded-[2.5rem] border-[8px] border-[#181c24] ring-1 ring-white/30 bg-slate-950 p-2 shadow-2xl -translate-y-6 transition-transform hover:-translate-y-8">
              <div className="relative h-full w-full overflow-hidden rounded-[2rem] bg-[#06180c]">
                <Image
                  src="/mobile_screen_2.webp"
                  alt="Zaavo Customer App Dish Detail"
                  fill
                  sizes="(min-width: 1024px) 240px, 208px"
                  className="object-cover object-top"
                />
                <div className="absolute top-2 left-1/2 h-3.5 w-18 -translate-x-1/2 rounded-full bg-slate-900 z-20" />
              </div>
            </div>
          </div>
        </div>
      </Container>

      {/* Coming Soon Waitlist Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md rounded-3xl border border-emerald-800/80 bg-[#06180c] p-6 sm:p-8 text-white shadow-2xl">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
            >
              ✕
            </button>

            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-400">
              🎉 Launching Soon in Silchar!
            </span>

            <h3 className="mt-4 font-display text-2xl font-extrabold text-white">
              Zaavo for {selectedStore} is Coming Soon!
            </h3>

            <p className="mt-3 text-sm leading-relaxed text-[#a4b5a6]">
              We are finalizing the official {selectedStore} release. Join our VIP Waitlist on WhatsApp to get early access alerts + exclusive launch discount coupons!
            </p>

            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={handleJoinWaitlistWhatsapp}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-500 px-6 py-3.5 font-display text-sm font-bold text-[#2a1800] transition-all hover:bg-amber-400 active:scale-95 shadow-lg"
              >
                <span>Join VIP Waitlist on WhatsApp</span>
                <ArrowRightIcon className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-xs text-slate-400 hover:text-white transition-colors"
              >
                Maybe later
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
