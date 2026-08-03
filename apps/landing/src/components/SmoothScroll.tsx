"use client";

import { useEffect } from "react";
import { useLenis } from "lenis/react";

// Matches the scroll-mt-24 (96px) used on anchored sections, clearing the sticky header.
const HEADER_OFFSET = -96;

/**
 * Intercepts in-page "#id" and "/#id" link clicks and scrolls smoothly
 * (via the global Lenis instance) instead of letting the browser
 * jump-and-append the hash to the URL. Links to a section on a *different*
 * page (e.g. "/#id" clicked from /terms) are left alone so they navigate
 * there normally.
 */
export function SmoothScroll() {
  const lenis = useLenis();

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const anchor = (event.target as HTMLElement).closest("a[href]");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;

      let hash: string | null = null;
      if (href.startsWith("#")) {
        hash = href;
      } else if (href.startsWith("/#") && window.location.pathname === "/") {
        hash = href.slice(1);
      }
      if (!hash || hash.length < 2) return;

      const target = document.getElementById(hash.slice(1));
      if (!target) return;

      event.preventDefault();

      if (lenis) {
        lenis.scrollTo(target, { offset: HEADER_OFFSET, duration: 1.2 });
      } else {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [lenis]);

  return null;
}
