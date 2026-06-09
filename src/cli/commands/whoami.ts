import { Command } from "commander"

import {
  resolveApiKey,
  resolveBaseUrl,
  resolveConfigApiKey,
} from "../../sdk/config"
import { getAuth } from "../auth-utils"
import { getClient, getConfig, getGlobalOpts } from "../utils"

const LABEL_WIDTH = 20

function formatRow(label: string, value: string): string {
  return `${label.padEnd(LABEL_WIDTH)}${value}`
}

export function registerWhoamiCommands(program: Command): void {
  program
    .command("whoami")
    .description("Show current authentication and active business context")
    .action(async () => {
      const chalk = (await import("chalk")).default

      const auth = await getAuth()
      const isBearerActive =
        !!auth &&
        !!auth.created_at &&
        !!auth.expires_in &&
        Date.now() < auth.created_at + auth.expires_in * 1000
      const explicitApiKey = resolveApiKey()
      const configApiKey = resolveConfigApiKey()
      const apiBaseUrl = resolveBaseUrl()
      const config = getConfig()
      const activeBusinessId = config?.activeBusinessId

      // Not authenticated case — friendly exit (no process.exit(1))
      if (!isBearerActive && !explicitApiKey && !configApiKey) {
        console.log()
        console.log(chalk.yellow("Not authenticated."))
        console.log(chalk.dim("Run blaze auth to log in."))
        console.log()
        return
      }

      console.log()

      // User
      if (isBearerActive && auth) {
        const userLabel = auth.user.email || auth.user.blazetag || "(unknown)"
        console.log(
          formatRow("User:", `${chalk.green(userLabel)} (${auth.user.id})`)
        )
      } else {
        console.log(formatRow("User:", chalk.dim("(none — API key auth)")))
      }

      // Auth source
      if (isBearerActive && auth) {
        const expiresAtMs = auth.created_at + auth.expires_in * 1000
        const daysRemaining = Math.floor(
          (expiresAtMs - Date.now()) / (1000 * 60 * 60 * 24)
        )
        const expiryText = `expires in ${daysRemaining} day${
          daysRemaining === 1 ? "" : "s"
        }`
        const styledExpiry =
          daysRemaining < 7 ? chalk.yellow(expiryText) : chalk.dim(expiryText)
        console.log(
          formatRow(
            "Auth source:",
            `${chalk.green("Bearer token")} (${styledExpiry})`
          )
        )
      } else if (explicitApiKey) {
        console.log(
          formatRow(
            "Auth source:",
            `${chalk.green("API key")} ${chalk.dim("(from --api-key or BLAZE_API_KEY)")}`
          )
        )
      } else if (configApiKey) {
        console.log(
          formatRow(
            "Auth source:",
            `${chalk.green("API key")} ${chalk.dim("(from config file)")}`
          )
        )
      }

      // Active business — resolve from API
      // Try /v1/me/businesses first; if it fails (e.g. API key auth on consumer-only controller),
      // fall back to /v1/team-members to infer business context
      let businessLabel: string | null = null
      try {
        const client = await getClient({})
        let businesses: Array<{ id: string; name: string; role: string }> = []
        try {
          const result = await client.get<{
            object: string
            data: Array<{ id: string; name: string; role: string }>
          }>("/v1/me/businesses")
          businesses = result.data
        } catch {
          // /v1/me/businesses may reject API key auth — try team-members as fallback
          const teamResult = await client.get<{
            object: string
            data: Array<{ id: string; role: string; email: string | null }>
          }>("/v1/team-members")
          if (teamResult.data.length > 0) {
            const self = teamResult.data[0]
            businesses = [
              {
                id: "(resolved from API key)",
                name: "Business",
                role: self.role,
              },
            ]
          }
        }
        if (businesses.length > 0) {
          const target = activeBusinessId
            ? businesses.find(b => b.id === activeBusinessId)
            : businesses[0]
          if (target) {
            businessLabel = `${chalk.green(`${target.name} (${target.role})`)} — ${target.id}`
          } else if (activeBusinessId) {
            businessLabel = `${chalk.green(activeBusinessId)} ${chalk.yellow("(not found in your businesses)")}`
          }
        }
      } catch {
        if (activeBusinessId) {
          businessLabel = `${chalk.green(activeBusinessId)} ${chalk.dim("(could not fetch business details)")}`
        }
      }

      if (businessLabel) {
        console.log(formatRow("Active business:", businessLabel))
      } else {
        console.log(
          formatRow(
            "Active business:",
            chalk.dim("(none — running in personal/consumer mode)")
          )
        )
      }

      // API base URL — also respect getGlobalOpts so a passed --base-url is honored
      const globals = getGlobalOpts(program)
      const effectiveBaseUrl = globals.baseUrl ?? apiBaseUrl
      console.log(formatRow("API base URL:", chalk.green(effectiveBaseUrl)))

      console.log()
    })
}
