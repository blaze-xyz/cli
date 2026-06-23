import { BlazeClient } from "../../sdk/client"
import {
  BlazeAuthenticationError,
  BlazePermissionError,
  BlazeNotFoundError,
  BlazeValidationError,
  BlazeRateLimitError,
  BlazeServerError,
  BlazeNetworkError,
} from "../../sdk/errors"
import * as retry from "../../sdk/retry"

function mockResponse(status: number, body: unknown, statusText = "OK") {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    headers: { get: () => null },
    json: () => Promise.resolve(body),
  }
}

function mockFetch(status: number, body: unknown, statusText = "OK") {
  const fn = jest.fn().mockResolvedValue(mockResponse(status, body, statusText))
  global.fetch = fn
  return fn
}

const client = new BlazeClient({ apiKey: "sk_test_123" })
const customClient = new BlazeClient({
  apiKey: "sk_test_123",
  baseUrl: "https://custom.api.com",
})

// defaultHeaders is private on BlazeClient; read it via a narrow cast so tests
// can assert exactly which context headers the client attaches.
function readDefaultHeaders(c: unknown): Record<string, string> {
  return (c as { defaultHeaders: Record<string, string> }).defaultHeaders
}

beforeEach(() => {
  // Stub the backoff sleep so retry tests run instantly.
  jest.spyOn(retry, "sleep").mockResolvedValue(undefined)
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

    it("defaults x-blaze-personal for a bearer client with no context headers", () => {
      const bearerClient = new BlazeClient({ bearerToken: "bearer_abc" })

      const headers = readDefaultHeaders(bearerClient)
      expect(headers["x-blaze-personal"]).toBe("true")
      expect(headers["x-business-id"]).toBeUndefined()
    })

    it("does not add x-blaze-personal when x-business-id is provided on a bearer client", () => {
      const bearerClient = new BlazeClient({
        bearerToken: "bearer_abc",
        defaultHeaders: { "x-business-id": "biz_123" },
      })

      const headers = readDefaultHeaders(bearerClient)
      expect(headers["x-business-id"]).toBe("biz_123")
      expect(headers["x-blaze-personal"]).toBeUndefined()
    })

    it("leaves an explicitly provided x-blaze-personal header untouched on a bearer client", () => {
      const bearerClient = new BlazeClient({
        bearerToken: "bearer_abc",
        defaultHeaders: { "x-blaze-personal": "true" },
      })

      const headers = readDefaultHeaders(bearerClient)
      expect(headers["x-blaze-personal"]).toBe("true")
      expect(headers["x-business-id"]).toBeUndefined()
    })

    it("does not add x-blaze-personal for an API-key client with no headers", () => {
      const apiKeyClient = new BlazeClient({ apiKey: "sk_test_abc" })

      const headers = readDefaultHeaders(apiKeyClient)
      expect(headers["x-blaze-personal"]).toBeUndefined()
      expect(headers["x-business-id"]).toBeUndefined()
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

    it("throws BlazeServerError with HTTP status on 500", async () => {
      mockFetch(500, { message: "Internal error" }, "Internal Server Error")
      await expect(client.getBalance()).rejects.toThrow(BlazeServerError)
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

  describe("insights methods", () => {
    it("getInsightsSummary calls GET /v1/insights/summary with no query when no params", async () => {
      const fetchMock = mockFetch(200, { data: { object: "spending_summary" } })
      await client.getInsightsSummary()
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.blaze.money/v1/insights/summary",
        expect.objectContaining({ method: "GET" })
      )
    })

    it("getInsightsSummary appends start_date and end_date query when params passed", async () => {
      const fetchMock = mockFetch(200, { data: { object: "spending_summary" } })
      await client.getInsightsSummary({
        start_date: "2025-01-01",
        end_date: "2025-01-31",
      })
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.blaze.money/v1/insights/summary?start_date=2025-01-01&end_date=2025-01-31",
        expect.objectContaining({ method: "GET" })
      )
    })

    it("listBankTransactions calls GET /v1/insights/transactions and returns the list wrapper", async () => {
      const listResponse = {
        object: "list",
        data: [{ id: "btx_1", object: "bank_transaction" }],
        has_more: false,
        next_cursor: null,
        total_count: 1,
      }
      const fetchMock = mockFetch(200, listResponse)
      const result = await client.listBankTransactions()
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.blaze.money/v1/insights/transactions",
        expect.objectContaining({ method: "GET" })
      )
      expect(result).toEqual(listResponse)
      expect(result.object).toBe("list")
      expect(Array.isArray(result.data)).toBe(true)
      expect(result.has_more).toBe(false)
    })

    it("listBankTransactions appends date, account, and limit query when params passed", async () => {
      const fetchMock = mockFetch(200, {
        object: "list",
        data: [],
        has_more: false,
        next_cursor: null,
        total_count: 0,
      })
      await client.listBankTransactions({
        start_date: "2025-02-01",
        end_date: "2025-02-28",
        plaid_account_data_id: "pad_123",
        limit: 25,
      })
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.blaze.money/v1/insights/transactions?start_date=2025-02-01&end_date=2025-02-28&plaid_account_data_id=pad_123&limit=25",
        expect.objectContaining({ method: "GET" })
      )
    })

    it("getBankBalances calls GET /v1/insights/balances", async () => {
      const fetchMock = mockFetch(200, { data: { object: "bank_balances" } })
      await client.getBankBalances()
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.blaze.money/v1/insights/balances",
        expect.objectContaining({ method: "GET" })
      )
    })
  })

  describe("retry", () => {
    it("retries a GET on a transient 503 then succeeds", async () => {
      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce(
          mockResponse(503, { message: "Unavailable" }, "Service Unavailable")
        )
        .mockResolvedValueOnce(
          mockResponse(200, { data: { available: "100" } })
        )
      global.fetch = fetchMock

      const result = await client.getBalance()

      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(result).toEqual({ available: "100" })
    })

    it("retries a GET on a network error then succeeds", async () => {
      const networkError = Object.assign(new Error("socket hang up"), {
        code: "ECONNRESET",
      })
      const fetchMock = jest
        .fn()
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce(mockResponse(200, { data: { available: "50" } }))
      global.fetch = fetchMock

      const result = await client.getBalance()

      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(result).toEqual({ available: "50" })
    })

    it("does not retry a GET on 404 and throws BlazeNotFoundError", async () => {
      const fetchMock = mockFetch(404, { message: "Missing" }, "Not Found")
      await expect(client.getCustomer("nope")).rejects.toThrow(
        BlazeNotFoundError
      )
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it("does not retry a GET on 401 and throws BlazeAuthenticationError", async () => {
      const fetchMock = mockFetch(401, { message: "No" }, "Unauthorized")
      await expect(client.getBalance()).rejects.toThrow(
        BlazeAuthenticationError
      )
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it("does not retry a GET on 403 and throws BlazePermissionError", async () => {
      const fetchMock = mockFetch(403, { message: "Denied" }, "Forbidden")
      await expect(client.getBalance()).rejects.toThrow(BlazePermissionError)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it("does not retry a GET on 400 and throws BlazeValidationError", async () => {
      const fetchMock = mockFetch(400, { message: "Bad" }, "Bad Request")
      await expect(client.getTransfer("t_1")).rejects.toThrow(
        BlazeValidationError
      )
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it("does not retry POST createTransfer on 503 (money-moving safety)", async () => {
      const fetchMock = mockFetch(
        503,
        { message: "Down" },
        "Service Unavailable"
      )
      await expect(
        client.createTransfer({ amount: 100 } as never)
      ).rejects.toThrow(BlazeServerError)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it("does not retry POST sendPayment on 503 (money-moving safety)", async () => {
      const fetchMock = mockFetch(
        503,
        { message: "Down" },
        "Service Unavailable"
      )
      await expect(
        client.sendPayment({ amount: 100 } as never)
      ).rejects.toThrow(BlazeServerError)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it("does not retry POST payContact on 503 (money-moving safety)", async () => {
      const fetchMock = mockFetch(
        503,
        { message: "Down" },
        "Service Unavailable"
      )
      await expect(
        client.payContact("r_1", "ba_1", {
          amount: 100,
          currencyId: "USD",
          usdcAmountInCents: 10000,
        })
      ).rejects.toThrow(BlazeServerError)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it("throws BlazeServerError after exhausting retries on a persistent 500", async () => {
      const fetchMock = jest
        .fn()
        .mockResolvedValue(
          mockResponse(500, { message: "boom" }, "Server Error")
        )
      global.fetch = fetchMock

      await expect(client.getBalance()).rejects.toThrow(BlazeServerError)
      // 1 initial attempt + MAX_RETRIES retries.
      expect(fetchMock).toHaveBeenCalledTimes(retry.MAX_RETRIES + 1)
    })

    it("retries a GET on 429 then succeeds", async () => {
      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce(
          mockResponse(429, { message: "Slow down" }, "Too Many Requests")
        )
        .mockResolvedValueOnce(mockResponse(200, { data: { available: "10" } }))
      global.fetch = fetchMock

      const result = await client.getBalance()

      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(result).toEqual({ available: "10" })
    })

    it("throws BlazeRateLimitError after exhausting retries on a persistent 429", async () => {
      const fetchMock = jest
        .fn()
        .mockResolvedValue(
          mockResponse(429, { message: "Slow down" }, "Too Many Requests")
        )
      global.fetch = fetchMock

      await expect(client.getBalance()).rejects.toThrow(BlazeRateLimitError)
      expect(fetchMock).toHaveBeenCalledTimes(retry.MAX_RETRIES + 1)
    })

    it("throws BlazeNetworkError after exhausting retries on persistent network failure", async () => {
      const networkError = Object.assign(new Error("socket hang up"), {
        code: "ECONNRESET",
      })
      const fetchMock = jest.fn().mockRejectedValue(networkError)
      global.fetch = fetchMock

      await expect(client.getBalance()).rejects.toThrow(BlazeNetworkError)
      expect(fetchMock).toHaveBeenCalledTimes(retry.MAX_RETRIES + 1)
    })
  })

  describe("payContact", () => {
    // Reads the JSON body of the most recent fetch call so request-construction
    // can be asserted field-by-field (the body also carries a random
    // idempotencyKey, so an exact body match isn't usable).
    function lastRequestBody(fetchMock: jest.Mock): Record<string, unknown> {
      const call = fetchMock.mock.calls[fetchMock.mock.calls.length - 1]
      return JSON.parse((call[1] as { body: string }).body)
    }

    it("posts a BankTransfer body with bankAccountId and fiatAmount to the recipient transfers endpoint", async () => {
      const fetchMock = mockFetch(200, { data: { id: "tr_1" } })

      await client.payContact("rec_1", "ba_1", {
        amount: 100,
        currencyId: "USD",
        usdcAmountInCents: 10000,
      })

      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.blaze.money/v1/recipients/rec_1/transfers",
        expect.objectContaining({ method: "POST" })
      )
      const body = lastRequestBody(fetchMock)
      expect(body.type).toBe("BankTransfer")
      expect(body.bankAccountId).toBe("ba_1")
      expect(body.fiatAmount).toEqual({ value: 10000, currencyId: "USD" })
      expect(body.usdcAmount).toEqual({ value: 10000, currencyId: "USD" })
      expect(body.idempotencyKey).toEqual(expect.any(String))
    })

    it("posts a CryptoTransfer body with cryptoAddressId and cents usdcAmount and no bankAccountId", async () => {
      const fetchMock = mockFetch(200, { data: { id: "tr_2" } })

      await client.payContactCrypto("rec_1", "addr_1", {
        usdcAmountInCents: 2500,
        amount: 25,
      })

      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.blaze.money/v1/recipients/rec_1/transfers",
        expect.objectContaining({ method: "POST" })
      )
      const body = lastRequestBody(fetchMock)
      expect(body.type).toBe("CryptoTransfer")
      expect(body.cryptoAddressId).toBe("addr_1")
      expect(body.usdcAmount).toEqual({ value: 2500, currencyId: "USD" })
      expect(body.idempotencyKey).toEqual(expect.any(String))
      expect(body.bankAccountId).toBeUndefined()
      expect(body.fiatAmount).toBeUndefined()
    })

    it("sends a unique idempotencyKey on each crypto send", async () => {
      const fetchMock = mockFetch(200, { data: { id: "tr_3" } })

      await client.payContactCrypto("rec_1", "addr_1", {
        usdcAmountInCents: 500,
      })
      await client.payContactCrypto("rec_1", "addr_1", {
        usdcAmountInCents: 500,
      })

      const firstBody = JSON.parse(
        (fetchMock.mock.calls[0][1] as { body: string }).body
      )
      const secondBody = JSON.parse(
        (fetchMock.mock.calls[1][1] as { body: string }).body
      )
      expect(firstBody.idempotencyKey).not.toBe(secondBody.idempotencyKey)
    })
  })
})
