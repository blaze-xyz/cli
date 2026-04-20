import { Command } from "commander"
import { getClient, getGlobalOpts, handleError } from "../utils"
import { formatOutput } from "../output"
import type { Currency } from "../../sdk/types"

export function registerPaylinksCommands(program: Command): void {
  const paylinks = program
    .command("paylinks")
    .description("Manage payment links")

  paylinks
    .command("list")
    .description("List payment links")
    .option("--limit <n>", "Number of results", parseInt)
    .action(async (opts: { limit?: number }) => {
      try {
        const globals = getGlobalOpts(program)
        const client = getClient(globals)
        const result = await client.listPaymentLinks({
          limit: opts.limit,
        })
        formatOutput(result.data, globals.format)
      } catch (err) {
        handleError(err)
      }
    })

  paylinks
    .command("get <id>")
    .description("Get a payment link by ID")
    .action(async (id: string) => {
      try {
        const globals = getGlobalOpts(program)
        const client = getClient(globals)
        const link = await client.getPaymentLink(id)
        formatOutput(link, globals.format)
      } catch (err) {
        handleError(err)
      }
    })

  paylinks
    .command("create")
    .description("Create a new payment link")
    .requiredOption("--amount <n>", "Payment amount", parseFloat)
    .option("--currency <code>", "Currency code (default: USD)")
    .option("--name <name>", "Payment link name")
    .option("--note <note>", "Payment link note")
    .action(
      async (opts: {
        amount: number
        currency?: string
        name?: string
        note?: string
      }) => {
        try {
          const globals = getGlobalOpts(program)
          const client = getClient(globals)
          const link = await client.createPaymentLink({
            amount: opts.amount,
            currency: opts.currency as Currency | undefined,
            name: opts.name,
            note: opts.note,
          })
          formatOutput(link, globals.format)
        } catch (err) {
          handleError(err)
        }
      }
    )

  paylinks
    .command("update <id>")
    .description("Update a payment link")
    .option("--name <name>", "Payment link name")
    .option("--note <note>", "Payment link note")
    .action(async (id: string, opts: { name?: string; note?: string }) => {
      try {
        const globals = getGlobalOpts(program)
        const client = getClient(globals)
        const link = await client.updatePaymentLink(id, {
          name: opts.name,
          note: opts.note,
        })
        formatOutput(link, globals.format)
      } catch (err) {
        handleError(err)
      }
    })

  paylinks
    .command("cancel <id>")
    .description("Cancel a payment link")
    .action(async (id: string) => {
      try {
        const globals = getGlobalOpts(program)
        const client = getClient(globals)
        await client.cancelPaymentLink(id)
        console.log(`Payment link ${id} cancelled.`)
      } catch (err) {
        handleError(err)
      }
    })
}
