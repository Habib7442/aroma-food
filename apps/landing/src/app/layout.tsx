import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import { SmoothScroll } from "@/components/SmoothScroll";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://zaavo.co.in"),
  title: "Zaavo — Fresh food, delivered across Silchar",
  description:
    "Order from Silchar's favorite local restaurants and get hot, fresh food delivered to your door.",
  openGraph: {
    title: "Zaavo — Fresh food, delivered across Silchar",
    description:
      "Order from Silchar's favorite local restaurants and get hot, fresh food delivered to your door.",
    url: "/",
    siteName: "Zaavo",
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Zaavo — Fresh food, delivered across Silchar",
    description:
      "Order from Silchar's favorite local restaurants and get hot, fresh food delivered to your door.",
  },
  // Paste the token from Search Console → Settings → Ownership verification → HTML tag:
  // verification: { google: "PASTE_TOKEN_HERE" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${jakarta.variable} ${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col font-sans" suppressHydrationWarning>
        <SmoothScroll />
        {children}
      </body>
    </html>
  );
}
