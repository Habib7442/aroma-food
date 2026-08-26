"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { DebouncedSearchBox } from "@/components/DebouncedSearchBox";

export function RestaurantsSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const onSearch = (value: string) => {
    if (value === (searchParams.get("query") ?? "")) return;
    const params = new URLSearchParams(searchParams.toString());
    if (value.trim()) params.set("query", value.trim());
    else params.delete("query");
    params.delete("page");
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  };

  return (
    <DebouncedSearchBox
      defaultValue={searchParams.get("query") ?? ""}
      placeholder="Search restaurants by name"
      onSearch={onSearch}
      isPending={isPending}
      className="mt-4"
    />
  );
}
