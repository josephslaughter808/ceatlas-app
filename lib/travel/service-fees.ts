import type { TravelPriceBreakdown } from "./providers/types";

export const CEATLAS_SERVICE_FEE_RATE = 0.07;

export function toAmount(value: string | number | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Number(value.toFixed(2));
  }

  const parsed = Number(String(value || "").replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(parsed)) return 0;
  return Number(parsed.toFixed(2));
}

export function calculatePriceBreakdown({
  baseAmount,
  taxesAndFees = 0,
  currency = "USD",
}: {
  baseAmount: number;
  taxesAndFees?: number;
  currency?: string | null;
}): TravelPriceBreakdown {
  const safeBase = toAmount(baseAmount);
  const safeTaxes = toAmount(taxesAndFees);
  const subtotal = toAmount(safeBase + safeTaxes);
  const serviceFee = toAmount(subtotal * CEATLAS_SERVICE_FEE_RATE);
  const total = toAmount(subtotal + serviceFee);

  return {
    baseAmount: safeBase,
    taxesAndFees: safeTaxes,
    subtotal,
    serviceFee,
    total,
    currency: currency || "USD",
  };
}

export function combinePriceBreakdowns(breakdowns: Array<TravelPriceBreakdown | null | undefined>) {
  const active = breakdowns.filter(Boolean) as TravelPriceBreakdown[];
  if (active.length === 0) return null;

  const currency = active[0]?.currency || "USD";
  const subtotal = active.reduce((sum, item) => sum + item.subtotal, 0);
  return calculatePriceBreakdown({
    baseAmount: subtotal,
    taxesAndFees: 0,
    currency,
  });
}
