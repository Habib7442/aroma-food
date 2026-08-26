"use client";

import { useState, useTransition } from "react";
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
import { deleteCuisine } from "./actions";

export function DeleteCuisineButton({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Not <AlertDialogAction> — Radix's Action always closes the dialog on
  // click regardless of outcome, which would hide a failure's error message
  // the instant it appeared. A plain button + controlled `open` lets the
  // dialog stay open on error and only close after a confirmed success.
  const onConfirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await deleteCuisine(id);
      if (result.error) setError(result.error);
      else setOpen(false);
    });
  };

  return (
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
          className="rounded-full border border-non-veg/30 bg-non-veg/10 px-3 py-1.5 text-xs font-medium text-non-veg transition-colors hover:bg-non-veg/20"
        >
          Delete
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &quot;{name}&quot;?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes it from the cuisine filters shown in the customer app. This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <p className="text-xs text-non-veg">{error}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <button
            type="button"
            disabled={isPending}
            onClick={onConfirm}
            className="rounded-md bg-non-veg px-4 py-2 text-sm font-medium text-white hover:bg-non-veg/90 disabled:opacity-50"
          >
            {isPending ? "Deleting…" : "Delete"}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
