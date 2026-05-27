import { BlazeClient } from "../sdk/client"
import {
  resolveApiKey,
  resolveConfigApiKey,
  resolveBaseUrl,
  loadConfig,
  saveConfig,
} from "../sdk/config"
import { getAuthToken } from "./auth-utils"

const SPARK_API_URL = process.env.BLAZE_API_URL ?? "https://api.blaze.money"

export async function getClient(opts: {
  apiKey?: string
  baseUrl?: string
  business?: string
  personal?: boolean
}): Promise<BlazeClient> {
  const config = loadConfig()
  let activeBusinessId = config?.activeBusinessId

  // CLI flag overrides
  if (opts.personal) {
    activeBusinessId = undefined
  } else if (opts.business) {
    activeBusinessId = opts.business
  }

  // Build context headers
  const contextHeaders: Record<string, string> = {}
  if (opts.personal) {
    contextHeaders["x-blaze-personal"] = "true"
  } else if (activeBusinessId) {
    contextHeaders["x-business-id"] = activeBusinessId
  }

  // Explicit API key (flag or env var) always wins
  const explicitApiKey = resolveApiKey(opts.apiKey)
  if (explicitApiKey) {
    return new BlazeClient({
      apiKey: explicitApiKey,
      baseUrl: resolveBaseUrl(opts.baseUrl),
      defaultHeaders:
        Object.keys(contextHeaders).length > 0 ? contextHeaders : undefined,
    })
  }

  // Active bearer token (from `blaze auth`) takes priority over config-file API key
  const token = await getAuthToken()
  if (token) {
    const baseUrl = opts.baseUrl ?? SPARK_API_URL
    return new BlazeClient({
      bearerToken: token,
      baseUrl,
      defaultHeaders:
        Object.keys(contextHeaders).length > 0 ? contextHeaders : undefined,
    })
  }

  // Fall back to config-file API key (from `blaze auth login --api-key`)
  const configApiKey = resolveConfigApiKey()
  if (configApiKey) {
    return new BlazeClient({
      apiKey: configApiKey,
      baseUrl: resolveBaseUrl(opts.baseUrl),
      defaultHeaders:
        Object.keys(contextHeaders).length > 0 ? contextHeaders : undefined,
    })
  }

  console.error(
    "Not authenticated. Run `blaze auth` to log in or provide an API key with --api-key."
  )
  process.exit(1)
}

export function getGlobalOpts(program: {
  opts: () => Record<string, unknown>
}): {
  apiKey?: string
  baseUrl?: string
  format: "json" | "table"
  business?: string
  personal?: boolean
} {
  const opts = program.opts()
  return {
    apiKey: opts.apiKey as string | undefined,
    baseUrl: opts.baseUrl as string | undefined,
    format: (opts.format as "json" | "table") ?? "table",
    business: opts.business as string | undefined,
    personal: opts.personal as boolean | undefined,
  }
}

export async function requireBusinessContext(opts: {
  apiKey?: string
  baseUrl?: string
  business?: string
  personal?: boolean
}): Promise<string> {
  // If --business flag was passed, use that
  if (opts.business) return opts.business

  // Check config
  const config = loadConfig()
  if (config?.activeBusinessId) return config.activeBusinessId

  // Try to auto-select if user has exactly one business
  try {
    const client = await getClient(opts)
    const result = await client.get<{
      object: string
      data: Array<{ id: string; name: string; role: string }>
    }>("/v1/me/businesses")
    const businesses = result.data

    if (businesses.length === 1) {
      const only = businesses[0]!
      const cfg = loadConfig() ?? { api_key: "" }
      cfg.activeBusinessId = only.id
      saveConfig(cfg)
      console.log(`  Auto-selected business: ${only.name} (${only.role})\n`)
      return only.id
    }

    if (businesses.length > 1) {
      console.error(
        `No business selected. You belong to ${businesses.length} businesses:\n`
      )
      for (const b of businesses) {
        console.error(
          `  ${b.name} (${b.role})  →  blaze businesses use ${b.id}`
        )
      }
      console.error(`\nRun 'blaze businesses use <id>' to select one.`)
      process.exit(1)
    }
  } catch {
    // Can't fetch businesses — show generic message
  }

  console.error(
    "No business selected. Run 'blaze businesses list' to see your businesses,"
  )
  console.error("then 'blaze businesses use <id>' to select one.")
  process.exit(1)
}

export function handleError(err: unknown): never {
  if (err instanceof Error) {
    console.error(`Error: ${err.message}`)
  } else if (typeof err === "string") {
    console.error(`Error: ${err}`)
  } else {
    console.error(`Error: ${JSON.stringify(err)}`)
  }
  process.exit(1)
}

export { loadConfig as getConfig, saveConfig as writeConfig }
