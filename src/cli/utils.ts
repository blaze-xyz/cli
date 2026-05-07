import { BlazeClient } from "../sdk/client"
import {
  resolveApiKey,
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

  const apiKey = resolveApiKey(opts.apiKey)
  if (apiKey) {
    return new BlazeClient({
      apiKey,
      baseUrl: resolveBaseUrl(opts.baseUrl),
      defaultHeaders: activeBusinessId
        ? { "x-business-id": activeBusinessId }
        : undefined,
    })
  }

  // Fall back to the JWT stored by `blaze auth`
  const token = await getAuthToken()
  if (!token) {
    console.error(
      "Not authenticated. Run `blaze auth` to log in or provide an API key with --api-key."
    )
    process.exit(1)
  }
  // JWT-authenticated requests go to the Spark consumer API
  const baseUrl = opts.baseUrl ?? SPARK_API_URL
  return new BlazeClient({
    bearerToken: token,
    baseUrl,
    defaultHeaders: activeBusinessId
      ? { "x-business-id": activeBusinessId }
      : undefined,
  })
}

export function getGlobalOpts(program: {
  opts: () => Record<string, unknown>
}): { apiKey?: string; baseUrl?: string; format: "json" | "table" } {
  const opts = program.opts()
  return {
    apiKey: opts.apiKey as string | undefined,
    baseUrl: opts.baseUrl as string | undefined,
    format: (opts.format as "json" | "table") ?? "json",
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
