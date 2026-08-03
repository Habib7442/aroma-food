import type { Metadata } from "next";
import { LegalArticle } from "@/components/LegalArticle";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy — Zaavo",
  description: "How order cancellations and refunds work on Zaavo.",
};

const UPDATED = "August 3, 2026";

export default function RefundPolicyPage() {
  return (
    <LegalArticle
      title="Refund & Cancellation Policy"
      updated={UPDATED}
      intro="Because food is perishable and restaurants start preparing orders quickly, our cancellation window is short. Here's exactly how it works."
      sections={[
        {
          heading: "1. Cancelling an order",
          body: (
            <>
              <p>
                You can cancel an order for a full refund only if the
                restaurant hasn&apos;t started preparing it yet — usually
                within a couple of minutes of placing the order. Once the
                restaurant accepts and starts preparing your order,
                cancellation may no longer be possible, or may only be
                partially refunded to cover the restaurant&apos;s cost.
              </p>
              <p>
                If a restaurant is unable to accept your order (closed, out
                of an item, etc.), it&apos;s cancelled automatically and
                refunded in full.
              </p>
            </>
          ),
        },
        {
          heading: "2. When you're eligible for a refund",
          body: (
            <ul>
              <li>Your order never arrived.</li>
              <li>You received the wrong order or missing items.</li>
              <li>The food arrived damaged, spoiled, or unsafe to eat.</li>
              <li>The restaurant cancelled after accepting the order.</li>
            </ul>
          ),
        },
        {
          heading: "3. When a refund isn't available",
          body: (
            <ul>
              <li>
                You simply changed your mind after the restaurant started
                preparing the order.
              </li>
              <li>
                The order couldn&apos;t be delivered because no one was
                available at the address provided.
              </li>
              <li>
                You didn&apos;t like the taste — this is a matter for
                restaurant feedback rather than a refund, unless the item was
                materially different from what was ordered.
              </li>
            </ul>
          ),
        },
        {
          heading: "4. How to request a refund",
          body: (
            <p>
              Open the order in the app and tap &quot;Report an issue,&quot;
              or email{" "}
              <a href="mailto:support@zaavo.co.in" className="font-medium text-primary underline underline-offset-2">
                support@zaavo.co.in
              </a>{" "}
              with your order ID and a description of the problem, within 24
              hours of delivery.
            </p>
          ),
        },
        {
          heading: "5. Refund timeline",
          body: (
            <p>
              Approved refunds are issued to your original payment method and
              typically appear within 5–7 business days, depending on your
              bank or payment provider.
            </p>
          ),
        },
      ]}
    />
  );
}
