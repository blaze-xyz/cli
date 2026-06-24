import { Command } from "commander"
import { BlazeClient } from "../../sdk/client"
import { resolveBaseUrl } from "../../sdk/config"
import { resolveCredential, resolveContextHeaders } from "../auth-context"
import { runAgent } from "../../agent"

export const agentCommand = new Command("agent")
  .description("Run a natural language payment command")
  .argument(
    "<command>",
    'Natural language command (e.g. "send $500 to john@example.com")'
  )
  .option("-k, --api-key <key>", "Business API key (overrides env/config)")
  .option(
    "-t, --token <token>",
    "Personal access token (overrides env/config); or set BLAZE_TOKEN"
  )
  .option("-u, --base-url <url>", "Base URL (overrides env/config)")
  .action(
    async (
      command: string,
      opts: { apiKey?: string; token?: string; baseUrl?: string }
    ) => {
      let credential
      try {
        credential = await resolveCredential({
          token: opts.token,
          apiKey: opts.apiKey,
        })
      } catch (err) {
        console.error(err instanceof Error ? err.message : String(err))
        process.exit(1)
      }

      if (!credential) {
        console.error(
          "Not authenticated. Run `blaze auth`, or set BLAZE_TOKEN (personal) " +
            "or BLAZE_API_KEY (business)."
        )
        process.exit(1)
      }

      const baseUrl = resolveBaseUrl(opts.baseUrl)
      const defaultHeaders = resolveContextHeaders()
      const client =
        credential.kind === "bearer"
          ? new BlazeClient({
              bearerToken: credential.token,
              baseUrl,
              defaultHeaders,
            })
          : new BlazeClient({
              apiKey: credential.apiKey,
              baseUrl,
              defaultHeaders,
            })

      await runAgent(command, client)
    }
  )
