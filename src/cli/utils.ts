import { BlazeClient } from "../sdk/client"
import {
  resolveApiKey,
  resolveConfigApiKey,
  resolveBaseUrl,
  loadConfig,
  saveConfig,
} from "../sdk/config"
import { getAuthToken } from "./auth-utils"

interface SpinnerOpts {
  format?: string // skip spinner when format is "json"
}

/**
 * Runs an async function while displaying a CLI spinner.
 *
 * The spinner is automatically suppressed in environments where it would be
 * noisy or break tooling: when output format is JSON (pipe-safe), when stdout
 * is not a TTY (piped/redirected), when NO_COLOR is set (accessibility), and
 * when running in CI. In those cases this just awaits and returns the function
 * result as-is.
 *
 * If the call takes longer than 2s the spinner text gets a `(still working…)`
 * suffix so the user can see we're still doing work.
 *
 * The spinner is silently stopped on success (no checkmark/text noise — the
 * command's own output handles that). On error it calls `spinner.fail()` and
 * re-throws so the caller's existing error handling still runs.
 */
export async function withSpinner<T>(
  text: string,
  fn: () => Promise<T>,
  opts?: SpinnerOpts
): Promise<T> {
  const shouldSkip =
    opts?.format === "json" || // clean JSON for pipes
    !process.stdout.isTTY || // piped or non-interactive
    !!process.env.NO_COLOR || // user opt-out (accessibility)
    !!process.env.CI // CI environments

  if (shouldSkip) {
    return fn()
  }

  const ora = (await import("ora")).default
  const spinner = ora({ text, color: "cyan" }).start()

  // Latency-aware text bump so the user sees signs of life on longer calls.
  // Stays positive/direct per the user-facing copy rules in CLAUDE.md
  // (no apologies, no "slow API" framing).
  const startedAt = Date.now()
  const slowAt = 2000
  const originalText = text
  const bumpInterval = setInterval(() => {
    const elapsed = Date.now() - startedAt
    if (elapsed > slowAt) {
      spinner.text = `${originalText} (still working…)`
    }
  }, 500)

  try {
    const result = await fn()
    clearInterval(bumpInterval)
    spinner.stop()
    return result
  } catch (err) {
    clearInterval(bumpInterval)
    spinner.fail()
    throw err
  }
}

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
    return new BlazeClient({
      bearerToken: token,
      baseUrl: resolveBaseUrl(opts.baseUrl),
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

export function handleError(err: unknown, format?: string): never {
  const message =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : JSON.stringify(err)
  if (format === "json") {
    console.error(JSON.stringify({ error: message }))
  } else {
    console.error(`Error: ${message}`)
  }
  process.exit(1)
}

/**
 * Prints a single error and exits. In JSON mode it emits a `{ error }` object so
 * piped/`--format json` callers get machine-readable output instead of prose.
 * Use for guard exits in commands that already resolved `globals.format`.
 */
export function fail(message: string, format?: string): never {
  if (format === "json") {
    console.error(JSON.stringify({ error: message }))
  } else {
    console.error(message)
  }
  process.exit(1)
}

export { loadConfig as getConfig, saveConfig as writeConfig }
