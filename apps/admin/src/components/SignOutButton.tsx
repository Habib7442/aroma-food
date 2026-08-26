"use client";

import { useClerk } from "@clerk/nextjs";

// Clerk's own <SignOutButton> wraps a passed-in child via React.cloneElement +
// React.Children.only(), which throws "multiple children" under this
// Next.js/React/Clerk version combination even with a single, single-line
// <button> child (matches Clerk's own docs example exactly — reported
// upstream, no fix yet). Calling useClerk().signOut() directly (Clerk's
// documented "custom sign-out flow" pattern) avoids that wrapper entirely.
export function SignOutButton({ className, children }: { className?: string; children: React.ReactNode }) {
  const { signOut } = useClerk();
  return (
    <button className={className} onClick={() => signOut({ redirectUrl: "/sign-in" })}>
      {children}
    </button>
  );
}
