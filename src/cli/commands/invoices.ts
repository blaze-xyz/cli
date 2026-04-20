import { Command } from "commander"
import { getClient, getGlobalOpts, handleError } from "../utils"
import { formatOutput } from "../output"

export function registerInvoicesCommands(program: Command): void {
  const invoices = program.command("invoices").description("Manage invoices")

  invoices
    .command("list")
    .description("List invoices")
    .option("--limit <n>", "Number of results", parseInt)
    .option("--status <status>", "Filter by status")
    .option("--customer-id <id>", "Filter by customer ID")
    .action(
      async (opts: {
        limit?: number
        status?: string
        customerId?: string
      }) => {
        try {
          const globals = getGlobalOpts(program)
          const client = getClient(globals)
          const result = await client.listInvoices({
            limit: opts.limit,
            status: opts.status,
            customer_id: opts.customerId,
          })
          formatOutput(result.data, globals.format)
        } catch (err) {
          handleError(err)
        }
      }
    )

  invoices
    .command("get <id>")
    .description("Get an invoice by ID")
    .action(async (id: string) => {
      try {
        const globals = getGlobalOpts(program)
        const client = getClient(globals)
        const result = await client.getInvoice(id)
        formatOutput(result, globals.format)
      } catch (err) {
        handleError(err)
      }
    })

  invoices
    .command("create")
    .description("Create a new invoice")
    .requiredOption("--customer-id <id>", "Customer ID")
    .requiredOption("--line-items <json>", "Line items as JSON string")
    .option("--tax <n>", "Tax amount", parseFloat)
    .option("--description <desc>", "Invoice description")
    .option("--due-date <date>", "Due date")
    .option("--currency <code>", "Currency code")
    .action(
      async (opts: {
        customerId: string
        lineItems: string
        tax?: number
        description?: string
        dueDate?: string
        currency?: string
      }) => {
        try {
          const globals = getGlobalOpts(program)
          const client = getClient(globals)
          const result = await client.createInvoice({
            customer_id: opts.customerId,
            line_items: JSON.parse(opts.lineItems),
            tax: opts.tax,
            description: opts.description,
            due_date: opts.dueDate,
            currency_code: opts.currency,
          })
          formatOutput(result, globals.format)
        } catch (err) {
          handleError(err)
        }
      }
    )

  invoices
    .command("send <id>")
    .description("Send an invoice to the customer")
    .action(async (id: string) => {
      try {
        const globals = getGlobalOpts(program)
        const client = getClient(globals)
        const result = await client.sendInvoice(id)
        formatOutput(result, globals.format)
      } catch (err) {
        handleError(err)
      }
    })

  invoices
    .command("mark-paid <id>")
    .description("Mark an invoice as paid")
    .action(async (id: string) => {
      try {
        const globals = getGlobalOpts(program)
        const client = getClient(globals)
        const result = await client.markInvoicePaid(id)
        formatOutput(result, globals.format)
      } catch (err) {
        handleError(err)
      }
    })

  invoices
    .command("void <id>")
    .description("Void an invoice")
    .action(async (id: string) => {
      try {
        const globals = getGlobalOpts(program)
        const client = getClient(globals)
        const result = await client.voidInvoice(id)
        formatOutput(result, globals.format)
      } catch (err) {
        handleError(err)
      }
    })
}
