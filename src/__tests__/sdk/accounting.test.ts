import { BlazeClient } from "../../sdk/client"

describe("BlazeClient Accounting Methods", () => {
  let client: BlazeClient
  let mockFetch: jest.Mock

  beforeEach(() => {
    client = new BlazeClient({
      apiKey: "test-api-key",
      baseUrl: "https://api.test.blaze.money",
    })
    mockFetch = jest.fn()
    global.fetch = mockFetch
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe("connectAccounting", () => {
    it("send POST to /v1/accounting/connect with provider mapped to enum", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: { session_id: "s-1", auth_url: "https://qbo.com/auth" },
        }),
      })

      const result = await client.connectAccounting("quickbooks")
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.blaze.money/v1/accounting/connect",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ provider: "QUICKBOOKS_ONLINE" }),
        })
      )
      expect(result.session_id).toBe("s-1")
      expect(result.auth_url).toBe("https://qbo.com/auth")
    })
  })

  describe("getProfitAndLoss", () => {
    it("call correct REST endpoint with date params", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: { netIncome: 5000 } }),
      })

      await client.getProfitAndLoss({
        start_date: "2026-01-01",
        end_date: "2026-06-30",
      })
      const calledUrl = mockFetch.mock.calls[0][0]
      expect(calledUrl).toContain("/v1/accounting/profit-and-loss")
      expect(calledUrl).toContain("start_date=2026-01-01")
      expect(calledUrl).toContain("end_date=2026-06-30")
    })
  })

  describe("getBalanceSheet", () => {
    it("default as_of to undefined when not provided", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: { assets: { total: 10000 } } }),
      })

      await client.getBalanceSheet({})
      const calledUrl = mockFetch.mock.calls[0][0]
      expect(calledUrl).toContain("/v1/accounting/balance-sheet")
      expect(calledUrl).not.toContain("as_of")
    })
  })

  describe("createJournalEntry", () => {
    it("send correctly structured payload with mapped field names", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: { id: "je-1" } }),
      })

      await client.createJournalEntry({
        date: "2026-06-01",
        memo: "Test entry",
        idempotency_key: "idem-1",
        lines: [
          { accountId: "acct-1", amount: "100.00", type: "debit" },
          { accountId: "acct-2", amount: "100.00", type: "credit" },
        ],
      })

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.date).toBe("2026-06-01")
      expect(body.memo).toBe("Test entry")
      expect(body.idempotency_key).toBe("idem-1")
      expect(body.lines[0].account_id).toBe("acct-1")
      expect(body.lines[0].amount).toBe("100.00")
      expect(body.lines[0].type).toBe("debit")
    })
  })

  describe("getAccountingIntegrations", () => {
    it("call GET /v1/accounting/integrations", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: [{ id: "int-1", provider: "QUICKBOOKS_ONLINE" }],
        }),
      })

      const result = await client.getAccountingIntegrations()
      expect(mockFetch.mock.calls[0][0]).toContain(
        "/v1/accounting/integrations"
      )
      expect(result[0].provider).toBe("QUICKBOOKS_ONLINE")
    })
  })

  describe("disconnectAccounting", () => {
    it("call DELETE with integration ID", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: { success: true } }),
      })

      await client.disconnectAccounting("int-1")
      expect(mockFetch.mock.calls[0][0]).toContain(
        "/v1/accounting/integrations/int-1"
      )
      expect(mockFetch.mock.calls[0][1].method).toBe("DELETE")
    })
  })
})
