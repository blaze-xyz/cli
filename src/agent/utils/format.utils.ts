/**
 * Money / spending-summary formatting helpers for agent tool results.
 *
 * The agent reports — it does not calculate. These utilities pre-format raw
 * integer-cent values into human-readable USD strings so the model never has
 * to divide by 100 or sum entries itself (a known source of arithmetic errors
 * and fabricated figures).
 */

/** Format integer cents as a USD dollar string, e.g. 200077 -> "$2,000.77". */
export function formatCents(cents: number, currency = "USD"): string {
  if (typeof cents !== "number" || !Number.isFinite(cents)) {
    return "$0.00"
  }
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(cents / 100)
  } catch {
    // Invalid currency code or other Intl failure — fall back safely.
    return `$${(cents / 100).toFixed(2)}`
  }
}

/**
 * Returns the spending summary with human-readable dollar fields added
 * alongside the raw cents, so the model never has to divide or sum.
 *
 * Adds (without removing the raw cents fields):
 *  - `total_spending` at the top level (from `total_spending_cents`)
 *  - per-entry `total` on each `by_category` / `top_merchants` entry that has
 *    a finite `totalCents`
 *
 * Pure and defensive: shallow-clones, never mutates input, and returns the
 * input unchanged if it is not shaped like a spending summary.
 */
export function annotateSpendingSummary(summary: unknown): unknown {
  if (summary === null || typeof summary !== "object") {
    return summary
  }

  const source = summary as Record<string, unknown>
  const currency = typeof source.currency === "string" ? source.currency : "USD"

  const result: Record<string, unknown> = { ...source }

  if (typeof source.total_spending_cents === "number") {
    result.total_spending = formatCents(source.total_spending_cents, currency)
  }

  result.by_category = annotateEntries(source.by_category, currency)
  result.top_merchants = annotateEntries(source.top_merchants, currency)

  return result
}

/**
 * Annotate each entry of a loosely-typed array with a pre-formatted `total`
 * derived from its `totalCents`. Non-array inputs and entries without a finite
 * `totalCents` are passed through untouched.
 */
function annotateEntries(value: unknown, currency: string): unknown {
  if (!Array.isArray(value)) {
    return value
  }
  return value.map(entry => {
    if (entry === null || typeof entry !== "object") {
      return entry
    }
    const e = entry as Record<string, unknown>
    if (typeof e.totalCents !== "number" || !Number.isFinite(e.totalCents)) {
      return entry
    }
    return { ...e, total: formatCents(e.totalCents, currency) }
  })
}
