"use client";

import { useEffect, useState } from "react";

// Pure, router-agnostic: owns only the debounce and the input's own local
// state. The caller decides what "search" means — push a URL param, filter
// in-memory data, whatever — via onSearch, and owns any pending/transition
// state itself (passed back in via `isPending`) since that's tied to
// whatever navigation/fetch mechanism the caller uses.
export function DebouncedSearchBox({
  defaultValue = "",
  placeholder,
  onSearch,
  isPending = false,
  delayMs = 300,
  className,
}: {
  defaultValue?: string;
  placeholder: string;
  onSearch: (value: string) => void;
  isPending?: boolean;
  delayMs?: number;
  className?: string;
}) {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    const timer = setTimeout(() => onSearch(value), delayMs);
    return () => clearTimeout(timer);
    // Deliberately re-running only on `value` — including onSearch/delayMs
    // would re-fire the debounce whenever the caller re-renders with a new
    // (but behaviorally identical) function reference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className={`relative ${className ?? ""}`}>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-primary focus:border-primary focus:outline-none"
      />
      {isPending ? (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary/50"
        >
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
          <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      ) : null}
    </div>
  );
}
