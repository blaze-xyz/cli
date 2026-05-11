import Table from "cli-table3"

export function formatOutput(
  data: unknown,
  format: "json" | "table" = "json"
): void {
  try {
    if (format === "json") {
      console.log(JSON.stringify(data, null, 2))
      return
    }

    if (Array.isArray(data)) {
      formatListAsTable(data)
    } else if (typeof data === "object" && data !== null) {
      formatObjectAsTable(data as Record<string, unknown>)
    } else {
      console.log(String(data))
    }
  } catch (error) {
    console.error("Error formatting output:", error)
    // Fallback to JSON
    console.log(JSON.stringify(data, null, 2))
  }
}

function formatListAsTable(items: unknown[]): void {
  if (items.length === 0) {
    console.log("No results.")
    return
  }

  const first = items[0] as Record<string, unknown>

  // Filter out columns that are less useful for display
  const columnsToHide = ["id", "object", "url", "updated_at"]

  const keys = Object.keys(first).filter(
    k =>
      !columnsToHide.includes(k) &&
      (typeof first[k] !== "object" || first[k] === null)
  )

  const table = new Table({
    head: keys,
    style: { head: ["cyan"] },
  })

  for (const item of items) {
    const row = item as Record<string, unknown>
    table.push(keys.map(k => formatListCell(k, row[k])))
  }

  console.log(table.toString())
}

function formatListCell(key: string, value: unknown): string {
  // Format amount fields (cents to dollars)
  if (key === "amount" && typeof value === "number") {
    return `$${(value / 100).toFixed(2)}`
  }

  return formatCell(value)
}

function formatObjectAsTable(obj: Record<string, unknown>): void {
  const table = new Table({
    style: { head: ["cyan"] },
    colWidths: [20, 60],
    wordWrap: true,
  })

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const formattedValue = formatNestedObject(
        key,
        value as Record<string, unknown>
      )
      table.push({ [key]: formattedValue })
    } else if (Array.isArray(value)) {
      table.push({ [key]: `[${value.length} items]` })
    } else {
      table.push({ [key]: formatCell(value) })
    }
  }

  console.log(table.toString())
}

function formatNestedObject(key: string, obj: Record<string, unknown>): string {
  const currencyFormatted = formatCurrencyAmount(obj)
  if (currencyFormatted !== JSON.stringify(obj)) {
    return currencyFormatted
  }

  if (key === "recipient" || key === "sender") {
    const name =
      [obj.firstName || obj.first_name, obj.lastName || obj.last_name]
        .filter(Boolean)
        .join(" ") ||
      (obj.businessName as string) ||
      (obj.business_name as string) ||
      ""
    const banks = obj.bankAccounts || obj.bank_accounts
    if (Array.isArray(banks) && banks.length > 0) {
      const bank = banks[0] as Record<string, unknown>
      const bankName = bank.bankName || bank.bank_name || "Bank"
      const acct = String(bank.accountNumber || bank.account_number || "")
      return `${name} — ${bankName} (****${acct.slice(-4)})`
    }
    return name || String(obj.id || "")
  }

  if (key === "fiatAmount" || key === "usdcAmount") {
    const val = obj.value as number
    const curr = obj.currency as Record<string, unknown> | undefined
    const code = curr?.code || obj.currencyId || obj.currency_id || "USD"
    return `${code} ${(val / 100).toFixed(2)}`
  }

  const summary = Object.entries(obj)
    .filter(([, v]) => typeof v !== "object" || v === null)
    .map(([k, v]) => `${k}: ${formatCell(v)}`)
    .slice(0, 4)
    .join(", ")
  return summary || JSON.stringify(obj)
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "-"

  // Format ISO date strings to human-readable format
  if (typeof value === "string" && isISODate(value)) {
    return formatDate(value)
  }

  return String(value)
}

function isISODate(str: string): boolean {
  // Check if string looks like ISO 8601 date
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(str)
}

function formatDate(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  // If within last 7 days, show relative time
  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    if (diffHours === 0) {
      const diffMins = Math.floor(diffMs / (1000 * 60))
      return diffMins <= 1 ? "just now" : `${diffMins}m ago`
    }
    return diffHours === 1 ? "1h ago" : `${diffHours}h ago`
  } else if (diffDays === 1) {
    return "yesterday"
  } else if (diffDays < 7) {
    return `${diffDays}d ago`
  }

  // Otherwise show date in format: Jan 15, 2026
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatCurrencyAmount(obj: Record<string, unknown>): string {
  // Check if this looks like a currency amount object with {amount, currency}
  if (
    typeof obj === "object" &&
    obj !== null &&
    "amount" in obj &&
    "currency" in obj
  ) {
    const amount = obj.amount as number
    const currency = obj.currency as string

    // Convert minor units (cents) to major units (dollars)
    const dollars = (amount / 100).toFixed(2)

    return `${currency} ${dollars}`
  }

  // Not a currency amount, return JSON
  return JSON.stringify(obj)
}
