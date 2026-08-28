"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deletePlatformBanner, togglePlatformBannerActive, type PlatformBannerMediaType } from "./actions";

function youtubeThumbnail(url: string): string | null {
  const match = url.match(/(?:v=|youtu\.be\/)([\w-]+)/);
  return match ? `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg` : null;
}

export function PromoRow({
  id,
  mediaType,
  mediaUrl,
  sortOrder,
  isActive,
}: {
  id: string;
  mediaType: PlatformBannerMediaType;
  mediaUrl: string;
  sortOrder: number;
  isActive: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();
  const [isToggling, startToggleTransition] = useTransition();

  // Not <AlertDialogAction> — see DeleteCuisineButton.tsx's identical
  // comment: Radix's Action always closes on click regardless of outcome,
  // which would hide a failure's error message the instant it appeared.
  const onConfirmDelete = () => {
    setError(null);
    startDeleteTransition(async () => {
      const result = await deletePlatformBanner(id, mediaType, mediaUrl);
      if (result.error) setError(result.error);
      else {
        setOpen(false);
        toast.success("Promo deleted.");
      }
    });
  };

  const onToggleActive = () => {
    startToggleTransition(async () => {
      const result = await togglePlatformBannerActive(id, !isActive);
      if (result.error) toast.error(result.error);
    });
  };

  return (
    <div className="flex items-center gap-4 border-b border-border p-4 last:border-b-0">
      <div className="h-16 w-28 shrink-0 overflow-hidden rounded-lg border border-border bg-background">
        {mediaType === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL; not worth Next/Image's remote-pattern config for an admin-only thumbnail
          <img src={mediaUrl} alt="" className="h-full w-full object-cover" />
        ) : mediaType === "video" ? (
          <video src={mediaUrl} className="h-full w-full object-cover" muted />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={youtubeThumbnail(mediaUrl) ?? undefined} alt="" className="h-full w-full object-cover" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <span className="inline-block rounded-full bg-background px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-primary-dark">
          {mediaType}
        </span>
        <a href={mediaUrl} target="_blank" rel="noreferrer" className="mt-1 block truncate text-sm text-primary hover:underline">
          {mediaUrl}
        </a>
        <span className="text-xs text-primary-dark">Sort {sortOrder}</span>
      </div>

      <button
        type="button"
        onClick={onToggleActive}
        disabled={isToggling}
        className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
          isActive ? "border-veg/30 bg-veg/10 text-veg" : "border-border bg-background text-primary-dark"
        }`}
      >
        {isActive ? "Active" : "Hidden"}
      </button>

      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setError(null);
        }}
      >
        <AlertDialogTrigger asChild>
          <button
            type="button"
            className="shrink-0 rounded-full border border-non-veg/30 bg-non-veg/10 px-3 py-1.5 text-xs font-medium text-non-veg transition-colors hover:bg-non-veg/20"
          >
            Delete
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this promo?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes it from the customer app&apos;s home carousel immediately. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error ? <p className="text-xs text-non-veg">{error}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <button
              type="button"
              disabled={isDeleting}
              onClick={onConfirmDelete}
              className="rounded-md bg-non-veg px-4 py-2 text-sm font-medium text-white hover:bg-non-veg/90 disabled:opacity-50"
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
