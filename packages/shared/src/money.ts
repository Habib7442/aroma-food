/**
 * Divides `numerator / denominator` and rounds half up, using integer
 * remainder comparison instead of floating-point `+0.5` so there's no
 * float drift at the boundary (PRD §4: "round half up, at the final
 * paise, once").
 */
export function roundHalfUpDivision(numerator: number, denominator: number): number {
  if (!Number.isFinite(denominator) || denominator <= 0) {
    throw new RangeError("Denominator must be a positive finite number.");
  }
  if (!Number.isFinite(numerator)) {
    throw new RangeError("Numerator must be a finite number.");
  }
  const isNegative = numerator < 0;
  const absNumerator = Math.abs(numerator);
  const quotient = Math.floor(absNumerator / denominator);
  const remainder = absNumerator - quotient * denominator;
  const roundedAbs = remainder * 2 >= denominator ? quotient + 1 : quotient;
  return isNegative ? -roundedAbs : roundedAbs;
}

/** Applies a basis-points rate to a paise amount, rounding half up once. */
export function applyBps(amountPaise: number, bps: number): number {
  return roundHalfUpDivision(amountPaise * bps, 10000);
}

/** Converts a rupee amount (e.g. from a text input or number) to integer paise, rounding half up once. */
export function rupeesToPaise(rupees: number | string): number {
  if (typeof rupees === "number") {
    if (!Number.isFinite(rupees)) return NaN;
  }
  const str = String(rupees).trim();
  if (!str) return NaN;

  const isNegative = str.startsWith("-");
  const cleanStr = isNegative ? str.slice(1) : str;

  const parts = cleanStr.split(".");
  if (parts.length > 2) return NaN;

  const intStr = parts[0] || "0";
  const fracStr = parts[1] || "";

  if (!/^\d+$/.test(intStr) || (parts.length === 2 && !/^\d*$/.test(fracStr))) {
    return NaN;
  }

  const intPaise = Number(intStr) * 100;

  if (!fracStr) {
    return isNegative ? -intPaise : intPaise;
  }

  const paddedFrac = fracStr.padEnd(3, "0");
  const paise2 = Number(paddedFrac.slice(0, 2));
  const thirdDigit = Number(paddedFrac[2]);

  const roundedPaise = thirdDigit >= 5 ? paise2 + 1 : paise2;
  const totalPaise = intPaise + roundedPaise;

  return isNegative ? -totalPaise : totalPaise;
}

/** Formats integer paise as a rupee string, e.g. 33000 -> "₹330.00". */
export function formatPaise(paise: number): string {
  const sign = paise < 0 ? "-" : "";
  const absPaise = Math.abs(paise);
  const rupees = Math.floor(absPaise / 100);
  const cents = absPaise % 100;
  return `${sign}₹${rupees.toLocaleString("en-IN")}.${cents.toString().padStart(2, "0")}`;
}

/**
 * Packaging charge cap, in paise: ₹7 for a dish priced under ₹100, ₹15
 * otherwise — a fixed vendor-policy limit, not derived from GST/commission.
 */
export function maxPackagingChargePaise(pricePaise: number): number {
  return pricePaise < 10000 ? 700 : 1500;
}
