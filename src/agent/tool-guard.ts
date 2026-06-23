import { translateError } from "../sdk/errors"

/**
 * Per-run guard that enforces the "never re-call a tool after a final
 * (non-retryable) error" rule.
 *
 * Once a tool throws a non-retryable error (permission, auth, forbidden,
 * validation, not-found), any further call to that same tool in the same run is
 * short-circuited: the model receives a clear "already attempted, not retried"
 * result instead of the tool executing again — which would waste a call and risk
 * leaking a second raw error / jargon. Retryable errors (rate-limit, transient
 * server) do NOT block, so legitimate retries still work.
 *
 * Shared by the production agent loop (runAgent) and the eval replay loop so
 * both behave identically.
 */
export class ToolCallGuard {
  private readonly blocked = new Map<
    string,
    { kind?: string; hint?: string; error: string }
  >()

  /**
   * If `name` already failed non-retryably this run, returns the short-circuit
   * result to feed back to the model instead of executing again; otherwise null.
   */
  shortCircuit(name: string): Record<string, unknown> | null {
    const prior = this.blocked.get(name)
    if (!prior) return null
    return {
      kind: prior.kind,
      retryable: false,
      hint: prior.hint,
      error: prior.error,
      not_retried: true,
      note: `${name} already failed earlier this turn and was not called again. Report that error to the user and do not retry it.`,
    }
  }

  /** Record a thrown tool error; blocks the tool when the error is non-retryable. */
  recordError(name: string, err: unknown): void {
    const t = translateError(err)
    if (t.retryable === false) {
      this.blocked.set(name, { kind: t.kind, hint: t.hint, error: t.message })
    }
  }
}
