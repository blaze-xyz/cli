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
