export class BlazeError extends Error {
  constructor(
    message: string,
    public statusCode?: number
  ) {
    super(message)
    this.name = "BlazeError"
  }
}

export class BlazeAuthenticationError extends BlazeError {
  constructor(message: string = "Authentication failed") {
    super(message, 401)
    this.name = "BlazeAuthenticationError"
  }
}

export class BlazePermissionError extends BlazeError {
  constructor(message: string = "Insufficient permissions") {
    super(message, 403)
    this.name = "BlazePermissionError"
  }
}

export class BlazeNotFoundError extends BlazeError {
  constructor(message: string = "Resource not found") {
    super(message, 404)
    this.name = "BlazeNotFoundError"
  }
}

export class BlazeValidationError extends BlazeError {
  public errors?: Record<string, string[]>

  constructor(
    message: string = "Validation failed",
    errors?: Record<string, string[]>
  ) {
    super(message, 400)
    this.name = "BlazeValidationError"
    this.errors = errors
  }
}

export class BlazeRateLimitError extends BlazeError {
  constructor(message: string = "Rate limit exceeded") {
    super(message, 429)
    this.name = "BlazeRateLimitError"
  }
}

export class BlazeServerError extends BlazeError {
  constructor(message: string = "Server error", statusCode: number = 500) {
    super(message, statusCode)
    this.name = "BlazeServerError"
  }
}

export class BlazeNetworkError extends BlazeError {
  public code?: string

  constructor(message: string = "Network error", code?: string) {
    super(message)
    this.name = "BlazeNetworkError"
    this.code = code
  }
}

export type BlazeErrorKind =
  | "auth"
  | "permission"
  | "not_found"
  | "validation"
  | "rate_limit"
  | "server"
  | "network"
  | "unknown"

export interface TranslatedError {
  kind: BlazeErrorKind
  /** Whether the client did/would retry this class of error. */
  retryable: boolean
  /** One plain-language next step. Never contains raw HTTP codes or scope jargon. */
  hint: string
  /** Safe human-readable message. Never contains "HTTP NNN" or provider scope tokens. */
  message: string
}

/** Removes a leading `HTTP <NNN>:` prefix that some raw error strings carry. */
function stripHttpPrefix(message: string): string {
  return message.replace(/^HTTP\s+\d{3}:\s*/i, "").trim()
}

/**
 * Translates any thrown error into a structured, user-safe shape the agent
 * can surface. The resulting `message`/`hint` never echo raw HTTP status
 * codes or provider scope tokens (e.g. `BILLS_READ`) — those are exactly the
 * strings the agent prompt forbids leaking to the user.
 */
export function translateError(err: unknown): TranslatedError {
  if (err instanceof BlazeAuthenticationError) {
    return {
      kind: "auth",
      retryable: false,
      hint: "Run `blaze auth` to re-authenticate.",
      message: "You need to re-authenticate before running this.",
    }
  }

  if (err instanceof BlazePermissionError) {
    return {
      kind: "permission",
      retryable: false,
      hint: "This API key doesn't have access to that. Use a key with the required scope, or switch to the right command.",
      message: "This API key doesn't have access to that.",
    }
  }

  if (err instanceof BlazeNotFoundError) {
    return {
      kind: "not_found",
      retryable: false,
      hint: "Check the ID and try again.",
      message: "That resource doesn't exist.",
    }
  }

  if (err instanceof BlazeValidationError) {
    const firstFieldError = err.errors
      ? Object.values(err.errors).flat().find(Boolean)
      : undefined
    return {
      kind: "validation",
      retryable: false,
      hint: firstFieldError ?? "Check the request details and try again.",
      message: stripHttpPrefix(err.message),
    }
  }

  if (err instanceof BlazeRateLimitError) {
    return {
      kind: "rate_limit",
      retryable: true,
      hint: "The client already retried; try again shortly.",
      message: "The service is rate limiting requests right now.",
    }
  }

  if (err instanceof BlazeServerError) {
    return {
      kind: "server",
      retryable: true,
      hint: "The client already retried; try again shortly.",
      message: "The service had a temporary problem.",
    }
  }

  if (err instanceof BlazeNetworkError) {
    return {
      kind: "network",
      retryable: true,
      hint: "Check your connection and try again.",
      message: "Couldn't reach the service.",
    }
  }

  const rawMessage = err instanceof Error ? err.message : String(err)
  return {
    kind: "unknown",
    retryable: false,
    hint: "Try again, or rephrase the request.",
    message: stripHttpPrefix(rawMessage),
  }
}
