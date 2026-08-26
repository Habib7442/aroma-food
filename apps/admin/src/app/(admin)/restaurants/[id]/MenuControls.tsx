"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition, type ReactNode } from "react";
import { DebouncedSearchBox } from "@/components/DebouncedSearchBox";

// Owns both the search box and the menu's Previous/Next buttons through a
// single useTransition, so isPending reflects "is the menu section
// specifically updating" — not the whole page. children (the
// server-rendered category/dish list) dims and stops accepting clicks
// while pending, instead of the page just sitting frozen with no feedback.
export function MenuControls({
  page,
  totalPages,
  isSearching,
  children,
}: {
  page: number;
  totalPages: number;
  isSearching: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const navigate = (params: URLSearchParams) => {
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  };

  const onSearch = (value: string) => {
    if (value === (searchParams.get("menuQuery") ?? "")) return;
    const params = new URLSearchParams(searchParams.toString());
    if (value.trim()) params.set("menuQuery", value.trim());
    else params.delete("menuQuery");
    params.delete("menuPage");
    navigate(params);
  };

  const goToPage = (target: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (target > 1) params.set("menuPage", String(target));
    else params.delete("menuPage");
    navigate(params);
  };

  return (
    <div>
      <DebouncedSearchBox
        defaultValue={searchParams.get("menuQuery") ?? ""}
        placeholder="Search this menu by dish name"
        onSearch={onSearch}
        isPending={isPending}
      />

      <div className={isPending ? "pointer-events-none opacity-40 transition-opacity" : "transition-opacity"}>
        {children}
      </div>

      {!isSearching && totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm">
          <button
            type="button"
            disabled={page <= 1 || isPending}
            onClick={() => goToPage(page - 1)}
            className={`rounded-full border border-border px-3 py-1.5 font-medium ${
              page <= 1 || isPending ? "text-border" : "text-primary hover:border-primary/30"
            }`}
          >
            Previous
          </button>
          <span className="text-primary-dark">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages || isPending}
            onClick={() => goToPage(page + 1)}
            className={`rounded-full border border-border px-3 py-1.5 font-medium ${
              page >= totalPages || isPending ? "text-border" : "text-primary hover:border-primary/30"
            }`}
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
