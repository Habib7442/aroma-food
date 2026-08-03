"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Container } from "./Container";

const NAV_LINKS = [
  { label: "Home", href: "/#home" },
  { label: "Popular near you", href: "/#popular" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "For restaurants", href: "/#for-restaurants" },
  { label: "Contact", href: "/contact" },
];

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Lock body scroll when mobile sheet is open
  useEffect(() => {
    if (isSheetOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
  }, [isSheetOpen]);

  return (
    <>
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${
          isScrolled
            ? "border-b border-outline-variant/50 bg-surface-container-lowest/90 backdrop-blur-md shadow-sm"
            : "border-b border-transparent bg-transparent"
        }`}
      >
        <Container className="flex h-16 items-center justify-between">
          {/* Plain <a>, not <Link>: SmoothScroll intercepts native anchor clicks for hash targets */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/#home" aria-label="Zaavo">
            <Image src="/brand/zaavo-wordmark-black.svg" alt="Zaavo" width={128} height={28} priority />
          </a>

          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-on-surface-variant transition-colors hover:text-on-surface"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- see SmoothScroll note above */}
            <a
              href="/#download"
              className="hidden sm:inline-flex rounded-full bg-primary px-5 py-2.5 font-display text-sm font-semibold text-on-primary transition-opacity hover:opacity-90"
            >
              Get the app
            </a>

            {/* Mobile Hamburger Button */}
            <button
              type="button"
              onClick={() => setIsSheetOpen(true)}
              aria-label="Open mobile navigation menu"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant/60 bg-surface-container-lowest text-on-surface transition-transform active:scale-95 md:hidden"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </Container>
      </header>

      {/* Mobile Sheet Overlay & Navigation Drawer */}
      {isSheetOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          {/* Backdrop */}
          <div
            onClick={() => setIsSheetOpen(false)}
            aria-hidden="true"
            className="fixed inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
          />

          {/* Sheet Panel */}
          <div className="fixed inset-y-0 right-0 w-full max-w-xs bg-[#06180c] border-l border-emerald-800/60 p-6 text-white shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-300">
            <div>
              {/* Sheet Header */}
              <div className="flex items-center justify-between border-b border-emerald-900/60 pb-5">
                <Image
                  src="/brand/zaavo-wordmark-reversed.svg"
                  alt="Zaavo"
                  width={110}
                  height={24}
                />
                <button
                  type="button"
                  onClick={() => setIsSheetOpen(false)}
                  aria-label="Close navigation menu"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
                >
                  ✕
                </button>
              </div>

              {/* Sheet Navigation Links */}
              <nav className="mt-8 flex flex-col gap-3">
                {NAV_LINKS.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsSheetOpen(false)}
                    className="flex items-center justify-between rounded-xl border border-emerald-900/40 bg-emerald-950/40 px-4 py-3.5 font-display text-base font-semibold text-[#e2e3de] transition-colors hover:border-amber-500/50 hover:bg-emerald-900/60 hover:text-white"
                  >
                    <span>{link.label}</span>
                    <span className="text-emerald-500">→</span>
                  </a>
                ))}
              </nav>
            </div>

            {/* Sheet Footer */}
            <div className="space-y-4 pt-6 border-t border-emerald-900/60">
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- see SmoothScroll note above */}
              <a
                href="/#download"
                onClick={() => setIsSheetOpen(false)}
                className="flex w-full items-center justify-center rounded-full bg-amber-500 py-3.5 font-display text-sm font-bold text-[#2a1800] transition-transform active:scale-95 shadow-md"
              >
                Get the app
              </a>

              <a
                href="https://wa.me/917637989226?text=Hi%20Zaavo%20Team%2C%20I%20have%20an%20inquiry."
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 text-xs font-semibold text-[#87b48b] hover:text-amber-400"
              >
                <span>💬 WhatsApp Support (+91 7637989226)</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
