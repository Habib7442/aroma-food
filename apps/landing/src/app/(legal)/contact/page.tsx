import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { ContactPageContent } from "@/components/ContactPageContent";

export const metadata: Metadata = buildMetadata({
  title: "Contact Us — Zaavo Silchar",
  description:
    "Get in touch with Zaavo's Silchar support team by phone, WhatsApp, or email. Restaurant owners can also apply to partner with us here.",
  path: "/contact",
  keywords: ["Zaavo contact", "Zaavo Silchar support", "Zaavo restaurant partner sign up"],
});

export default function ContactPage() {
  return <ContactPageContent />;
}
