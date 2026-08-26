"use client";

import { useActionState, useEffect, useRef } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { createCuisine, type CuisineFormState } from "./actions";

const initialState: CuisineFormState = {};

export function CreateCuisineForm() {
  const [state, formAction] = useActionState(createCuisine, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  // Only resets on an actual successful submit (no error) — a failed
  // submit leaves what the admin typed in place so they can fix it.
  useEffect(() => {
    if (!state.error && formRef.current) formRef.current.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="mt-5 rounded-card border border-border bg-card p-5">
      <div className="flex items-end gap-3">
        <label className="flex flex-1 flex-col gap-1.5 text-sm">
          <span className="font-medium text-primary-dark">Name</span>
          <input
            name="name"
            required
            placeholder="e.g. Biryani, Chinese, Tandoor"
            className="rounded-xl border border-border bg-background px-3.5 py-2.5 text-primary focus:border-primary focus:outline-none"
          />
        </label>
        <label className="flex w-24 flex-col gap-1.5 text-sm">
          <span className="font-medium text-primary-dark">Sort</span>
          <input
            name="sort_order"
            type="number"
            placeholder="0"
            className="rounded-xl border border-border bg-background px-3.5 py-2.5 text-primary focus:border-primary focus:outline-none"
          />
        </label>
        <SubmitButton className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90">
          Add
        </SubmitButton>
      </div>
      {state.error ? <p className="mt-3 text-xs text-non-veg">{state.error}</p> : null}
    </form>
  );
}
