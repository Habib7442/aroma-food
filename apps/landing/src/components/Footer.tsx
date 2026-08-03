"use client";

import Image from "next/image";
import { Container } from "./Container";
import { FacebookIcon, InstagramIcon, TwitterIcon } from "./icons";

const COLUMNS = [
  {
    heading: "Company",
    links: [
      { label: "About us", href: "/about" },
      { label: "Careers", href: "#" },
      { label: "Contact", href: "/contact" },
      { label: "Blog & News", href: "#" },
    ],
  },
  {
    heading: "For Restaurants",
    links: [
      { label: "Partner with Zaavo", href: "/#for-restaurants" },
      { label: "Vendor App", href: "/#for-restaurants" },
      { label: "Partner Guidelines", href: "#" },
    ],
  },
  {
    heading: "Legal & Safety",
    links: [
      { label: "Terms & conditions", href: "/terms" },
      { label: "Privacy policy", href: "/privacy" },
      { label: "Refund & cancellation", href: "/refund-policy" },
      { label: "FSSAI Compliance", href: "/fssai-compliance" },
    ],
  },
];

const SOCIALS = [
  { label: "Instagram", Icon: InstagramIcon, href: "#" },
  { label: "Facebook", Icon: FacebookIcon, href: "#" },
  { label: "Twitter", Icon: TwitterIcon, href: "#" },
];

export function Footer() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="relative bg-[#06180c] text-[#e2e3de] overflow-hidden">
      {/* Top Accent Gradient Border */}
      <div className="h-1 w-full bg-gradient-to-r from-emerald-600 via-amber-500 to-emerald-600" />

      {/* Main Footer Content */}
      <Container className="grid gap-12 py-16 sm:grid-cols-2 lg:grid-cols-[1.6fr_repeat(3,1fr)]">
        {/* Brand Column */}
        <div className="flex flex-col justify-between">
          <div>
            {/* Plain <a>, not <Link>: SmoothScroll intercepts native anchor clicks for hash targets */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/#home" aria-label="Zaavo Home" className="inline-block">
              <Image
                src="/brand/zaavo-wordmark-reversed.svg"
                alt="Zaavo"
                width={180}
                height={40}
                className="h-9 w-auto"
              />
            </a>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-[#a4b5a6]">
              Order from Silchar&apos;s favorite local restaurants and get hot, fresh food delivered to your door in minutes.
            </p>

            {/* Location Tag */}
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-800/60 bg-[#0b2413] px-3.5 py-1.5 text-xs text-[#87b48b]">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Delivering active in Silchar, Assam</span>
            </div>
          </div>

          {/* Social Links */}
          <div className="mt-8 flex items-center gap-3">
            {SOCIALS.map(({ label, Icon, href }) => (
              <a
                key={label}
                href={href}
                aria-label={label}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-800/80 bg-[#092211] text-[#a4b5a6] transition-all hover:border-amber-500 hover:bg-amber-500 hover:text-[#2a1800]"
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>

        {/* Links Columns */}
        {COLUMNS.map((column) => (
          <div key={column.heading}>
            <h4 className="font-display text-base font-bold tracking-wide text-white">
              {column.heading}
            </h4>
            <ul className="mt-5 space-y-3">
              {column.links.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="inline-block text-sm text-[#a4b5a6] transition-colors hover:text-amber-400"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Container>

      {/* Trust Highlights Bar */}
      <div className="border-t border-emerald-900/60 bg-[#041209] py-6">
        <Container className="grid grid-cols-1 gap-4 text-center sm:grid-cols-3 sm:text-left">
          <div className="flex items-center justify-center gap-3 sm:justify-start">
            <span className="text-xl">⚡</span>
            <div>
              <p className="text-xs font-bold text-white">Express Delivery</p>
              <p className="text-[11px] text-[#87b48b]">Under 30 mins to your door</p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-3 sm:justify-start">
            <span className="text-xl">🛡️</span>
            <div>
              <p className="text-xs font-bold text-white">100% Hygiene Verified</p>
              <p className="text-[11px] text-[#87b48b]">Partnered with FSSAI certified kitchens</p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-3 sm:justify-start">
            <span className="text-xl">💳</span>
            <div>
              <p className="text-xs font-bold text-white">Easy Payments</p>
              <p className="text-[11px] text-[#87b48b]">UPI, Cards, & Cash on Delivery</p>
            </div>
          </div>
        </Container>
      </div>

      {/* Bottom Legal & Copyright Bar */}
      <div className="border-t border-emerald-950 bg-[#030e07] py-6">
        <Container className="flex flex-col gap-4 text-xs text-[#718874] sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Zaavo. All rights reserved.</p>
          
          <div className="flex items-center gap-6">
            <p>Made with ❤️ for Silchar, Assam.</p>
            <button
              onClick={scrollToTop}
              className="flex items-center gap-1.5 rounded-full border border-emerald-900 bg-[#071f10] px-3 py-1 text-xs text-[#a4b5a6] transition-colors hover:border-amber-500 hover:text-white"
            >
              <span>Back to top</span>
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            </button>
          </div>
        </Container>
      </div>
    </footer>
  );
}
