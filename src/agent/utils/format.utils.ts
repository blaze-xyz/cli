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

/**
 * Recursively annotate a tool result with human-readable money strings.
 *
 * For every object shaped like a money amount — a numeric `amount` (and/or
 * `fee`) alongside a string `currency` — adds an `amount_display` (and
 * `fee_display`) formatted from the integer minor units, so the agent reports
 * the formatted value verbatim and never divides by 100 or guesses the unit
 * convention itself. Pure and defensive: deep-clones, never mutates, and
 * passes through anything that is not shaped like a money amount.
 */
export function annotateAmounts(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(annotateAmounts)
  }
  if (value === null || typeof value !== "object") {
    return value
  }

  const source = value as Record<string, unknown>
  const result: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(source)) {
    result[key] = annotateAmounts(child)
  }

  const currency =
    typeof source.currency === "string" ? source.currency : undefined
  if (currency) {
    if (typeof source.amount === "number" && Number.isFinite(source.amount)) {
      result.amount_display = formatCents(source.amount, currency)
    }
    if (typeof source.fee === "number" && Number.isFinite(source.fee)) {
      result.fee_display = formatCents(source.fee, currency)
    }
  }

  return result
}

/**
 * Annotate a list-shaped tool result (`{ data: [...] }`) with a `summary` block
 * containing the total `count` and a `by_status` breakdown, computed from the
 * records the tool returned. This lets the agent report counts verbatim instead
 * of tallying a long list itself (a source of miscounts and duplicated rows).
 *
 * Backend-agnostic: derived purely from the returned records, so it behaves
 * identically against staging, prod, or any data set. Non-list results pass
 * through unchanged.
 */
export function annotateRecordCounts(result: unknown): unknown {
  if (result === null || typeof result !== "object" || Array.isArray(result)) {
    return result
  }
  const source = result as Record<string, unknown>
  if (!Array.isArray(source.data)) return result

  const byStatus: Record<string, number> = {}
  for (const item of source.data) {
    if (item !== null && typeof item === "object") {
      const status = (item as Record<string, unknown>).status
      if (typeof status === "string") {
        byStatus[status] = (byStatus[status] ?? 0) + 1
      }
    }
  }

  return {
    ...source,
    summary: { count: source.data.length, by_status: byStatus },
  }
}
