import { Command } from "commander"
import { BlazeClient } from "../../sdk/client"
import {
  resolveApiKey,
  resolveConfigApiKey,
  resolveBaseUrl,
} from "../../sdk/config"
import { getAuthToken } from "../auth-utils"
import { runAgent } from "../../agent"

const SPARK_API_URL = process.env.BLAZE_API_URL ?? "https://api.blaze.money"

export const agentCommand = new Command("agent")
  .description("Run a natural language payment command")
  .argument(
    "<command>",
    'Natural language command (e.g. "send $500 to john@example.com")'
  )
  .option("-k, --api-key <key>", "API key (overrides env/config)")
  .option("-u, --base-url <url>", "Base URL (overrides env/config)")
  .action(
    async (command: string, opts: { apiKey?: string; baseUrl?: string }) => {
      // Explicit API key (flag or env var) always wins
      const explicitApiKey = resolveApiKey(opts.apiKey)
      if (explicitApiKey) {
        const client = new BlazeClient({
          apiKey: explicitApiKey,
          baseUrl: resolveBaseUrl(opts.baseUrl),
        })
        await runAgent(command, client)
        return
      }

      // Active bearer token takes priority over config-file API key
      const bearerToken = await getAuthToken()
      if (bearerToken) {
        const client = new BlazeClient({
          bearerToken,
          baseUrl: opts.baseUrl ?? SPARK_API_URL,
        })
        await runAgent(command, client)
        return
      }

      // Fall back to config-file API key
      const configApiKey = resolveConfigApiKey()
      if (configApiKey) {
        const client = new BlazeClient({
          apiKey: configApiKey,
          baseUrl: resolveBaseUrl(opts.baseUrl),
        })
        await runAgent(command, client)
        return
      }

      console.error("Not authenticated. Run `blaze auth` or set BLAZE_API_KEY.")
      process.exit(1)
    }
  )
