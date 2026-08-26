import Image from "next/image";
import { SignOutButton } from "@/components/SignOutButton";

export default function NotAuthorizedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <Image src="/brand/zaavo-wordmark-black.svg" alt="Zaavo" width={110} height={24} className="mb-2" />
      <span className="rounded-full bg-non-veg/10 px-3 py-1 text-xs font-medium text-non-veg">Not authorized</span>
      <h1 className="text-xl font-semibold text-primary">This account isn&apos;t a platform admin</h1>
      <p className="max-w-sm text-sm text-primary-dark">
        Ask someone with Clerk Dashboard access to set <code className="rounded bg-card px-1.5 py-0.5">public_metadata.super_admin</code> on
        your user, then sign out and back in.
      </p>
      <SignOutButton className="mt-2 rounded-full border border-border bg-card px-5 py-2 text-sm font-medium text-primary hover:border-primary/30">
        Sign out
      </SignOutButton>
    </div>
  );
}
