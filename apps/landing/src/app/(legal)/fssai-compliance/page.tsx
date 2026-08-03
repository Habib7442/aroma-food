import type { Metadata } from "next";
import { LegalArticle } from "@/components/LegalArticle";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "FSSAI Compliance — Zaavo Silchar",
  description: "How Zaavo verifies food safety for restaurant partners in Silchar, Assam.",
  path: "/fssai-compliance",
  keywords: ["FSSAI licensed restaurants Silchar", "food safety Zaavo"],
});

const UPDATED = "August 3, 2026";

export default function FssaiCompliancePage() {
  return (
    <LegalArticle
      title="FSSAI Compliance"
      updated={UPDATED}
      intro="Food safety isn't optional. Here's how it works on Zaavo."
      sections={[
        {
          heading: "1. Only licensed restaurants",
          body: (
            <p>
              Every restaurant partner on Zaavo is required to hold a valid
              FSSAI (Food Safety and Standards Authority of India) license or
              registration before they can go live on the platform. We check
              this as part of onboarding and periodically re-verify it.
            </p>
          ),
        },
        {
          heading: "2. Zaavo as a platform",
          body: (
            <p>
              Zaavo operates as a food e-commerce marketplace under FSSAI
              regulations. Our platform&apos;s FSSAI registration details are
              published here: [FSSAI License No. — to be added].
            </p>
          ),
        },
        {
          heading: "3. Veg / non-veg labeling",
          body: (
            <p>
              Every menu item is marked with the standard green (vegetarian)
              or brown (non-vegetarian) FSSAI symbol, shown clearly next to
              the item name, so you always know what you&apos;re ordering
              before you check out.
            </p>
          ),
        },
        {
          heading: "4. Reporting a food safety issue",
          body: (
            <p>
              If you receive food that looks spoiled, undercooked, or unsafe,
              report it immediately through the order in the app or email{" "}
              <a href="mailto:support@zaavo.co.in" className="font-medium text-primary underline underline-offset-2">
                support@zaavo.co.in
              </a>
              . Serious or repeated issues from a restaurant partner are
              investigated and can result in suspension from the platform.
            </p>
          ),
        },
      ]}
    />
  );
}
