"use client";

import { useActionState, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { updateRestaurant, type UpdateRestaurantState } from "./actions";
import type { GstStatus, RestaurantStatus } from "@zaavo/shared";

interface RestaurantForForm {
  status: RestaurantStatus;
  commission_rate_bps: number;
  gst_status: GstStatus;
  is_pure_veg: boolean;
}

const initialState: UpdateRestaurantState = {};

const STATUS_LABELS: Record<RestaurantStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  suspended: "Suspended",
};

export function RestaurantApprovalForm({ id, restaurant }: { id: string; restaurant: RestaurantForForm }) {
  const boundAction = updateRestaurant.bind(null, id);
  const [state, formAction, isPending] = useActionState(boundAction, initialState);
  const [statusValue, setStatusValue] = useState<RestaurantStatus>(restaurant.status);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const isDowngrade = (statusValue === "rejected" || statusValue === "suspended") && statusValue !== restaurant.status;

  const onSaveClick = () => {
    if (isDowngrade) setConfirmOpen(true);
    else formRef.current?.requestSubmit();
  };

  const onConfirmDowngrade = () => {
    setConfirmOpen(false);
    formRef.current?.requestSubmit();
  };

  return (
    <>
      <form
        ref={formRef}
        action={formAction}
        className="flex h-fit flex-col gap-5 rounded-card border border-border bg-card p-6 @3xl/page:sticky @3xl/page:top-8"
      >
        <h2 className="text-sm font-semibold text-primary">Approval &amp; commission</h2>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-primary-dark">Status</span>
          <select
            name="status"
            value={statusValue}
            onChange={(e) => setStatusValue(e.target.value as RestaurantStatus)}
            className="rounded-xl border border-border bg-background px-3.5 py-2.5 text-primary focus:border-primary focus:outline-none"
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="suspended">Suspended</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-primary-dark">Commission rate (%)</span>
          <input
            type="number"
            name="commission_rate_percent"
            step="0.01"
            min="0"
            max="100"
            defaultValue={(restaurant.commission_rate_bps / 100).toFixed(2)}
            className="rounded-xl border border-border bg-background px-3.5 py-2.5 text-primary focus:border-primary focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-primary-dark">GST status</span>
          <select
            name="gst_status"
            defaultValue={restaurant.gst_status}
            className="rounded-xl border border-border bg-background px-3.5 py-2.5 text-primary focus:border-primary focus:outline-none"
          >
            <option value="unregistered">Unregistered</option>
            <option value="composition">Composition</option>
            <option value="registered">Registered</option>
          </select>
        </label>

        <label className="flex items-center gap-2.5 text-sm text-primary-dark">
          <input type="checkbox" name="is_pure_veg" defaultChecked={restaurant.is_pure_veg} className="h-4 w-4 accent-veg" />
          Pure veg restaurant
        </label>

        {state.error ? (
          <p className="rounded-lg bg-non-veg/10 px-3 py-2 text-xs text-non-veg">{state.error}</p>
        ) : state.savedAt ? (
          <p className="rounded-lg bg-veg/10 px-3 py-2 text-xs text-veg">Saved.</p>
        ) : null}

        <button
          type="button"
          onClick={onSaveClick}
          disabled={isPending}
          className="mt-1 self-start rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save changes"}
        </button>
      </form>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Set status to {STATUS_LABELS[statusValue]}?</AlertDialogTitle>
            <AlertDialogDescription>
              {statusValue === "suspended"
                ? "This immediately takes the restaurant off the customer app until it's reactivated."
                : "This rejects the restaurant's application. They won't appear to customers."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <button
              type="button"
              onClick={onConfirmDowngrade}
              className="rounded-md bg-non-veg px-4 py-2 text-sm font-medium text-white hover:bg-non-veg/90"
            >
              {STATUS_LABELS[statusValue]}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
