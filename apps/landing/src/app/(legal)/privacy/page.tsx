import type { Metadata } from "next";
import { LegalArticle } from "@/components/LegalArticle";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Privacy Policy — Zaavo",
  description: "How Zaavo collects, uses, and protects your data.",
  path: "/privacy",
});

const UPDATED = "August 3, 2026";

export default function PrivacyPage() {
  return (
    <LegalArticle
      title="Privacy Policy"
      updated={UPDATED}
      intro="This policy explains what information Zaavo collects, how we use it, and the choices you have."
      sections={[
        {
          heading: "1. Information we collect",
          body: (
            <ul>
              <li>
                <strong className="text-on-surface">Account information:</strong>{" "}
                name, phone number, email address, and delivery addresses you
                provide.
              </li>
              <li>
                <strong className="text-on-surface">Order information:</strong>{" "}
                what you order, from which restaurant, and when.
              </li>
              <li>
                <strong className="text-on-surface">Location data:</strong> your
                delivery location, and — with permission — your device&apos;s
                location to improve delivery accuracy.
              </li>
              <li>
                <strong className="text-on-surface">Payment information:</strong>{" "}
                handled directly by our payment processor; Zaavo does not
                store your full card or UPI details.
              </li>
              <li>
                <strong className="text-on-surface">Device and usage data:</strong>{" "}
                app version, device type, and how you interact with the app,
                used for debugging and improving the product.
              </li>
            </ul>
          ),
        },
        {
          heading: "2. How we use this information",
          body: (
            <p>
              To process and deliver your orders, provide customer support,
              send order-related notifications, prevent fraud, and improve
              Zaavo. We don&apos;t use your order history to sell you
              anything beyond what you see in the app.
            </p>
          ),
        },
        {
          heading: "3. Who we share it with",
          body: (
            <p>
              The restaurant partner you order from (to prepare your order),
              the delivery partner assigned to your order, and our payment
              processor (to complete payment). We don&apos;t sell your
              personal data to third parties.
            </p>
          ),
        },
        {
          heading: "4. Data retention",
          body: (
            <p>
              We keep account and order data for as long as your account is
              active, and for a reasonable period after that to meet legal,
              tax, and dispute-resolution obligations.
            </p>
          ),
        },
        {
          heading: "5. Your choices",
          body: (
            <p>
              You can review and update your account information in the app
              at any time. You can request a copy of your data or ask us to
              delete your account by contacting us — we&apos;ll retain what
              we&apos;re legally required to keep (such as tax records) even
              after deletion.
            </p>
          ),
        },
        {
          heading: "6. Cookies and similar technologies",
          body: (
            <p>
              Our website uses a minimal set of cookies needed to keep you
              signed in and remember your preferences. We don&apos;t use
              third-party advertising trackers.
            </p>
          ),
        },
        {
          heading: "7. Security",
          body: (
            <p>
              We use industry-standard safeguards to protect your data,
              including encryption in transit and access controls that limit
              who can see your information. No system is perfectly secure,
              and we can&apos;t guarantee absolute security.
            </p>
          ),
        },
        {
          heading: "8. Children's privacy",
          body: (
            <p>
              Zaavo isn&apos;t intended for children under 18. We don&apos;t
              knowingly collect data from children.
            </p>
          ),
        },
        {
          heading: "9. Changes to this policy",
          body: (
            <p>
              If we make material changes to how we handle your data,
              we&apos;ll notify you through the app or by email before the
              change takes effect.
            </p>
          ),
        },
        {
          heading: "10. Contact",
          body: (
            <p>
              Questions about this policy or your data? Reach us at{" "}
              <a href="mailto:support@zaavo.co.in" className="font-medium text-primary underline underline-offset-2">
                support@zaavo.co.in
              </a>
              .
            </p>
          ),
        },
      ]}
    />
  );
}
