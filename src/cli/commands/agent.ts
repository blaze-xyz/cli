import { Command } from "commander"
import { BlazeClient } from "../../sdk/client"
import { resolveApiKey, resolveBaseUrl } from "../../sdk/config"
import { runAgent } from "../../agent"

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
      const apiKey = resolveApiKey(opts.apiKey)
      if (!apiKey) {
        console.error(
          "No API key found. Set BLAZE_API_KEY or run: blaze config set-key <key>"
        )
        process.exit(1)
      }

      const baseUrl = resolveBaseUrl(opts.baseUrl)
      const client = new BlazeClient({ apiKey, baseUrl })

      await runAgent(command, client)
    }
  )
