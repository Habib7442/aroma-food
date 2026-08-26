import Image from "next/image";
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background">
      <Image src="/brand/zaavo-wordmark-black.svg" alt="Zaavo" width={130} height={28} priority />
      <SignIn
        appearance={{
          variables: { colorPrimary: "#1D4626" },
          elements: { card: "shadow-none border border-border rounded-2xl" },
        }}
      />
    </div>
  );
}
