import { Command } from "commander"
import { getClient, getGlobalOpts, handleError } from "../utils"
import { formatOutput } from "../output"

export function registerSubscriptionsCommands(program: Command): void {
  const subscriptions = program
    .command("subscriptions")
    .description("Manage subscriptions")

  subscriptions
    .command("list")
    .description("List subscriptions")
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
          const result = await client.listSubscriptions({
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

  subscriptions
    .command("get <id>")
    .description("Get a subscription by ID")
    .action(async (id: string) => {
      try {
        const globals = getGlobalOpts(program)
        const client = getClient(globals)
        const result = await client.getSubscription(id)
        formatOutput(result, globals.format)
      } catch (err) {
        handleError(err)
      }
    })

  subscriptions
    .command("create")
    .description("Create a new subscription")
    .requiredOption("--customer-id <id>", "Customer ID")
    .requiredOption("--product-id <id>", "Product ID")
    .option("--interval <interval>", "Billing interval")
    .action(
      async (opts: {
        customerId: string
        productId: string
        interval?: string
      }) => {
        try {
          const globals = getGlobalOpts(program)
          const client = getClient(globals)
          const result = await client.createSubscription({
            customer_id: opts.customerId,
            product_id: opts.productId,
            interval: opts.interval,
          })
          formatOutput(result, globals.format)
        } catch (err) {
          handleError(err)
        }
      }
    )

  subscriptions
    .command("cancel <id>")
    .description("Cancel a subscription")
    .option("--immediately", "Cancel immediately instead of at period end")
    .action(async (id: string, opts: { immediately?: boolean }) => {
      try {
        const globals = getGlobalOpts(program)
        const client = getClient(globals)
        const result = await client.cancelSubscription(id, opts.immediately)
        formatOutput(result, globals.format)
      } catch (err) {
        handleError(err)
      }
    })

  subscriptions
    .command("pause <id>")
    .description("Pause a subscription")
    .action(async (id: string) => {
      try {
        const globals = getGlobalOpts(program)
        const client = getClient(globals)
        const result = await client.pauseSubscription(id)
        formatOutput(result, globals.format)
      } catch (err) {
        handleError(err)
      }
    })

  subscriptions
    .command("resume <id>")
    .description("Resume a paused subscription")
    .action(async (id: string) => {
      try {
        const globals = getGlobalOpts(program)
        const client = getClient(globals)
        const result = await client.resumeSubscription(id)
        formatOutput(result, globals.format)
      } catch (err) {
        handleError(err)
      }
    })
}
