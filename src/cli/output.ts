import Table from "cli-table3"

export function formatOutput(
  data: unknown,
  format: "json" | "table" = "json"
): void {
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
}

function formatListAsTable(items: unknown[]): void {
  if (items.length === 0) {
    console.log("No results.")
    return
  }

  const first = items[0] as Record<string, unknown>
  const keys = Object.keys(first).filter(
    k => typeof first[k] !== "object" || first[k] === null
  )

  const table = new Table({
    head: keys,
    style: { head: ["cyan"] },
  })

  for (const item of items) {
    const row = item as Record<string, unknown>
    table.push(keys.map(k => formatCell(row[k])))
  }

  console.log(table.toString())
}

function formatObjectAsTable(obj: Record<string, unknown>): void {
  const table = new Table({
    style: { head: ["cyan"] },
  })

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      table.push({ [key]: JSON.stringify(value) })
    } else if (Array.isArray(value)) {
      table.push({ [key]: `[${value.length} items]` })
    } else {
      table.push({ [key]: formatCell(value) })
    }
  }

  console.log(table.toString())
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "-"
  return String(value)
}
