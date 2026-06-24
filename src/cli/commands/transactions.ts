import { Command } from "commander"
import Table from "cli-table3"
import stringWidth from "string-width"
import {
  getClient,
  getGlobalOpts,
  handleError,
  personalAccountLabel,
  withSpinner,
} from "../utils"
import { formatOutput } from "../output"
import { getAuth } from "../auth-utils"
import { resolveAccountContext } from "../auth-context"

function safeDesc(str: string): string {
  if (stringWidth(str) === actualTerminalWidth(str)) return str.substring(0, 30)
  return str
    .replace(
      /\p{Emoji_Presentation}[\u{FE0F}\u{200D}\p{Emoji_Modifier}\p{Emoji_Component}\u{2640}\u{2642}]*/gu,
      "·"
    )
    .substring(0, 30)
}

function actualTerminalWidth(str: string): number {
  let w = 0
  for (const ch of str) {
    const cp = ch.codePointAt(0) || 0
    if (
      cp >= 0x1100 &&
      (cp <= 0x115f ||
        cp === 0x2329 ||
        cp === 0x232a ||
        (cp >= 0x2e80 && cp <= 0x3247) ||
        (cp >= 0x3250 && cp <= 0x4dbf) ||
        (cp >= 0x4e00 && cp <= 0xa4c6) ||
        (cp >= 0xa960 && cp <= 0xa97c) ||
        (cp >= 0xac00 && cp <= 0xd7a3) ||
        (cp >= 0xf900 && cp <= 0xfaff) ||
        (cp >= 0xfe10 && cp <= 0xfe19) ||
        (cp >= 0xfe30 && cp <= 0xfe6b) ||
        (cp >= 0xff01 && cp <= 0xff60) ||
        (cp >= 0xffe0 && cp <= 0xffe6) ||
        (cp >= 0x1f000 && cp <= 0x1ffff) ||
        (cp >= 0x20000 && cp <= 0x2fffd) ||
        (cp >= 0x30000 && cp <= 0x3fffd))
    ) {
      w += 2
    } else if (cp >= 0x20) {
      w += 1
    }
  }
  return w
}

function formatTxTable(data: Array<Record<string, unknown>>): void {
  const rows: string[][] = []
  for (const tx of data) {
    const date = tx.created_at
      ? new Date(tx.created_at as string).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
      : "—"
    const amount = tx.amount != null ? Number(tx.amount) / 100 : 0
    const currency = (tx.currency as string) || "USD"
    const sign = (tx.type as string) === "received" ? "+" : "-"
    const amtStr = `${sign}$${Math.abs(amount).toFixed(2)} ${currency}`
    const status = (tx.status as string) || "—"
    const note =
      (tx.note as string) ||
      (tx.description as string) ||
      (tx.type as string) ||
      "—"
    const desc = safeDesc(note)
    rows.push([date, amtStr, status, desc])
  }

  const table = new Table({
    head: ["Date", "Amount", "Status", "Description"],
    style: { head: [], border: [] },
  })
  for (const row of rows) {
    table.push(row)
  }
  console.log(table.toString())
}

export function registerTransactionsCommands(program: Command): void {
  const transactions = program
    .command("transactions")
    .description("View transactions")

  transactions
    .command("list")
    .description("List transactions")
    .option("--limit <n>", "Number of results", parseInt)
    .option("--type <type>", "Filter by type")
    .option("--status <status>", "Filter by status")
    .action(
      async (opts: { limit?: number; type?: string; status?: string }) => {
        try {
          const globals = getGlobalOpts(program)
          const client = await getClient(globals)

          // Determine context — mirror what getClient sends, honoring
          // --personal / --business / BLAZE_PERSONAL / BLAZE_BUSINESS_ID / config.
          const accountCtx = resolveAccountContext(globals)
          const isPersonal = accountCtx.personal || !accountCtx.businessId

          // Personal mode uses /v1/payments (consumer transactions)
          if (isPersonal) {
            const personalResult = await withSpinner(
              "Loading transactions…",
              () =>
                client.get<{
                  object: string
                  data: Array<Record<string, unknown>>
                  has_more: boolean
                }>("/v1/payments" + (opts.limit ? `?limit=${opts.limit}` : "")),
              { format: globals.format }
            )

            if (globals.format === "json") {
              formatOutput(personalResult.data, "json")
              return
            }

            const auth = await getAuth()
            const name = auth?.user?.blazetag || auth?.user?.email
            console.log("")
            console.log(`  ${personalAccountLabel(name)} — Recent Transactions`)
            console.log("")
            if (personalResult.data.length === 0) {
              console.log("  No transactions yet.")
            } else {
              formatTxTable(personalResult.data)
            }
            console.log("")
            console.log(
              "  ⌁ Showing personal transactions. Use --business for business activity."
            )
            console.log("")
            return
          }

          const result = await withSpinner(
            "Loading transactions…",
            () =>
              client.listTransactions({
                limit: opts.limit,
                type: opts.type,
                status: opts.status,
              }),
            { format: globals.format }
          )

          if (globals.format === "json") {
            formatOutput(result.data, "json")
            return
          }
          const businessId = accountCtx.businessId
          let businessName = businessId || "Business"
          try {
            const bResult = await client.get<{
              object: string
              data: Array<{ id: string; name: string; role: string }>
            }>("/v1/me/businesses")
            const match = bResult.data.find(
              (b: { id: string; name: string; role: string }) =>
                b.id === businessId
            )
            if (match) businessName = match.name
          } catch {
            // Use ID as fallback
          }
          const accountLabel = `${businessName} — Recent Transactions`
          const hint =
            "Showing business transactions. Use --personal for personal activity."

          console.log("")
          console.log(`  ${accountLabel}`)
          console.log("")
          if (result.data.length === 0) {
            console.log("  No transactions yet.")
          } else {
            formatTxTable(
              result.data as unknown as Array<Record<string, unknown>>
            )
          }
          console.log("")
          console.log(`  ⌁ ${hint}`)
          console.log("")
        } catch (err) {
          handleError(err)
        }
      }
    )

  transactions
    .command("get <id>")
    .description("Get a transaction by ID")
    .action(async (id: string) => {
      try {
        const globals = getGlobalOpts(program)
        const client = await getClient(globals)
        const transaction = await withSpinner(
          `Loading transaction ${id}…`,
          () => client.getTransaction(id),
          { format: globals.format }
        )

        if (globals.format === "json") {
          formatOutput(transaction, "json")
          return
        }

        const t = transaction as unknown as Record<string, unknown>
        console.log("")
        console.log(`  Transaction ${t.id}`)
        console.log(`  ${"─".repeat(50)}`)
        console.log(`  Type:         ${t.type}`)
        console.log(`  Status:       ${t.status}`)
        console.log(
          `  Amount:       $${((t.amount as number) / 100).toFixed(2)} ${t.currency || "USD"}`
        )
        if (t.description) console.log(`  Description:  ${t.description}`)

        const fiat = t.fiatAmount || t.fiat_amount
        if (fiat && typeof fiat === "object") {
          const f = fiat as Record<string, unknown>
          const v = f.value as number
          const code =
            (f.currencyId as string) || (f.currency_id as string) || ""
          if (v && code && code !== (t.currency as string)) {
            console.log(`  Fiat:         $${(v / 100).toFixed(2)} ${code}`)
          }
        }

        const usdc = t.usdcAmount || t.usdc_amount
        if (usdc && typeof usdc === "object") {
          const u = usdc as Record<string, unknown>
          const v = u.value as number
          if (v) {
            console.log(`  USDC:         $${(v / 100).toFixed(2)}`)
          }
        }

        if (t.exchange_rate || t.exchangeRate) {
          console.log(`  FX Rate:      ${t.exchange_rate || t.exchangeRate}`)
        }

        const recipient = t.recipient || t.recipientName || t.recipient_name
        if (recipient) {
          if (typeof recipient === "object") {
            const r = recipient as Record<string, unknown>
            const name =
              [r.first_name || r.firstName, r.last_name || r.lastName]
                .filter(Boolean)
                .join(" ") ||
              (r.business_name as string) ||
              ""
            if (name) console.log(`  Recipient:    ${name}`)
          } else {
            console.log(`  Recipient:    ${recipient}`)
          }
        }

        const sender = t.sender || t.senderName || t.sender_name
        if (sender) {
          if (typeof sender === "object") {
            const s = sender as Record<string, unknown>
            const name =
              [s.first_name || s.firstName, s.last_name || s.lastName]
                .filter(Boolean)
                .join(" ") || ""
            if (name) console.log(`  Sender:       ${name}`)
          } else {
            console.log(`  Sender:       ${sender}`)
          }
        }

        if (t.created_at) {
          console.log(
            `  Date:         ${new Date(t.created_at as string).toLocaleString()}`
          )
        }
        console.log("")
      } catch (err) {
        handleError(err)
      }
    })
}
