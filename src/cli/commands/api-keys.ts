import { Command } from "commander"
import { confirm } from "@inquirer/prompts"
import { getClient, getGlobalOpts, handleError } from "../utils"
import { formatOutput } from "../output"
import type { ApiKeyScope } from "../../sdk/types"

export function registerApiKeysCommands(program: Command): void {
  const apiKeys = program.command("api-keys").description("Manage API keys")

  apiKeys
    .command("list")
    .description("List API keys")
    .action(async () => {
      try {
        const globals = getGlobalOpts(program)
        const client = getClient(globals)
        const result = await client.listApiKeys()
        formatOutput(result.data, globals.format)
      } catch (err) {
        handleError(err)
      }
    })

  apiKeys
    .command("create")
    .description("Create a new API key")
    .requiredOption("--name <name>", "Key name")
    .requiredOption("--scopes <scopes>", "Comma-separated scopes")
    .option("--test", "Create a test mode key")
    .option("--expires-in-days <n>", "Expiration in days", parseInt)
    .action(
      async (opts: {
        name: string
        scopes: string
        test?: boolean
        expiresInDays?: number
      }) => {
        try {
          const globals = getGlobalOpts(program)
          const client = getClient(globals)
          const result = await client.createApiKey({
            name: opts.name,
            scopes: opts.scopes
              .split(",")
              .map((s: string) => s.trim()) as ApiKeyScope[],
            is_test: opts.test ?? false,
            expires_in_days: opts.expiresInDays,
          })
          console.log("\nAPI Key (save this — it won't be shown again):")
          console.log(result.key)
          console.log("")
          formatOutput(result, globals.format)
        } catch (err) {
          handleError(err)
        }
      }
    )

  apiKeys
    .command("update <id>")
    .description("Update an API key's scopes")
    .requiredOption("--scopes <scopes>", "Comma-separated scopes")
    .action(async (id: string, opts: { scopes: string }) => {
      try {
        const globals = getGlobalOpts(program)
        const client = getClient(globals)
        const result = await client.updateApiKeyScopes(id, {
          scopes: opts.scopes
            .split(",")
            .map((s: string) => s.trim()) as ApiKeyScope[],
        })
        formatOutput(result, globals.format)
      } catch (err) {
        handleError(err)
      }
    })

  apiKeys
    .command("revoke <id>")
    .description("Revoke an API key")
    .option("--reason <reason>", "Reason for revocation")
    .option("-y, --yes", "Skip confirmation prompt")
    .action(async (id: string, opts: { reason?: string; yes?: boolean }) => {
      try {
        if (!opts.yes) {
          const confirmed = await confirm({
            message: `Revoke API key ${id}? This cannot be undone.`,
          })
          if (!confirmed) {
            console.log("Cancelled.")
            return
          }
        }
        const globals = getGlobalOpts(program)
        const client = getClient(globals)
        await client.revokeApiKey(id, opts.reason)
        console.log(`API key ${id} revoked.`)
      } catch (err) {
        handleError(err)
      }
    })
}
