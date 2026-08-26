"use client";

import { useFormStatus } from "react-dom";

// useFormStatus only works inside a descendant of the <form>, hence its own
// tiny client component rather than making the whole page/form client-side.
export function SubmitButton({ children, className }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}>
      {pending ? "Saving…" : children}
    </button>
  );
}
