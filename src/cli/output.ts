import Table from "cli-table3"

export function formatOutput(
  data: unknown,
  format: "json" | "table" = "table"
): void {
  try {
    if (format === "json") {
      console.log(JSON.stringify(cleanForJson(data), null, 2))
      return
    }

    if (Array.isArray(data)) {
      formatListAsTable(data)
    } else if (typeof data === "object" && data !== null) {
      formatObjectAsTable(data as Record<string, unknown>)
    } else {
      console.log(String(data))
    }
  } catch {
    console.log(JSON.stringify(data, null, 2))
  }
}

// --- JSON cleanup (Task 2) ---

const KEYS_TO_STRIP = ["object", "updated_at"]

function cleanForJson(data: unknown): unknown {
  if (Array.isArray(data)) {
    return data.map(item => cleanForJson(item))
  }
  if (typeof data === "object" && data !== null) {
    const obj = data as Record<string, unknown>
    const cleaned: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      if (KEYS_TO_STRIP.includes(key)) continue
      if (value === null || value === undefined) continue
      if (key === "metadata" && isEmptyObject(value)) continue
      cleaned[key] = cleanForJson(value)
    }
    return cleaned
  }
  return data
}

function isEmptyObject(val: unknown): boolean {
  return (
    typeof val === "object" &&
    val !== null &&
    !Array.isArray(val) &&
    Object.keys(val).length === 0
  )
}

// --- Table formatting ---

function formatListAsTable(items: unknown[]): void {
  if (items.length === 0) {
    console.log("No results.")
    return
  }

  const first = items[0] as Record<string, unknown>

  const columnsToHide = ["object", "url", "updated_at", "metadata"]

  const keys = Object.keys(first).filter(k => {
    if (columnsToHide.includes(k)) return false
    const val = first[k]
    if (typeof val === "object" && val !== null && !Array.isArray(val)) {
      return isDisplayableObject(k, val as Record<string, unknown>)
    }
    return true
  })

  const table = new Table({
    head: keys.map(k => prettifyHeader(k)),
    style: { head: ["cyan"] },
  })

  for (const item of items) {
    const row = item as Record<string, unknown>
    table.push(keys.map(k => formatListCell(k, row[k])))
  }

  console.log(table.toString())
}

function isDisplayableObject(
  key: string,
  obj: Record<string, unknown>
): boolean {
  const displayable = [
    "fiatAmount",
    "fiat_amount",
    "usdcAmount",
    "usdc_amount",
    "sender",
    "recipient",
    "amount",
    "currency",
    "source",
    "destination",
  ]
  if (displayable.includes(key)) return true
  if ("amount" in obj && "currency" in obj) return true
  if ("value" in obj && ("currencyId" in obj || "currency_id" in obj))
    return true
  return false
}

function prettifyHeader(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\bId\b/g, "ID")
    .replace(/\bUrl\b/g, "URL")
}

function formatListCell(key: string, value: unknown): string {
  if (value === null || value === undefined) return "–"

  if (
    (key === "amount" || key === "total" || key === "fee") &&
    typeof value === "number"
  ) {
    return formatMoney(value)
  }

  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>
    if ("amount" in obj && "currency" in obj) {
      return formatCurrencyObject(obj)
    }
    if ("value" in obj && ("currencyId" in obj || "currency_id" in obj)) {
      const v = obj.value as number
      const code =
        (obj.currencyId as string) || (obj.currency_id as string) || "USD"
      return `${formatMoney(v)} ${code}`
    }
    if (key === "sender" || key === "recipient") {
      return formatPersonSummary(obj)
    }
    if (key === "source" || key === "destination") {
      return formatEndpoint(obj)
    }
    if (Array.isArray(value)) {
      return `${(value as unknown[]).length} items`
    }
    return summarizeObject(obj)
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No"
  }

  if (typeof value === "string") {
    if (isISODate(value)) return formatDate(value)
    if (value.length > 40) return value.slice(0, 37) + "..."
  }

  return String(value)
}

// --- Single-object detail view ---

function formatObjectAsTable(obj: Record<string, unknown>): void {
  const keysToSkip = ["object", "updated_at"]

  const table = new Table({
    style: { head: ["cyan"] },
    colWidths: [22, 56],
    wordWrap: true,
  })

  for (const [key, value] of Object.entries(obj)) {
    if (keysToSkip.includes(key)) continue
    if (value === null || value === undefined) continue
    if (key === "metadata" && isEmptyObject(value)) continue

    const label = prettifyHeader(key)

    if (Array.isArray(value)) {
      if (value.length === 0) continue
      if (typeof value[0] === "object") {
        table.push({ [label]: formatArraySummary(key, value) })
      } else {
        table.push({ [label]: value.join(", ") })
      }
    } else if (typeof value === "object") {
      table.push({
        [label]: formatNestedForDetail(key, value as Record<string, unknown>),
      })
    } else if (typeof value === "boolean") {
      table.push({ [label]: value ? "Yes" : "No" })
    } else if (typeof value === "string" && isISODate(value)) {
      table.push({ [label]: formatDate(value) })
    } else if (
      (key.toLowerCase().includes("amount") ||
        key === "fee" ||
        key === "total" ||
        key === "subtotal" ||
        key === "tax") &&
      typeof value === "number"
    ) {
      table.push({ [label]: formatMoney(value) })
    } else {
      table.push({ [label]: String(value) })
    }
  }

  console.log(table.toString())
}

function formatArraySummary(key: string, items: unknown[]): string {
  if (key === "bank_accounts" || key === "bankAccounts") {
    return (items as Record<string, unknown>[])
      .map(ba => {
        const bank = ba.bank_name || ba.bankName || "Bank"
        const acct = String(ba.account_number || ba.accountNumber || "")
        const currency = ba.currency_id || ba.currencyId || ""
        const last4 = acct.slice(-4)
        return `${bank} (****${last4})${currency ? ` ${currency}` : ""}`
      })
      .join("\n")
  }
  if (key === "crypto_addresses" || key === "cryptoAddresses") {
    return (items as Record<string, unknown>[])
      .map(ca => `${ca.network}: ${ca.address}`)
      .join("\n")
  }
  if (key === "external_accounts") {
    return (items as Record<string, unknown>[])
      .map(ea => `${ea.bank_name || ea.type} (****${ea.account_last4 || ""})`)
      .join("\n")
  }
  if (key === "line_items") {
    return (items as Record<string, unknown>[])
      .map(li => {
        const qty = (li.quantity as number) || 1
        const price = formatMoney(li.unit_price as number)
        return `${li.description} x${qty} @ ${price}`
      })
      .join("\n")
  }
  if (key === "scopes" || key === "events") {
    return (items as string[]).join(", ")
  }
  return `${items.length} items`
}

function formatNestedForDetail(
  key: string,
  obj: Record<string, unknown>
): string {
  if ("amount" in obj && "currency" in obj) {
    return formatCurrencyObject(obj)
  }
  if ("value" in obj && ("currencyId" in obj || "currency_id" in obj)) {
    const v = obj.value as number
    const code =
      (obj.currencyId as string) || (obj.currency_id as string) || "USD"
    return `${formatMoney(v)} ${code}`
  }
  if (key === "sender" || key === "recipient") {
    return formatPersonSummary(obj)
  }
  if (key === "source" || key === "destination") {
    return formatEndpoint(obj)
  }
  if (key === "evidence") {
    const desc = obj.description || ""
    const docs = obj.document_urls as string[] | undefined
    const parts = [String(desc)]
    if (docs && docs.length > 0) parts.push(`${docs.length} document(s)`)
    return parts.join("\n")
  }
  if (key === "address") {
    const parts = [
      obj.line1,
      obj.city,
      obj.state,
      obj.postal_code,
      obj.country,
    ].filter(Boolean)
    return parts.join(", ") || "–"
  }

  const entries = Object.entries(obj).filter(
    ([, v]) => v !== null && v !== undefined
  )
  if (entries.length <= 5) {
    return entries
      .map(([k, v]) => {
        if (typeof v === "string" && isISODate(v))
          return `${prettifyHeader(k)}: ${formatDate(v)}`
        return `${prettifyHeader(k)}: ${String(v)}`
      })
      .join("\n")
  }
  return summarizeObject(obj)
}

function formatPersonSummary(obj: Record<string, unknown>): string {
  const name =
    [obj.firstName || obj.first_name, obj.lastName || obj.last_name]
      .filter(Boolean)
      .join(" ") ||
    (obj.businessName as string) ||
    (obj.business_name as string) ||
    ""
  const banks = (obj.bankAccounts || obj.bank_accounts) as
    | Record<string, unknown>[]
    | undefined
  if (Array.isArray(banks) && banks.length > 0) {
    const bank = banks[0]
    const bankName = bank.bankName || bank.bank_name || "Bank"
    const acct = String(bank.accountNumber || bank.account_number || "")
    return `${name} — ${bankName} (****${acct.slice(-4)})`
  }
  return name || String(obj.id || "Unknown")
}

function formatEndpoint(obj: Record<string, unknown>): string {
  const type = (obj.type as string) || ""
  const id = (obj.id as string) || ""
  const label = type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
  return id ? `${label} (${id})` : label || "–"
}

function formatCurrencyObject(obj: Record<string, unknown>): string {
  const amount = obj.amount as number
  const currency = obj.currency as string
  return `${formatMoney(amount)} ${currency}`
}

function formatMoney(cents: number): string {
  const major = Math.abs(cents) / 100
  const sign = cents < 0 ? "-" : ""
  return `${sign}$${major.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function summarizeObject(obj: Record<string, unknown>): string {
  const entries = Object.entries(obj)
    .filter(([, v]) => typeof v !== "object" && v !== null && v !== undefined)
    .slice(0, 4)
  return entries
    .map(([k, v]) => `${prettifyHeader(k)}: ${String(v)}`)
    .join(", ")
}

function isISODate(str: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(str)
}

function formatDate(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

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

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}
