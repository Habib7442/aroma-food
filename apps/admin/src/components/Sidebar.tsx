"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const NAV_ITEMS: { href: string; label: string; icon: ReactNode }[] = [
  {
    href: "/restaurants",
    label: "Restaurants",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9.5 12 4l9 5.5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 9.5V19a1 1 0 0 0 1 1h4v-5h4v5h4a1 1 0 0 0 1-1V9.5" />
      </svg>
    ),
  },
  {
    href: "/cuisines",
    label: "Cuisines",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 13a8 8 0 0 1 16 0Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 13h16v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z" />
      </svg>
    ),
  },
];

export function Sidebar({ children }: { children?: ReactNode }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-64 shrink-0 flex-col bg-primary px-4 py-6">
      <div className="px-2">
        <Image src="/brand/zaavo-wordmark-reversed.svg" alt="Zaavo" width={110} height={24} priority />
        <p className="mt-1 text-xs font-medium tracking-wide text-white/50">ADMIN</p>
      </div>

      <nav className="mt-8 flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                active ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex items-center gap-2 border-t border-white/10 pt-4">{children}</div>
    </aside>
  );
}
