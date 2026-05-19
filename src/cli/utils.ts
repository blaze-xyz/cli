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
}): Promise<BlazeClient> {
  const config = loadConfig()
  const activeBusinessId = config?.activeBusinessId

  // Explicit API key (flag or env var) always wins
  const explicitApiKey = resolveApiKey(opts.apiKey)
  if (explicitApiKey) {
    return new BlazeClient({
      apiKey: explicitApiKey,
      baseUrl: resolveBaseUrl(opts.baseUrl),
      defaultHeaders: activeBusinessId
        ? { "x-business-id": activeBusinessId }
        : undefined,
    })
  }

  // Active bearer token (from `blaze auth`) takes priority over config-file API key
  const token = await getAuthToken()
  if (token) {
    const baseUrl = opts.baseUrl ?? SPARK_API_URL
    return new BlazeClient({
      bearerToken: token,
      baseUrl,
      defaultHeaders: activeBusinessId
        ? { "x-business-id": activeBusinessId }
        : undefined,
    })
  }

  // Fall back to config-file API key (from `blaze auth login --api-key`)
  const configApiKey = resolveConfigApiKey()
  if (configApiKey) {
    return new BlazeClient({
      apiKey: configApiKey,
      baseUrl: resolveBaseUrl(opts.baseUrl),
      defaultHeaders: activeBusinessId
        ? { "x-business-id": activeBusinessId }
        : undefined,
    })
  }

  console.error(
    "Not authenticated. Run `blaze auth` to log in or provide an API key with --api-key."
  )
  process.exit(1)
}

export function getGlobalOpts(program: {
  opts: () => Record<string, unknown>
}): { apiKey?: string; baseUrl?: string; format: "json" | "table" } {
  const opts = program.opts()
  return {
    apiKey: opts.apiKey as string | undefined,
    baseUrl: opts.baseUrl as string | undefined,
    format: (opts.format as "json" | "table") ?? "table",
  }
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
