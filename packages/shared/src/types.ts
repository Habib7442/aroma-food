export type OrderStatus =
  | "pending_payment"
  | "placed"
  | "accepted"
  | "preparing"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "rejected";

export type DietType = "veg" | "egg" | "non_veg";

export type GstStatus = "registered" | "composition" | "unregistered";

export type DiscountFundedBy = "platform" | "vendor";

/**
 * Input to `calculateOrderTotals`. All monetary fields are integer paise;
 * rates are basis points (1% = 100 bps).
 */
export interface OrderTotalsInput {
  itemSubtotalPaise: number;
  gstStatus: GstStatus;
  /** 500 (5%) or 1800 (18%); ignored unless gstStatus === "registered" (PRD §4.6). */
  foodGstRateBps: number;
  deliveryFeePaise: number;
  platformFeePaise: number;
  discountPaise: number;
  discountFundedBy: DiscountFundedBy;
  commissionRateBps: number;
}

export interface CustomerInvoice {
  itemSubtotalPaise: number;
  gstPaise: number;
  deliveryFeePaise: number;
  platformFeePaise: number;
  discountPaise: number;
  grandTotalPaise: number;
  commissionPaise: number;
  vendorPayoutPaise: number;
  platformEarningsPaise: number;
}

export interface VendorPayout {
  commissionPaise: number;
  netPayoutPaise: number;
}
