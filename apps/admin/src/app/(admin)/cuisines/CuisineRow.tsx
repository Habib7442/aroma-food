"use client";

import { useState, useTransition } from "react";
import { DeleteCuisineButton } from "./DeleteCuisineButton";
import { updateCuisine } from "./actions";

// Controlled inputs + onClick (not a <form>) rather than the usual Server
// Action <form> pattern — a <form> isn't valid HTML nested directly inside
// a <table>/<tr>, and this row needs to render as a <tr> to line up with
// the table's columns.
export function CuisineRow({ id, name, sortOrder }: { id: string; name: string; sortOrder: number }) {
  const [isEditing, setIsEditing] = useState(false);
  const [nameValue, setNameValue] = useState(name);
  const [sortValue, setSortValue] = useState(String(sortOrder));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onCancel = () => {
    setNameValue(name);
    setSortValue(String(sortOrder));
    setError(null);
    setIsEditing(false);
  };

  const onSave = () => {
    setError(null);
    startTransition(async () => {
      const result = await updateCuisine(id, { name: nameValue, sortOrder: Number(sortValue) || 0 });
      if (result.error) setError(result.error);
      else setIsEditing(false);
    });
  };

  if (isEditing) {
    return (
      <tr className="border-b border-border last:border-0">
        <td className="px-5 py-3">
          <input
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            autoFocus
            className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-primary focus:border-primary focus:outline-none"
          />
          {error ? <p className="mt-1.5 text-xs text-non-veg">{error}</p> : null}
        </td>
        <td className="px-5 py-3">
          <input
            value={sortValue}
            onChange={(e) => setSortValue(e.target.value)}
            type="number"
            className="w-20 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-primary focus:border-primary focus:outline-none"
          />
        </td>
        <td className="px-5 py-3 text-right">
          <div className="inline-flex gap-2">
            <button
              type="button"
              onClick={onSave}
              disabled={isPending}
              className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-primary-dark hover:bg-background"
            >
              Cancel
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-border last:border-0 hover:bg-background/60">
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary/15 text-xs font-semibold text-secondary-dark">
            {name.charAt(0).toUpperCase()}
          </span>
          <span className="font-medium text-primary">{name}</span>
        </div>
      </td>
      <td className="px-5 py-3.5">
        <span className="whitespace-nowrap rounded-full bg-border px-2.5 py-1 text-xs font-medium text-primary-dark">
          sort {sortOrder}
        </span>
      </td>
      <td className="px-5 py-3.5 text-right">
        <div className="inline-flex gap-2">
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
          >
            Edit
          </button>
          <DeleteCuisineButton id={id} name={name} />
        </div>
      </td>
    </tr>
  );
}
