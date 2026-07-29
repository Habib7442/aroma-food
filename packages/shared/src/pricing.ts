import { applyBps } from "./money";
import type { CustomerInvoice, GstStatus, OrderTotalsInput, VendorPayout } from "./types";

function assertNonNegativeInteger(val: number, name: string): void {
  if (!Number.isSafeInteger(val) || val < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer (got ${val}).`);
  }
}

function assertBps(val: number, name: string): void {
  if (!Number.isInteger(val) || val < 0 || val > 10000) {
    throw new RangeError(`${name} must be an integer between 0 and 10000 BPS (got ${val}).`);
  }
}

/**
 * PRD §4.1: commission applies to the item subtotal only, never to GST
 * or fees. Signature matches PRD §4.3 exactly.
 */
export function calculateVendorPayout(
  itemSubtotalPaise: number,
  commissionRateBps: number,
): VendorPayout {
  assertNonNegativeInteger(itemSubtotalPaise, "itemSubtotalPaise");
  assertBps(commissionRateBps, "commissionRateBps");

  const commissionPaise = applyBps(itemSubtotalPaise, commissionRateBps);
  return {
    commissionPaise,
    netPayoutPaise: itemSubtotalPaise - commissionPaise,
  };
}

function foodGstPaise(itemSubtotalPaise: number, gstStatus: GstStatus, foodGstRateBps: number): number {
  if (gstStatus !== "registered") {
    return 0;
  }
  return applyBps(itemSubtotalPaise, foodGstRateBps);
}

export function calculateOrderTotals(input: OrderTotalsInput): CustomerInvoice {
  const {
    itemSubtotalPaise,
    gstStatus,
    foodGstRateBps,
    deliveryFeePaise,
    platformFeePaise,
    discountPaise,
    discountFundedBy,
    commissionRateBps,
  } = input;

  assertNonNegativeInteger(itemSubtotalPaise, "itemSubtotalPaise");
  assertBps(foodGstRateBps, "foodGstRateBps");
  assertBps(commissionRateBps, "commissionRateBps");
  assertNonNegativeInteger(deliveryFeePaise, "deliveryFeePaise");
  assertNonNegativeInteger(platformFeePaise, "platformFeePaise");
  assertNonNegativeInteger(discountPaise, "discountPaise");

  const gstPaise = foodGstPaise(itemSubtotalPaise, gstStatus, foodGstRateBps);
  const preDiscountTotal = itemSubtotalPaise + gstPaise + deliveryFeePaise + platformFeePaise;

  if (discountPaise > preDiscountTotal) {
    throw new RangeError(
      `Discount (${discountPaise} paise) cannot exceed pre-discount order total (${preDiscountTotal} paise).`,
    );
  }

  const { commissionPaise, netPayoutPaise } = calculateVendorPayout(itemSubtotalPaise, commissionRateBps);

  if (discountFundedBy === "vendor" && discountPaise > netPayoutPaise) {
    throw new RangeError(
      `Vendor-funded discount (${discountPaise} paise) cannot exceed vendor net payout (${netPayoutPaise} paise).`,
    );
  }

  // PRD §4.5: vendor-funded discounts reduce vendor payout; platform-funded
  // discounts leave it unaffected.
  const vendorPayoutPaise = discountFundedBy === "vendor" ? netPayoutPaise - discountPaise : netPayoutPaise;

  // PRD §4.1: platform earnings = commission + delivery fee + platform fee.
  const platformEarningsPaise = commissionPaise + deliveryFeePaise + platformFeePaise;

  const grandTotalPaise = preDiscountTotal - discountPaise;

  return {
    itemSubtotalPaise,
    gstPaise,
    deliveryFeePaise,
    platformFeePaise,
    discountPaise,
    grandTotalPaise,
    commissionPaise,
    vendorPayoutPaise,
    platformEarningsPaise,
  };
}

