"use client";

import { useEffect } from "react";

/**
 * Intercepts in-page "#id" and "/#id" link clicks and scrolls smoothly to
 * the target instead of letting the browser jump-and-append the hash to
 * the URL. Links to a section on a *different* page (e.g. "/#id" clicked
 * from /terms) are left alone so they navigate there normally.
 */
export function SmoothScroll() {
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
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return null;
}
