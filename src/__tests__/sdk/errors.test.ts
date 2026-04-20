import {
  BlazeError,
  BlazeAuthenticationError,
  BlazePermissionError,
  BlazeNotFoundError,
  BlazeValidationError,
  BlazeRateLimitError,
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
