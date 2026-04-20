import { Command } from "commander"
import { BlazeClient } from "../../sdk/client"
import {
  resolveApiKey,
  resolveBaseUrl,
  saveConfig,
  loadConfig,
  detectEnvironment,
} from "../../sdk/config"
import { handleError } from "../utils"

export function registerAuthCommands(program: Command): void {
  const auth = program.command("auth").description("Manage authentication")

  auth
    .command("login")
    .description("Authenticate with an API key")
    .requiredOption("--api-key <key>", "Your Blaze API key")
    .action(async (opts: { apiKey: string }) => {
      try {
        const baseUrl = resolveBaseUrl(program.opts().baseUrl as string)
        const client = new BlazeClient({
          apiKey: opts.apiKey,
          baseUrl,
        })

        // Validate the key by making an API call
        console.log("Validating API key...")
        await client.getBalance()

        const env = detectEnvironment(opts.apiKey)
        saveConfig({
          api_key: opts.apiKey,
          base_url: baseUrl !== "https://api.blaze.money" ? baseUrl : undefined,
          environment: env,
        })

        console.log(`Authenticated successfully (${env} mode)`)
        console.log("API key saved to ~/.blaze/config.json")
      } catch (err) {
        handleError(err)
      }
    })

  auth
    .command("whoami")
    .description("Display current authentication info")
    .action(() => {
      const apiKey = resolveApiKey(program.opts().apiKey as string)
      if (!apiKey) {
        console.error(
          "Not authenticated. Run: blaze auth login --api-key <key>"
        )
        process.exit(1)
      }

      const config = loadConfig()
      const env = detectEnvironment(apiKey)
      const masked = maskApiKey(apiKey)

      console.log(`API key:      ${masked}`)
      console.log(`Environment:  ${env}`)
      if (config?.base_url) {
        console.log(`Base URL:     ${config.base_url}`)
      }
    })
}

function maskApiKey(key: string): string {
  if (key.length <= 12) return "****"
  const prefix = key.slice(0, 8)
  const suffix = key.slice(-4)
  return `${prefix}****${suffix}`
}
