import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import { Sidebar } from "@/components/Sidebar";

// Mirrors the exact claim `is_super_admin()` reads in Postgres (`auth.jwt()
// ->> 'superAdmin'`, supabase/migrations/20260727055325_slice1_vendor_menu.sql).
// Until a human adds this custom session claim in the Clerk Dashboard
// (Sessions -> Customize session token) and sets public_metadata.super_admin
// on a user, this is always undefined/false for everyone — fail closed by
// design, not a bug. See apps/admin/AGENTS.md.
interface AdminSessionClaims {
  superAdmin?: boolean;
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const claims = sessionClaims as AdminSessionClaims | null;
  if (!claims?.superAdmin) {
    redirect("/not-authorized");
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar>
        <UserButton
          appearance={{
            variables: { colorText: "#ffffff", colorTextSecondary: "rgba(255,255,255,0.7)" },
            elements: { userButtonBox: "flex-row-reverse", userButtonOuterIdentifier: "text-sm" },
          }}
          showName
        />
      </Sidebar>
      <main className="flex-1 overflow-y-auto bg-background px-10 py-8">{children}</main>
    </div>
  );
}
