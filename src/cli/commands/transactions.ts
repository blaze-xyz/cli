import { Command } from "commander"
import { getClient, getGlobalOpts, handleError } from "../utils"
import { formatOutput } from "../output"

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
          const result = await client.listTransactions({
            limit: opts.limit,
            type: opts.type,
            status: opts.status,
          })
          formatOutput(result.data, globals.format)
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
        const transaction = await client.getTransaction(id)

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
