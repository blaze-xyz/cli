/**
 * Approximate USD exchange rates for client-side estimation.
 * These are NOT used for settlement — the backend uses live rates.
 * Used only for balance pre-checks and display estimates.
 */
export const USD_RATES: Record<string, number> = {
  MXN: 17.15,
  BRL: 5.05,
  EUR: 0.92,
  GBP: 0.79,
  COP: 4200,
  ARS: 900,
}

export function estimateUsdAmount(amount: number, currency: string): number {
  const rate = USD_RATES[currency.toUpperCase()] || 1
  return amount / rate
}
