import { Command } from "commander"
import { confirm } from "@inquirer/prompts"
import { getClient, getGlobalOpts, handleError } from "../utils"
import { formatOutput } from "../output"
import type { WebhookEvent } from "../../sdk/types"

export function registerWebhooksCommands(program: Command): void {
  const webhooks = program
    .command("webhooks")
    .description("Manage webhook endpoints")

  webhooks
    .command("list")
    .description("List webhook endpoints")
    .option("--limit <n>", "Number of results", parseInt)
    .action(async (opts: { limit?: number }) => {
      try {
        const globals = getGlobalOpts(program)
        const client = getClient(globals)
        const result = await client.listWebhooks({ limit: opts.limit })
        formatOutput(result.data, globals.format)
      } catch (err) {
        handleError(err)
      }
    })

  webhooks
    .command("get <id>")
    .description("Get a webhook endpoint by ID")
    .action(async (id: string) => {
      try {
        const globals = getGlobalOpts(program)
        const client = getClient(globals)
        const result = await client.getWebhook(id)
        formatOutput(result, globals.format)
      } catch (err) {
        handleError(err)
      }
    })

  webhooks
    .command("create")
    .description("Create a new webhook endpoint")
    .requiredOption("--url <url>", "Endpoint URL")
    .option("--events <events>", "Comma-separated event types")
    .option("--description <desc>", "Description")
    .action(
      async (opts: { url: string; events?: string; description?: string }) => {
        try {
          const globals = getGlobalOpts(program)
          const client = getClient(globals)
          const result = await client.createWebhook({
            url: opts.url,
            events: opts.events
              ? (opts.events
                  .split(",")
                  .map((s: string) => s.trim()) as WebhookEvent[])
              : undefined,
            description: opts.description,
          })
          console.log("\nSigning Secret (save this — it won't be shown again):")
          console.log(result.secret)
          console.log("")
          formatOutput(result, globals.format)
        } catch (err) {
          handleError(err)
        }
      }
    )

  webhooks
    .command("update <id>")
    .description("Update a webhook endpoint")
    .option("--url <url>", "Endpoint URL")
    .option("--events <events>", "Comma-separated event types")
    .option("--enabled", "Enable the webhook")
    .option("--disabled", "Disable the webhook")
    .option("--description <desc>", "Description")
    .action(
      async (
        id: string,
        opts: {
          url?: string
          events?: string
          enabled?: boolean
          disabled?: boolean
          description?: string
        }
      ) => {
        try {
          const globals = getGlobalOpts(program)
          const client = getClient(globals)
          const data: {
            url?: string
            events?: WebhookEvent[]
            enabled?: boolean
            description?: string
          } = {}
          if (opts.url) data.url = opts.url
          if (opts.events)
            data.events = opts.events
              .split(",")
              .map((s: string) => s.trim()) as WebhookEvent[]
          if (opts.enabled) data.enabled = true
          if (opts.disabled) data.enabled = false
          if (opts.description) data.description = opts.description
          const result = await client.updateWebhook(id, data)
          formatOutput(result, globals.format)
        } catch (err) {
          handleError(err)
        }
      }
    )

  webhooks
    .command("delete <id>")
    .description("Delete a webhook endpoint")
    .option("-y, --yes", "Skip confirmation prompt")
    .action(async (id: string, opts: { yes?: boolean }) => {
      try {
        if (!opts.yes) {
          const confirmed = await confirm({
            message: `Delete webhook ${id}? This cannot be undone.`,
          })
          if (!confirmed) {
            console.log("Cancelled.")
            return
          }
        }
        const globals = getGlobalOpts(program)
        const client = getClient(globals)
        await client.deleteWebhook(id)
        console.log(`Webhook ${id} deleted.`)
      } catch (err) {
        handleError(err)
      }
    })
}
