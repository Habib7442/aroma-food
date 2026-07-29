import { describe, expect, it } from "vitest";
import { formatPaise, roundHalfUpDivision, rupeesToPaise } from "./money";
import { calculateOrderTotals, calculateVendorPayout } from "./pricing";
import type { OrderTotalsInput } from "./types";

// PRD §4.4: Chicken Biryani ₹200 + Garlic Naan ₹100. GST 5%. Delivery ₹30.
// Platform fee ₹5. Discount ₹20 (platform-funded). Commission 10%.
const workedExample: OrderTotalsInput = {
  itemSubtotalPaise: 30000,
  gstStatus: "registered",
  foodGstRateBps: 500,
  deliveryFeePaise: 3000,
  platformFeePaise: 500,
  discountPaise: 2000,
  discountFundedBy: "platform",
  commissionRateBps: 1000,
};

describe("calculateOrderTotals — PRD §4.4 worked example", () => {
  it("matches the worked example exactly", () => {
    const invoice = calculateOrderTotals(workedExample);

    expect(invoice.itemSubtotalPaise).toBe(30000);
    expect(invoice.gstPaise).toBe(1500);
    expect(invoice.deliveryFeePaise).toBe(3000);
    expect(invoice.platformFeePaise).toBe(500);
    expect(invoice.discountPaise).toBe(2000);
    expect(invoice.grandTotalPaise).toBe(33000); // ₹330.00

    expect(invoice.commissionPaise).toBe(3000);
    expect(invoice.vendorPayoutPaise).toBe(27000); // ₹270.00 — platform-funded discount, payout unaffected

    expect(invoice.platformEarningsPaise).toBe(6500); // ₹65.00 = 30 commission + 30 delivery + 5 platform fee
  });

  it("matches calculateVendorPayout called directly", () => {
    const payout = calculateVendorPayout(30000, 1000);
    expect(payout.commissionPaise).toBe(3000);
    expect(payout.netPayoutPaise).toBe(27000);
  });
});

describe("discount funding divergence (PRD §4.5)", () => {
  it("platform-funded discount leaves vendor payout unaffected", () => {
    const invoice = calculateOrderTotals({ ...workedExample, discountFundedBy: "platform" });
    expect(invoice.vendorPayoutPaise).toBe(27000);
    expect(invoice.platformEarningsPaise).toBe(6500);
    expect(invoice.grandTotalPaise).toBe(33000);
  });

  it("vendor-funded discount reduces vendor payout by the discount amount", () => {
    const invoice = calculateOrderTotals({ ...workedExample, discountFundedBy: "vendor" });
    expect(invoice.vendorPayoutPaise).toBe(25000); // 27000 - 2000
    expect(invoice.platformEarningsPaise).toBe(6500); // unaffected — this is the divergence
    expect(invoice.grandTotalPaise).toBe(33000); // customer sees the same bill either way
  });
});

describe("GST status handling (PRD §4.6)", () => {
  it("charges zero food GST for an unregistered restaurant", () => {
    const invoice = calculateOrderTotals({ ...workedExample, gstStatus: "unregistered" });
    expect(invoice.gstPaise).toBe(0);
    expect(invoice.grandTotalPaise).toBe(31500); // 33000 - 1500 GST
  });

  it("charges zero food GST for a composition-scheme restaurant", () => {
    const invoice = calculateOrderTotals({ ...workedExample, gstStatus: "composition" });
    expect(invoice.gstPaise).toBe(0);
  });
});

describe("rounding (PRD §4: round half up, at the final paise, once)", () => {
  it("rounds a genuine half-paise boundary up (₹333.10 subtotal at 5% GST)", () => {
    // 33310 * 500 / 10000 = 1665.5 exactly — a true half-paise case.
    // (A whole-rupee subtotal like ₹333 never lands on a fraction here,
    // since 100 paise divides evenly by 20/10/50 for the 5/10/18% rates.)
    const invoice = calculateOrderTotals({
      ...workedExample,
      itemSubtotalPaise: 33310,
      foodGstRateBps: 500,
    });
    expect(invoice.gstPaise).toBe(1666);
  });

  it("rounds commission on an odd subtotal consistently", () => {
    // 33310 * 1000 / 10000 = 3331 exactly, no rounding needed here — confirms
    // applyBps doesn't introduce drift on an exact case either.
    const payout = calculateVendorPayout(33310, 1000);
    expect(payout.commissionPaise).toBe(3331);
    expect(payout.netPayoutPaise).toBe(29979);
  });
});

describe("formatPaise", () => {
  it("formats a positive amount as rupees with two decimal places", () => {
    expect(formatPaise(33000)).toBe("₹330.00");
  });

  it("formats a negative amount (e.g. a discount line) with a leading sign", () => {
    expect(formatPaise(-2000)).toBe("-₹20.00");
  });

  it("pads single-digit paise", () => {
    expect(formatPaise(5)).toBe("₹0.05");
  });
});

describe("roundHalfUpDivision", () => {
  it("rejects zero or non-positive denominators", () => {
    expect(() => roundHalfUpDivision(100, 0)).toThrow(RangeError);
    expect(() => roundHalfUpDivision(100, -5)).toThrow(RangeError);
  });

  it("rounds positive numerators half-up correctly", () => {
    expect(roundHalfUpDivision(105, 10)).toBe(11);
    expect(roundHalfUpDivision(104, 10)).toBe(10);
  });

  it("rounds negative numerators half-up symmetrically", () => {
    expect(roundHalfUpDivision(-105, 10)).toBe(-11);
    expect(roundHalfUpDivision(-104, 10)).toBe(-10);
  });
});

describe("rupeesToPaise", () => {
  it("converts integer rupees to paise", () => {
    expect(rupeesToPaise(299)).toBe(29900);
    expect(rupeesToPaise("299")).toBe(29900);
  });

  it("converts decimal rupees without float boundary drift (e.g. 1.005 -> 101)", () => {
    expect(rupeesToPaise(1.005)).toBe(101);
    expect(rupeesToPaise("1.005")).toBe(101);
    expect(rupeesToPaise(1.004)).toBe(100);
    expect(rupeesToPaise("19.995")).toBe(2000);
  });

  it("handles negative amounts and returns NaN for invalid inputs", () => {
    expect(rupeesToPaise("-10.50")).toBe(-1050);
    expect(rupeesToPaise("invalid")).toBeNaN();
  });
});

describe("domain validation rejections", () => {
  it("rejects negative or non-integer paise inputs", () => {
    expect(() => calculateOrderTotals({ ...workedExample, itemSubtotalPaise: -100 })).toThrow(RangeError);
    expect(() => calculateOrderTotals({ ...workedExample, itemSubtotalPaise: 100.5 })).toThrow(RangeError);
  });

  it("rejects BPS rates outside 0-10000", () => {
    expect(() => calculateOrderTotals({ ...workedExample, foodGstRateBps: 12000 })).toThrow(RangeError);
    expect(() => calculateVendorPayout(30000, 15000)).toThrow(RangeError);
  });

  it("rejects discounts exceeding pre-discount total", () => {
    expect(() => calculateOrderTotals({ ...workedExample, discountPaise: 50000 })).toThrow(RangeError);
  });

  it("rejects vendor-funded discounts exceeding net payout", () => {
    expect(() =>
      calculateOrderTotals({
        ...workedExample,
        discountPaise: 28000,
        discountFundedBy: "vendor",
      }),
    ).toThrow(RangeError);
  });
});



