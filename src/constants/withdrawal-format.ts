import type { ConnectedPaymentMethod } from "../sdk/types"
import { USD_RATES, estimateUsdAmount } from "./fx-rates"

// USD + the currencies we can estimate a USD value for. Withdrawals in any
// other currency are rejected client-side (the server would reject them too).
export const SUPPORTED_WITHDRAWAL_CURRENCIES: string[] = [
  "USD",
  ...Object.keys(USD_RATES),
]

// GraphQL Int max — usdc/fiat cents are Int! on the server.
export const MAX_TRANSACTION_CENTS = 2_147_483_647

/** Float-safe major-units → integer cents (avoids 1.005*100 = 100.4999…). */
export function toCents(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100)
}

const INELIGIBILITY_REASONS: Record<string, string> = {
  CREDIT_CARD: "credit cards can't receive withdrawals",
  UNSUPPORTED_BIN_COUNTRY:
    "this card's country isn't supported for withdrawals",
  UNSUPPORTED_BANK_COUNTRY:
    "this bank's country isn't supported for withdrawals",
  UNSUPPORTED_CASH_COUNTRY: "cash withdrawals aren't supported in this country",
  UNSUPPORTED_PAYMENT_TYPE: "this payment type can't receive withdrawals",
  DISBURSEMENT_INELIGIBLE:
    "this method isn't eligible for withdrawals right now",
}

/** Human-readable explanation for a withdrawIneligibilityReason enum token. */
export function humanizeWithdrawIneligibilityReason(
  reason?: string | null
): string {
  if (!reason) return "this method can't receive withdrawals right now"
  return (
    INELIGIBILITY_REASONS[reason] ?? reason.toLowerCase().replace(/_/g, " ")
  )
}

export interface WithdrawalAmounts {
  fiatAmountInCents: number
  usdcAmountInCents: number
  conversionNote: string
}

/**
 * SINGLE SOURCE OF TRUTH for withdrawal amount math, shared by the CLI, MCP, and
 * agent so the cents can never diverge. Validates the currency + amount and
 * returns either the derived cents or a friendly error string.
 *
 * Non-USD uses an APPROXIMATE client-side rate (USD_RATES) for the estimate and
 * balance pre-check only — the server performs the authoritative conversion and
 * validates it within a tolerance. (Follow-up: replace the static estimate with
 * a live FX quote so volatile corridors stay inside tolerance.)
 */
export function deriveWithdrawalAmounts(input: {
  amount: number
  currency: string
}): { ok: true; amounts: WithdrawalAmounts } | { ok: false; error: string } {
  const currency = input.currency.toUpperCase()
  if (!SUPPORTED_WITHDRAWAL_CURRENCIES.includes(currency)) {
    return {
      ok: false,
      error: `Withdrawals in ${currency} aren't supported yet. Supported currencies: ${SUPPORTED_WITHDRAWAL_CURRENCIES.join(", ")}.`,
    }
  }
  if (!(input.amount > 0)) {
    return { ok: false, error: "Amount must be greater than zero." }
  }
  const fiatAmountInCents = toCents(input.amount)
  let usdcAmountInCents: number
  let conversionNote = ""
  if (currency === "USD") {
    usdcAmountInCents = fiatAmountInCents
  } else {
    const estimatedUsd = estimateUsdAmount(input.amount, currency)
    usdcAmountInCents = toCents(estimatedUsd)
    conversionNote = ` (~$${estimatedUsd.toFixed(2)} USD from your balance)`
  }
  if (
    fiatAmountInCents > MAX_TRANSACTION_CENTS ||
    usdcAmountInCents > MAX_TRANSACTION_CENTS
  ) {
    return {
      ok: false,
      error: `That amount is too large — withdrawals are capped at $${(MAX_TRANSACTION_CENTS / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })} per transaction.`,
    }
  }
  return {
    ok: true,
    amounts: { fiatAmountInCents, usdcAmountInCents, conversionNote },
  }
}

/** Approximate local-currency amount for a USD amount — display only. */
export function estimateLocalAmount(
  usdMajorUnits: number,
  currency: string
): number {
  const rate = USD_RATES[currency.toUpperCase()]
  return rate ? usdMajorUnits * rate : usdMajorUnits
}

/** Sums FeeCollection rows to total fee cents (USD). */
export function totalFeeCents(
  feeCollections?: { amountCents: number }[] | null
): number {
  return (feeCollections ?? []).reduce((s, f) => s + (f.amountCents || 0), 0)
}

/**
 * Maps a UserPaymentMethodType (what our connected methods carry) to the
 * PaymentMethodType the `applicableFee` API expects. Returns null for types the
 * fee API doesn't price (PayPal/Venmo/Zelle/Other) — callers skip the preview
 * then and fall back to the actual fee on the receipt.
 */
export function mapToPaymentMethodType(
  userType?: string | null
): string | null {
  switch (userType) {
    case "Bank":
      return "Bank"
    case "Card":
      return "Card"
    case "Cash":
      return "Cash"
    case "VirtualAccount":
      return "VirtualAccount"
    default:
      return null
  }
}

/** Last 4 digits from a card's lastFour or a masked account number, if any. */
function lastFourOf(method: ConnectedPaymentMethod): string | null {
  if (method.card?.lastFour) return method.card.lastFour
  if (method.maskedAccountNumber) {
    const m = method.maskedAccountNumber.match(/(\d{3,4})\D*$/)
    if (m) return m[1]
  }
  return null
}

/**
 * Friendly label for a connected payment method, e.g. "Banamex ••3899", so it
 * reads like a contact-list entry. Prefers the display name + last 4.
 */
export function formatConnectedPaymentMethodLabel(
  method: ConnectedPaymentMethod
): string {
  const last4 = lastFourOf(method)
  const name = method.displayName || method.nickname || method.card?.brand
  if (name && last4) return `${name} ••${last4}`
  if (name) return name
  if (method.maskedAccountNumber) return method.maskedAccountNumber
  return `${method.type} (${method.id})`
}

/**
 * Friendly, sentence-like estimate of when a withdrawal lands. Instant
 * (push-to-card) settles in minutes; standard rails vary by currency. Never
 * claims "instant" for US ACH.
 */
export function estimateWithdrawalArrival(opts: {
  instantTransfer: boolean
  currency: string
}): string {
  if (opts.instantTransfer) return "It should land within a few minutes."
  switch (opts.currency.toUpperCase()) {
    case "MXN":
      return "It usually arrives within a few minutes to a couple of hours."
    case "BRL":
      return "It usually arrives within minutes."
    case "USD":
    case "EUR":
    case "GBP":
    default:
      return "It usually arrives in 1–2 business days."
  }
}
