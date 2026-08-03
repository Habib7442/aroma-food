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

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        isScrolled
          ? "border-b border-outline-variant/50 bg-surface-container-lowest/90 backdrop-blur-md shadow-sm"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <Container className="flex h-16 items-center justify-between">
        <a href="/#home" aria-label="Zaavo">
          <Image src="/brand/zaavo-wordmark-black.svg" alt="Zaavo" width={128} height={28} priority />
        </a>

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

        <a
          href="/#download"
          className="rounded-full bg-primary px-5 py-2.5 font-display text-sm font-semibold text-on-primary transition-opacity hover:opacity-90"
        >
          Get the app
        </a>
      </Container>
    </header>
  );
}
