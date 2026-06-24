import { Command } from "commander"

import { resolveBaseUrl, resolveConfigApiKey } from "../../sdk/config"
import { resolveAccountContext } from "../auth-context"
import { getAuth } from "../auth-utils"
import { getClient, getGlobalOpts } from "../utils"

const LABEL_WIDTH = 20

function formatRow(label: string, value: string): string {
  return `${label.padEnd(LABEL_WIDTH)}${value}`
}

/**
 * Whether `whoami` should resolve and display a business as the active context,
 * mirroring what commands actually do:
 *   - forced personal (`--personal` / `BLAZE_PERSONAL`) → never a business
 *   - a bearer token with NO business selected → defaults to personal (SDK
 *     default), so we must not over-claim its first business
 *   - an API key is always business-scoped → show its business
 *   - an explicitly selected business → show it
 */
export function shouldShowBusinessContext(input: {
  personal: boolean
  isApiKey: boolean
  hasSelectedBusiness: boolean
}): boolean {
  if (input.personal) return false
  return input.isApiKey || input.hasSelectedBusiness
}

export function registerWhoamiCommands(program: Command): void {
  program
    .command("whoami")
    .description("Show current authentication and active business context")
    .action(async () => {
      const chalk = (await import("chalk")).default

      const globals = getGlobalOpts(program)
      const auth = await getAuth()
      const isStoredBearerActive =
        !!auth &&
        !!auth.created_at &&
        !!auth.expires_in &&
        Date.now() < auth.created_at + auth.expires_in * 1000
      const configApiKey = resolveConfigApiKey()
      const apiBaseUrl = resolveBaseUrl()
      // Effective context (personal vs business) — matches what getClient sends,
      // honoring --personal / --business / BLAZE_PERSONAL / BLAZE_BUSINESS_ID.
      const accountCtx = resolveAccountContext(globals)
      const activeBusinessId = accountCtx.businessId

      // Where the active credential comes from, matching getClient's precedence:
      // flag > env > stored session > config.
      type AuthSource =
        | { kind: "bearer"; label: string; stored: boolean }
        | { kind: "apiKey"; label: string }
      let source: AuthSource | null = null
      if (globals.token) {
        source = { kind: "bearer", label: "from --token", stored: false }
      } else if (globals.apiKey) {
        source = { kind: "apiKey", label: "from --api-key" }
      } else if (process.env.BLAZE_TOKEN) {
        source = { kind: "bearer", label: "from BLAZE_TOKEN", stored: false }
      } else if (process.env.BLAZE_API_KEY) {
        source = { kind: "apiKey", label: "from BLAZE_API_KEY" }
      } else if (isStoredBearerActive) {
        source = { kind: "bearer", label: "stored session", stored: true }
      } else if (configApiKey) {
        source = { kind: "apiKey", label: "from config file" }
      }

      // Not authenticated case — friendly exit (no process.exit(1))
      if (!source) {
        console.log()
        console.log(chalk.yellow("Not authenticated."))
        console.log(
          chalk.dim(
            "Run blaze auth to log in, or set BLAZE_TOKEN / BLAZE_API_KEY."
          )
        )
        console.log()
        return
      }

      console.log()

      // User
      if (source.kind === "bearer" && source.stored && auth) {
        const userLabel = auth.user.email || auth.user.blazetag || "(unknown)"
        console.log(
          formatRow("User:", `${chalk.green(userLabel)} (${auth.user.id})`)
        )
      } else if (source.kind === "bearer") {
        console.log(formatRow("User:", chalk.dim("(personal token)")))
      } else {
        console.log(formatRow("User:", chalk.dim("(none — API key auth)")))
      }

      // Auth source
      if (source.kind === "bearer" && source.stored && auth) {
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
      } else if (source.kind === "bearer") {
        console.log(
          formatRow(
            "Auth source:",
            `${chalk.green("Bearer token")} ${chalk.dim(`(${source.label})`)}`
          )
        )
      } else {
        console.log(
          formatRow(
            "Auth source:",
            `${chalk.green("API key")} ${chalk.dim(`(${source.label})`)}`
          )
        )
      }

      // Active business — resolve from API only when a business is the effective
      // context (see shouldShowBusinessContext). A bearer token with nothing
      // selected defaults to personal, so we must not claim its first business.
      // /v1/me/businesses first; on API-key rejection, fall back to /v1/team-members.
      const showBusiness = shouldShowBusinessContext({
        personal: accountCtx.personal,
        isApiKey: source.kind === "apiKey",
        hasSelectedBusiness: !!activeBusinessId,
      })
      let businessLabel: string | null = null
      if (showBusiness) {
        try {
          const client = await getClient(globals)
          let businesses: Array<{ id: string; name: string; role: string }> = []
          try {
            const result = await client.get<{
              object: string
              data: Array<{ id: string; name: string; role: string }>
            }>("/v1/me/businesses")
            businesses = result.data
          } catch {
            // /v1/me/businesses may reject API key auth — try team-members.
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

      // API base URL — respect a passed --base-url (from globals) over config.
      const effectiveBaseUrl = globals.baseUrl ?? apiBaseUrl
      console.log(formatRow("API base URL:", chalk.green(effectiveBaseUrl)))

      console.log()
    })
}
