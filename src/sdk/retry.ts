/**
 * Pure, unit-testable retry helpers for the SDK client.
 *
 * Retries are deliberately conservative: only GET requests are retried (the
 * client gates on `method === "GET"`), and only for transient failures —
 * HTTP 429 / 5xx, or network-layer errors. Money-moving POSTs are never
 * retried.
 */

/** Maximum number of retries (total attempts = MAX_RETRIES + 1). */
export const MAX_RETRIES = 2

/** Base backoff in milliseconds (exponential growth starts here). */
export const RETRY_BASE_MS = 200

/** Upper bound on any single backoff delay, in milliseconds. */
export const RETRY_MAX_MS = 2000

/** Network-layer error codes that are safe to retry on a GET. */
const RETRYABLE_NETWORK_CODES = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "ECONNREFUSED",
  "EAI_AGAIN",
  "ENOTFOUND",
])

/**
 * Computes the backoff delay (ms) for a given attempt using exponential
 * growth with full jitter, capped at RETRY_MAX_MS.
 *
 * If a numeric `retryAfter` (seconds, from a `Retry-After` header) is
 * provided, it takes precedence and is capped to RETRY_MAX_MS.
 *
 * @param attempt zero-based attempt index (0 = first retry)
 * @param retryAfter optional Retry-After value in seconds
 */
export function backoff(attempt: number, retryAfter?: number): number {
  if (typeof retryAfter === "number" && Number.isFinite(retryAfter)) {
    return Math.min(RETRY_MAX_MS, Math.max(0, retryAfter * 1000))
  }
  const exponential = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** attempt)
  // Full jitter: random point in [0, exponential].
  return Math.floor(Math.random() * exponential)
}

/** True for HTTP statuses that are safe to retry (429 + 5xx). */
export function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599)
}

/**
 * True when a thrown (non-HTTP) error represents a transient network failure
 * that is safe to retry on a GET.
 */
export function isNetworkRetryable(err: unknown): boolean {
  if (typeof err === "object" && err !== null) {
    const code = (err as { code?: unknown }).code
    if (typeof code === "string" && RETRYABLE_NETWORK_CODES.has(code)) {
      return true
    }
    const name = (err as { name?: unknown }).name
    if (name === "AbortError") {
      return true
    }
  }
  // `fetch` surfaces connection failures as a plain TypeError.
  if (err instanceof TypeError) {
    return true
  }
  return false
}

/** Promise-based delay; kept separate so tests can stub it. */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
