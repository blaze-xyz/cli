import { BlazeClient } from "../sdk/client"
import { resolveApiKey, resolveBaseUrl } from "../sdk/config"

export function getClient(opts: {
  apiKey?: string
  baseUrl?: string
}): BlazeClient {
  const apiKey = resolveApiKey(opts.apiKey)
  if (!apiKey) {
    console.error(
      "No API key configured. Run: blaze auth login --api-key <key>"
    )
    process.exit(1)
  }
  return new BlazeClient({ apiKey, baseUrl: resolveBaseUrl(opts.baseUrl) })
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
  } else {
    console.error("An unexpected error occurred")
  }
  process.exit(1)
}
