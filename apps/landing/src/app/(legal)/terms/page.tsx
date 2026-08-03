import type { Metadata } from "next";
import { LegalArticle } from "@/components/LegalArticle";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Terms & Conditions — Zaavo",
  description: "The terms that govern your use of Zaavo.",
  path: "/terms",
});

const UPDATED = "August 3, 2026";

export default function TermsPage() {
  return (
    <LegalArticle
      title="Terms & Conditions"
      updated={UPDATED}
      intro="These terms govern your use of the Zaavo app and website. By creating an account or placing an order through Zaavo, you agree to them."
      sections={[
        {
          heading: "1. Who we are",
          body: (
            <p>
              Zaavo is a marketplace that connects customers in Silchar, Assam
              with independent, verified restaurant partners. Zaavo is not
              itself a restaurant — food is prepared by our restaurant
              partners and delivered by Zaavo&apos;s delivery partners or the
              restaurant&apos;s own staff.
            </p>
          ),
        },
        {
          heading: "2. Your account",
          body: (
            <>
              <p>
                You need an account to place an order. You&apos;re responsible
                for keeping your login credentials secure and for all activity
                under your account. Let us know immediately if you suspect
                unauthorized use.
              </p>
              <p>
                You must be at least 18 years old, or have a parent or
                guardian&apos;s consent, to create an account.
              </p>
            </>
          ),
        },
        {
          heading: "3. Orders and payments",
          body: (
            <>
              <p>
                When you place an order, you&apos;re making an offer to buy
                food from the listed restaurant partner at the price shown at
                checkout, including applicable taxes and delivery charges.
                An order is confirmed once the restaurant accepts it.
              </p>
              <p>
                Payments are processed through our third-party payment
                provider. Zaavo does not store your card details. Menu prices,
                item availability, and preparation times are set by each
                restaurant partner and may change without notice.
              </p>
            </>
          ),
        },
        {
          heading: "4. Delivery",
          body: (
            <p>
              Delivery times shown in the app are estimates, not guarantees —
              they can be affected by weather, traffic, and order volume.
              Someone needs to be available at the delivery address to receive
              the order; repeated failed deliveries may result in the order
              being cancelled without a refund.
            </p>
          ),
        },
        {
          heading: "5. Cancellations and refunds",
          body: (
            <p>
              See our{" "}
              <a href="/refund-policy" className="font-medium text-primary underline underline-offset-2">
                Refund &amp; Cancellation Policy
              </a>{" "}
              for how cancellations, refunds, and quality issues are handled.
            </p>
          ),
        },
        {
          heading: "6. Acceptable use",
          body: (
            <p>
              Don&apos;t misuse the platform — this includes placing
              fraudulent orders, abusing delivery or restaurant partners,
              scraping or reverse-engineering the app, or attempting to
              circumvent fees. We may suspend or terminate accounts that
              violate this.
            </p>
          ),
        },
        {
          heading: "7. Limitation of liability",
          body: (
            <p>
              Zaavo facilitates the connection between you and restaurant
              partners but is not responsible for the quality, safety, or
              legality of food prepared by restaurant partners. To the extent
              permitted by law, Zaavo&apos;s liability for any claim relating
              to an order is limited to the value of that order.
            </p>
          ),
        },
        {
          heading: "8. Changes to these terms",
          body: (
            <p>
              We may update these terms from time to time. If we make
              material changes, we&apos;ll notify you through the app or by
              email before they take effect.
            </p>
          ),
        },
        {
          heading: "9. Governing law",
          body: (
            <p>
              These terms are governed by the laws of India, and disputes are
              subject to the exclusive jurisdiction of the courts of Silchar,
              Assam.
            </p>
          ),
        },
        {
          heading: "10. Contact",
          body: (
            <p>
              Questions about these terms? Reach us at{" "}
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
