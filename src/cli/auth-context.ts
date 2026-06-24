/**
 * Shared credential + account-context resolution for the CLI, MCP server, and
 * agent. Centralizing this guarantees all three honor the same precedence and
 * the same personal/business context switching, including the headless env vars
 * (`BLAZE_TOKEN`, `BLAZE_API_KEY`, `BLAZE_BUSINESS_ID`, `BLAZE_PERSONAL`).
 *
 * Two credential SHAPES exist:
 *   - bearer JWT (a consumer/personal session from `blaze auth`): grants personal
 *     access AND business access for any business the user is a member of, via
 *     the `x-business-id` / `x-blaze-personal` context header.
 *   - business API key (`sk_…`): scoped to a single business; context headers do
 *     not apply.
 */
import { loadConfig, resolveConfigApiKey } from "../sdk/config"
import { getAuthToken } from "./auth-utils"

export type ResolvedCredential =
  | { kind: "bearer"; token: string }
  | { kind: "apiKey"; apiKey: string }

/**
 * Trims a value and treats whitespace-only as absent. Critical for env-injected
 * secrets: `BLAZE_TOKEN=$(blaze auth token)` or a manual paste can carry a
 * trailing newline/space, which would corrupt the `Authorization` header (and a
 * newline in a header value is an injection vector).
 */
function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

/** True for env values that mean "on": `true` or `1` (case-insensitive). */
function isEnvTrue(value: string | undefined): boolean {
  const v = value?.trim().toLowerCase()
  return v === "true" || v === "1"
}

export interface CredentialOpts {
  /** Explicit `--token` flag — a consumer JWT. */
  token?: string
  /** Explicit `--api-key` flag — a business API key. */
  apiKey?: string
}

/**
 * Resolves which credential to use, in priority order:
 *   1. `--token` flag        (consumer JWT)
 *   2. `--api-key` flag      (business key)
 *   3. `BLAZE_TOKEN` env     (consumer JWT)
 *   4. `BLAZE_API_KEY` env   (business key)
 *   5. stored bearer session (from `blaze auth`)
 *   6. config-file api key   (from `blaze auth login --api-key`)
 *
 * Explicit flags always beat env vars. Returns null when nothing is configured.
 * Throws if both `--token` and `--api-key` are passed explicitly.
 */
export async function resolveCredential(
  opts: CredentialOpts = {}
): Promise<ResolvedCredential | null> {
  const flagToken = clean(opts.token)
  const flagApiKey = clean(opts.apiKey)

  if (flagToken && flagApiKey) {
    throw new Error("Provide either --token or --api-key, not both.")
  }

  if (flagToken) return { kind: "bearer", token: flagToken }
  if (flagApiKey) return { kind: "apiKey", apiKey: flagApiKey }

  const envToken = clean(process.env.BLAZE_TOKEN)
  if (envToken) return { kind: "bearer", token: envToken }

  const envApiKey = clean(process.env.BLAZE_API_KEY)
  if (envApiKey) return { kind: "apiKey", apiKey: envApiKey }

  const sessionToken = await getAuthToken()
  if (sessionToken) return { kind: "bearer", token: sessionToken }

  const configApiKey = resolveConfigApiKey()
  if (configApiKey) return { kind: "apiKey", apiKey: configApiKey }

  return null
}

export interface ContextOpts {
  /** `--business <id>` flag. */
  business?: string
  /** `--personal` flag. */
  personal?: boolean
}

export interface AccountContext {
  /** True when the request should be forced into personal/consumer context. */
  personal: boolean
  /** The business id to act as (when not personal), if any. */
  businessId?: string
}

/**
 * Resolves the effective account context (personal vs a specific business) for a
 * bearer credential. Precedence: personal (`--personal` flag or `BLAZE_PERSONAL`)
 * wins; then a business override (`--business` flag or `BLAZE_BUSINESS_ID` env);
 * then the persisted `activeBusinessId`. This is the single source of truth used
 * both to build request headers and to report context in `blaze whoami`.
 */
export function resolveAccountContext(opts: ContextOpts = {}): AccountContext {
  if (opts.personal || isEnvTrue(process.env.BLAZE_PERSONAL)) {
    return { personal: true }
  }
  const businessId =
    clean(opts.business) ||
    clean(process.env.BLAZE_BUSINESS_ID) ||
    clean(loadConfig()?.activeBusinessId)
  return { personal: false, businessId }
}

/**
 * Resolves the account-context headers for a bearer (JWT) credential. Returns
 * undefined when no context applies (the SDK then defaults a bearer client to
 * personal).
 */
export function resolveContextHeaders(
  opts: ContextOpts = {}
): Record<string, string> | undefined {
  const ctx = resolveAccountContext(opts)
  if (ctx.personal) return { "x-blaze-personal": "true" }
  if (ctx.businessId) return { "x-business-id": ctx.businessId }
  return undefined
}
