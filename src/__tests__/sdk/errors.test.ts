import {
  BlazeError,
  BlazeAuthenticationError,
  BlazePermissionError,
  BlazeNotFoundError,
  BlazeValidationError,
  BlazeRateLimitError,
  BlazeServerError,
  BlazeNetworkError,
  translateError,
} from "../../sdk/errors"

describe("BlazeError", () => {
  it('sets name to "BlazeError"', () => {
    const error = new BlazeError("something went wrong")
    expect(error.name).toBe("BlazeError")
  })

  it("is instanceof Error", () => {
    const error = new BlazeError("test")
    expect(error).toBeInstanceOf(Error)
  })
})

describe("BlazeAuthenticationError", () => {
  it("has statusCode 401 and default message", () => {
    const error = new BlazeAuthenticationError()
    expect(error.statusCode).toBe(401)
    expect(error.message).toBe("Authentication failed")
  })

  it("is instanceof BlazeError", () => {
    const error = new BlazeAuthenticationError()
    expect(error).toBeInstanceOf(BlazeError)
  })

  it("is instanceof Error", () => {
    const error = new BlazeAuthenticationError()
    expect(error).toBeInstanceOf(Error)
  })

  it("allows custom messages to override defaults", () => {
    const error = new BlazeAuthenticationError("Custom msg")
    expect(error.message).toBe("Custom msg")
    expect(error.statusCode).toBe(401)
  })
})

describe("BlazePermissionError", () => {
  it("has statusCode 403 and default message", () => {
    const error = new BlazePermissionError()
    expect(error.statusCode).toBe(403)
    expect(error.message).toBe("Insufficient permissions")
  })

  it("is instanceof BlazeError", () => {
    const error = new BlazePermissionError()
    expect(error).toBeInstanceOf(BlazeError)
  })

  it("is instanceof Error", () => {
    const error = new BlazePermissionError()
    expect(error).toBeInstanceOf(Error)
  })
})

describe("BlazeNotFoundError", () => {
  it("has statusCode 404 and default message", () => {
    const error = new BlazeNotFoundError()
    expect(error.statusCode).toBe(404)
    expect(error.message).toBe("Resource not found")
  })

  it("is instanceof BlazeError", () => {
    const error = new BlazeNotFoundError()
    expect(error).toBeInstanceOf(BlazeError)
  })

  it("is instanceof Error", () => {
    const error = new BlazeNotFoundError()
    expect(error).toBeInstanceOf(Error)
  })
})

describe("BlazeValidationError", () => {
  it("has statusCode 400 and default message", () => {
    const error = new BlazeValidationError()
    expect(error.statusCode).toBe(400)
    expect(error.message).toBe("Validation failed")
  })

  it("stores errors field", () => {
    const errors = { email: ["invalid", "required"], name: ["too short"] }
    const error = new BlazeValidationError("Validation failed", errors)
    expect(error.errors).toEqual(errors)
  })

  it("is instanceof BlazeError", () => {
    const error = new BlazeValidationError()
    expect(error).toBeInstanceOf(BlazeError)
  })

  it("is instanceof Error", () => {
    const error = new BlazeValidationError()
    expect(error).toBeInstanceOf(Error)
  })
})

describe("BlazeRateLimitError", () => {
  it("has statusCode 429 and default message", () => {
    const error = new BlazeRateLimitError()
    expect(error.statusCode).toBe(429)
    expect(error.message).toBe("Rate limit exceeded")
  })

  it("is instanceof BlazeError", () => {
    const error = new BlazeRateLimitError()
    expect(error).toBeInstanceOf(BlazeError)
  })

  it("is instanceof Error", () => {
    const error = new BlazeRateLimitError()
    expect(error).toBeInstanceOf(Error)
  })
})

describe("BlazeServerError", () => {
  it("has a default statusCode of 500", () => {
    const error = new BlazeServerError()
    expect(error.statusCode).toBe(500)
  })

  it("preserves a provided statusCode", () => {
    const error = new BlazeServerError("HTTP 503: Down", 503)
    expect(error.statusCode).toBe(503)
    expect(error.message).toBe("HTTP 503: Down")
  })

  it("is instanceof BlazeError", () => {
    const error = new BlazeServerError()
    expect(error).toBeInstanceOf(BlazeError)
  })
})

describe("BlazeNetworkError", () => {
  it("stores an optional network code", () => {
    const error = new BlazeNetworkError("socket hang up", "ECONNRESET")
    expect(error.code).toBe("ECONNRESET")
    expect(error.message).toBe("socket hang up")
  })

  it("has no statusCode", () => {
    const error = new BlazeNetworkError()
    expect(error.statusCode).toBeUndefined()
  })

  it("is instanceof BlazeError", () => {
    const error = new BlazeNetworkError()
    expect(error).toBeInstanceOf(BlazeError)
  })
})

describe("translateError", () => {
  it("maps each error subclass to the expected kind and retryability", () => {
    const cases: Array<{
      error: unknown
      kind: string
      retryable: boolean
    }> = [
      { error: new BlazeAuthenticationError(), kind: "auth", retryable: false },
      {
        error: new BlazePermissionError(),
        kind: "permission",
        retryable: false,
      },
      { error: new BlazeNotFoundError(), kind: "not_found", retryable: false },
      {
        error: new BlazeValidationError(),
        kind: "validation",
        retryable: false,
      },
      {
        error: new BlazeRateLimitError(),
        kind: "rate_limit",
        retryable: true,
      },
      { error: new BlazeServerError(), kind: "server", retryable: true },
      { error: new BlazeNetworkError(), kind: "network", retryable: true },
      { error: new Error("something odd"), kind: "unknown", retryable: false },
    ]

    for (const { error, kind, retryable } of cases) {
      const translated = translateError(error)
      expect(translated.kind).toBe(kind)
      expect(translated.retryable).toBe(retryable)
    }
  })

  it("never leaks an HTTP status code in message or hint", () => {
    const errors: unknown[] = [
      new BlazeAuthenticationError("Authentication failed"),
      new BlazePermissionError("Forbidden"),
      new BlazeNotFoundError(),
      new BlazeValidationError("Validation failed", {
        email: ["is required"],
      }),
      new BlazeRateLimitError(),
      new BlazeServerError("HTTP 500: Internal error", 500),
      new BlazeNetworkError("socket hang up", "ECONNRESET"),
      new Error("HTTP 502: Bad Gateway"),
    ]

    for (const error of errors) {
      const translated = translateError(error)
      expect(translated.message).not.toMatch(/HTTP/i)
      expect(translated.hint).not.toMatch(/HTTP/i)
    }
  })

  it("strips a leading HTTP NNN prefix from an unknown error message", () => {
    const translated = translateError(new Error("HTTP 502: Bad Gateway"))
    expect(translated.kind).toBe("unknown")
    expect(translated.message).toBe("Bad Gateway")
  })

  it("never leaks raw scope jargon for permission errors", () => {
    const translated = translateError(
      new BlazePermissionError("Missing scope: BILLS_READ, BILLS_WRITE")
    )
    expect(translated.message).not.toMatch(/BILLS_/)
    expect(translated.hint).not.toMatch(/BILLS_/)
  })

  it("does not echo the raw 'Authentication failed' string for auth errors", () => {
    const translated = translateError(
      new BlazeAuthenticationError("Authentication failed")
    )
    expect(translated.message).not.toMatch(/Authentication failed/)
    expect(translated.hint).not.toMatch(/Authentication failed/)
    expect(translated.hint).toContain("blaze auth")
  })

  it("surfaces the first field error as the hint for validation errors", () => {
    const translated = translateError(
      new BlazeValidationError("Validation failed", {
        amount: ["must be positive"],
      })
    )
    expect(translated.kind).toBe("validation")
    expect(translated.hint).toBe("must be positive")
  })
})
