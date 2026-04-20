import { BlazeClient } from "../../sdk/client"
import {
  BlazeAuthenticationError,
  BlazePermissionError,
  BlazeNotFoundError,
  BlazeValidationError,
  BlazeRateLimitError,
} from "../../sdk/errors"

function mockFetch(status: number, body: unknown, statusText = "OK") {
  const fn = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: () => Promise.resolve(body),
  })
  global.fetch = fn
  return fn
}

const client = new BlazeClient({ apiKey: "sk_test_123" })
const customClient = new BlazeClient({
  apiKey: "sk_test_123",
  baseUrl: "https://custom.api.com",
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe("BlazeClient", () => {
  describe("constructor", () => {
    it("uses default baseUrl when none provided", () => {
      const fetchMock = mockFetch(200, { data: {} })
      const defaultClient = new BlazeClient({ apiKey: "sk_test_abc" })
      defaultClient.getBalance()
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.blaze.money/v1/balance",
        expect.anything()
      )
    })

    it("uses custom baseUrl when provided", () => {
      const fetchMock = mockFetch(200, { data: {} })
      customClient.getBalance()
      expect(fetchMock).toHaveBeenCalledWith(
        "https://custom.api.com/v1/balance",
        expect.anything()
      )
    })
  })

  describe("request building", () => {
    it("calls fetch with correct URL (baseUrl + path)", () => {
      const fetchMock = mockFetch(200, { data: { available: "1000" } })
      client.getBalance()
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.blaze.money/v1/balance",
        expect.anything()
      )
    })

    it("sends X-API-Key header with the api key", () => {
      const fetchMock = mockFetch(200, { data: {} })
      client.getBalance()
      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-API-Key": "sk_test_123",
          }),
        })
      )
    })

    it("sends Content-Type: application/json header", () => {
      const fetchMock = mockFetch(200, { data: {} })
      client.getBalance()
      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        })
      )
    })

    it("GET request has no body", () => {
      const fetchMock = mockFetch(200, { data: {} })
      client.getBalance()
      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: "GET",
          body: undefined,
        })
      )
    })

    it("POST request sends JSON body", async () => {
      const fetchMock = mockFetch(200, { data: { id: "cus_1" } })
      const input = { email: "test@example.com", name: "Test User" }
      await client.createCustomer(input)
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.blaze.money/v1/customers",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(input),
        })
      )
    })

    it("PATCH request sends JSON body", async () => {
      const fetchMock = mockFetch(200, { data: { id: "cus_1" } })
      const input = { first_name: "Updated" }
      await client.updateCustomer("cus_1", input)
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.blaze.money/v1/customers/cus_1",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify(input),
        })
      )
    })

    it("DELETE request works", async () => {
      const fetchMock = mockFetch(200, { data: null })
      await client.archiveCustomer("cus_1")
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.blaze.money/v1/customers/cus_1",
        expect.objectContaining({
          method: "DELETE",
        })
      )
    })

    it("custom baseUrl is used in URL", () => {
      const fetchMock = mockFetch(200, { data: {} })
      customClient.getBalance()
      expect(fetchMock).toHaveBeenCalledWith(
        "https://custom.api.com/v1/balance",
        expect.anything()
      )
    })
  })

  describe("response parsing", () => {
    it("unwraps data field from response", async () => {
      mockFetch(200, { data: { id: "123", name: "Test" } })
      const result = await client.getCustomer("123")
      expect(result).toEqual({ id: "123", name: "Test" })
    })

    it("preserves list envelope for list responses", async () => {
      const listResponse = {
        object: "list",
        data: [{ id: "1" }, { id: "2" }],
        has_more: false,
      }
      mockFetch(200, listResponse)
      const result = await client.listCustomers()
      expect(result).toEqual(listResponse)
    })

    it("returns json itself when no data field exists", async () => {
      const response = { total: 5, items: ["a", "b"] }
      mockFetch(200, response)
      const result = await client.getBalance()
      expect(result).toEqual(response)
    })
  })

  describe("error handling", () => {
    it("throws BlazeAuthenticationError on 401", async () => {
      mockFetch(401, { message: "Invalid API key" }, "Unauthorized")
      await expect(client.getBalance()).rejects.toThrow(
        BlazeAuthenticationError
      )
    })

    it("throws BlazePermissionError on 403", async () => {
      mockFetch(403, { message: "Access denied" }, "Forbidden")
      await expect(client.getBalance()).rejects.toThrow(BlazePermissionError)
    })

    it("throws BlazeNotFoundError on 404", async () => {
      mockFetch(404, { message: "Customer not found" }, "Not Found")
      await expect(client.getCustomer("nonexistent")).rejects.toThrow(
        BlazeNotFoundError
      )
    })

    it("throws BlazeValidationError on 400 with errors field", async () => {
      mockFetch(
        400,
        {
          message: "Validation failed",
          errors: { email: ["is required"] },
        },
        "Bad Request"
      )
      await expect(
        client.createCustomer({ email: "" } as never)
      ).rejects.toThrow(BlazeValidationError)
    })

    it("BlazeValidationError includes errors record", async () => {
      mockFetch(400, {
        message: "Validation failed",
        errors: { email: ["is required"], name: ["too short"] },
      })
      try {
        await client.createCustomer({ email: "" } as never)
        fail("Expected error to be thrown")
      } catch (err) {
        expect(err).toBeInstanceOf(BlazeValidationError)
        const validationError = err as BlazeValidationError
        expect(validationError.errors).toEqual({
          email: ["is required"],
          name: ["too short"],
        })
      }
    })

    it("throws BlazeRateLimitError on 429", async () => {
      mockFetch(429, { message: "Too many requests" }, "Too Many Requests")
      await expect(client.getBalance()).rejects.toThrow(BlazeRateLimitError)
    })

    it("throws generic Error with HTTP status on 500", async () => {
      mockFetch(500, { message: "Internal error" }, "Internal Server Error")
      await expect(client.getBalance()).rejects.toThrow(
        "HTTP 500: Internal error"
      )
    })

    it("uses message from response body when available", async () => {
      mockFetch(401, { message: "Token expired" })
      await expect(client.getBalance()).rejects.toThrow("Token expired")
    })

    it("falls back to statusText when body has no message", async () => {
      mockFetch(500, {}, "Internal Server Error")
      await expect(client.getBalance()).rejects.toThrow(
        "HTTP 500: Internal Server Error"
      )
    })
  })

  describe("query building", () => {
    it("no params produces no query string", async () => {
      const fetchMock = mockFetch(200, { data: [] })
      await client.listCustomers()
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.blaze.money/v1/customers",
        expect.anything()
      )
    })

    it("with limit param adds query string", async () => {
      const fetchMock = mockFetch(200, { data: [] })
      await client.listCustomers({ limit: 10 })
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.blaze.money/v1/customers?limit=10",
        expect.anything()
      )
    })

    it("with email filter includes email param", async () => {
      const fetchMock = mockFetch(200, { data: [] })
      await client.listCustomers({ email: "user@test.com" })
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("email=user%40test.com"),
        expect.anything()
      )
    })

    it("null and undefined params are skipped", async () => {
      const fetchMock = mockFetch(200, { data: [] })
      await client.listCustomers({
        limit: undefined,
        email: null as unknown as string,
      })
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.blaze.money/v1/customers",
        expect.anything()
      )
    })
  })

  describe("API methods", () => {
    it("getBalance calls GET /v1/balance", async () => {
      const fetchMock = mockFetch(200, { data: { available: "5000" } })
      await client.getBalance()
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.blaze.money/v1/balance",
        expect.objectContaining({ method: "GET" })
      )
    })

    it("listCustomers with email calls GET /v1/customers?email=x", async () => {
      const fetchMock = mockFetch(200, { data: [] })
      await client.listCustomers({ email: "x" })
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.blaze.money/v1/customers?email=x",
        expect.objectContaining({ method: "GET" })
      )
    })

    it("createCustomer calls POST /v1/customers with body", async () => {
      const fetchMock = mockFetch(200, { data: { id: "cus_new" } })
      const input = { email: "x@y.com", name: "New" }
      await client.createCustomer(input)
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.blaze.money/v1/customers",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(input),
        })
      )
    })

    it("listWebhooks calls GET /v1/webhooks", async () => {
      const fetchMock = mockFetch(200, { data: [] })
      await client.listWebhooks()
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.blaze.money/v1/webhooks",
        expect.objectContaining({ method: "GET" })
      )
    })

    it("getFxRates with base calls GET /v1/fx/rates?base=USD", async () => {
      const fetchMock = mockFetch(200, { data: { rates: {} } })
      await client.getFxRates("USD")
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.blaze.money/v1/fx/rates?base=USD",
        expect.objectContaining({ method: "GET" })
      )
    })

    it("createFxQuote calls POST /v1/fx/quotes with body", async () => {
      const fetchMock = mockFetch(200, { data: { id: "quote_1" } })
      const input = {
        from_currency: "USD",
        to_currency: "MXN",
        amount: 100,
      }
      await client.createFxQuote(input)
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.blaze.money/v1/fx/quotes",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(input),
        })
      )
    })
  })
})
