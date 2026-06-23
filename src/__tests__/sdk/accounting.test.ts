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

    it("map puzzle provider to PUZZLE enum", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: { session_id: "s-2", auth_url: "https://puzzle.io/auth" },
        }),
      })

      await client.connectAccounting("puzzle")

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.blaze.money/v1/accounting/connect",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ provider: "PUZZLE" }),
        })
      )
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

    it("serialize the basis param when provided", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: { netIncome: 5000 } }),
      })

      await client.getProfitAndLoss({
        start_date: "2026-01-01",
        end_date: "2026-06-30",
        basis: "cash",
      })
      const calledUrl = mockFetch.mock.calls[0][0]
      expect(calledUrl).toContain("basis=cash")
      expect(mockFetch.mock.calls[0][1].method).toBe("GET")
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

    it("serialize the basis param when provided", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: { assets: { total: 10000 } } }),
      })

      await client.getBalanceSheet({ as_of: "2026-06-30", basis: "accrual" })
      const calledUrl = mockFetch.mock.calls[0][0]
      expect(calledUrl).toContain("as_of=2026-06-30")
      expect(calledUrl).toContain("basis=accrual")
    })
  })

  describe("getTrialBalance", () => {
    it("GET /v1/accounting/trial-balance with date, basis, and provider params", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: { isBalanced: true } }),
      })

      await client.getTrialBalance({
        start_date: "2026-01-01",
        end_date: "2026-06-30",
        basis: "cash",
        provider: "puzzle",
      })

      const calledUrl = mockFetch.mock.calls[0][0]
      expect(calledUrl).toContain("/v1/accounting/trial-balance")
      expect(calledUrl).toContain("start_date=2026-01-01")
      expect(calledUrl).toContain("end_date=2026-06-30")
      expect(calledUrl).toContain("basis=cash")
      expect(calledUrl).toContain("provider=puzzle")
      expect(mockFetch.mock.calls[0][1].method).toBe("GET")
    })
  })

  describe("getCashActivity", () => {
    it("GET /v1/accounting/cash-activity-statement with date and provider params", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: { netCashFlow: 1000 } }),
      })

      await client.getCashActivity({
        start_date: "2026-01-01",
        end_date: "2026-06-30",
        provider: "puzzle",
      })

      const calledUrl = mockFetch.mock.calls[0][0]
      expect(calledUrl).toContain("/v1/accounting/cash-activity-statement")
      expect(calledUrl).toContain("start_date=2026-01-01")
      expect(calledUrl).toContain("end_date=2026-06-30")
      expect(calledUrl).toContain("provider=puzzle")
      expect(mockFetch.mock.calls[0][1].method).toBe("GET")
    })
  })

  describe("getVendorSpending", () => {
    it("GET /v1/accounting/vendor-spending with date params", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: { vendors: [] } }),
      })

      await client.getVendorSpending({
        start_date: "2026-01-01",
        end_date: "2026-06-30",
      })

      const calledUrl = mockFetch.mock.calls[0][0]
      expect(calledUrl).toContain("/v1/accounting/vendor-spending")
      expect(calledUrl).toContain("start_date=2026-01-01")
      expect(calledUrl).toContain("end_date=2026-06-30")
      expect(mockFetch.mock.calls[0][1].method).toBe("GET")
    })
  })

  describe("getAccountingTransactions", () => {
    it("GET /v1/accounting/transactions with limit and offset pagination", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ object: "list", data: [] }),
      })

      await client.getAccountingTransactions({ limit: 50, offset: 100 })

      const calledUrl = mockFetch.mock.calls[0][0]
      expect(calledUrl).toContain("/v1/accounting/transactions")
      expect(calledUrl).toContain("limit=50")
      expect(calledUrl).toContain("offset=100")
      expect(mockFetch.mock.calls[0][1].method).toBe("GET")
    })

    it("omit the query string when no params are provided", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ object: "list", data: [] }),
      })

      await client.getAccountingTransactions()

      const calledUrl = mockFetch.mock.calls[0][0]
      expect(calledUrl).toBe(
        "https://api.test.blaze.money/v1/accounting/transactions"
      )
    })
  })

  describe("getAccountingBills", () => {
    it("GET /v1/accounting/bills with status, pagination, and provider params", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ object: "list", data: [] }),
      })

      await client.getAccountingBills({
        status: "OPEN",
        limit: 25,
        offset: 0,
        provider: "puzzle",
      })

      const calledUrl = mockFetch.mock.calls[0][0]
      expect(calledUrl).toContain("/v1/accounting/bills")
      expect(calledUrl).toContain("status=OPEN")
      expect(calledUrl).toContain("limit=25")
      expect(calledUrl).toContain("offset=0")
      expect(calledUrl).toContain("provider=puzzle")
      expect(mockFetch.mock.calls[0][1].method).toBe("GET")
    })
  })

  describe("getAccountingInvoices", () => {
    it("GET /v1/accounting/invoices with status and pagination params", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ object: "list", data: [] }),
      })

      await client.getAccountingInvoices({
        status: "PAID",
        limit: 25,
        offset: 50,
      })

      const calledUrl = mockFetch.mock.calls[0][0]
      expect(calledUrl).toContain("/v1/accounting/invoices")
      expect(calledUrl).toContain("status=PAID")
      expect(calledUrl).toContain("limit=25")
      expect(calledUrl).toContain("offset=50")
      expect(mockFetch.mock.calls[0][1].method).toBe("GET")
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

  describe("syncBillsFromAccounting", () => {
    it("POST /v1/accounting/sync/bills with the provider body and return the summary", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: { processed: 3, created: 2, skipped: 1 },
        }),
      })

      const result = await client.syncBillsFromAccounting({
        provider: "puzzle",
      })

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.blaze.money/v1/accounting/sync/bills",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ provider: "puzzle" }),
        })
      )
      expect(result).toEqual({ processed: 3, created: 2, skipped: 1 })
    })

    it("serialize an empty body when no params are provided", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: { processed: 0, created: 0, skipped: 0 },
        }),
      })

      await client.syncBillsFromAccounting()

      expect(mockFetch.mock.calls[0][1].body).toBe(JSON.stringify({}))
    })
  })

  describe("syncInvoicesFromAccounting", () => {
    it("POST /v1/accounting/sync/invoices with the provider body and return the summary", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: { processed: 4, created: 3, skipped: 1 },
        }),
      })

      const result = await client.syncInvoicesFromAccounting({
        provider: "puzzle",
      })

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.blaze.money/v1/accounting/sync/invoices",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ provider: "puzzle" }),
        })
      )
      expect(result).toEqual({ processed: 4, created: 3, skipped: 1 })
    })
  })

  describe("syncVendors", () => {
    it("POST /v1/accounting/sync/vendors with the provider body and return the summary", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: { processed: 5, created: 4, skipped: 1 },
        }),
      })

      const result = await client.syncVendors({ provider: "puzzle" })

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.blaze.money/v1/accounting/sync/vendors",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ provider: "puzzle" }),
        })
      )
      expect(result).toEqual({ processed: 5, created: 4, skipped: 1 })
    })
  })

  describe("syncCustomers", () => {
    it("POST /v1/accounting/sync/customers with the provider body and return the summary", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: { processed: 2, created: 2, skipped: 0 },
        }),
      })

      const result = await client.syncCustomers({ provider: "puzzle" })

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.blaze.money/v1/accounting/sync/customers",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ provider: "puzzle" }),
        })
      )
      expect(result).toEqual({ processed: 2, created: 2, skipped: 0 })
    })
  })

  describe("reconcileAccounts", () => {
    it("POST /v1/accounting/reconcile with the period and provider body and return the result", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            provider: "PUZZLE",
            reconciliationRate: 100,
            matched: [],
            unmatchedInternal: [],
            unmatchedPuzzle: [],
            discrepancies: [],
          },
        }),
      })

      const result = await client.reconcileAccounts({
        period_start: "2026-01-01",
        period_end: "2026-01-31",
        provider: "puzzle",
      })

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.blaze.money/v1/accounting/reconcile",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            period_start: "2026-01-01",
            period_end: "2026-01-31",
            provider: "puzzle",
          }),
        })
      )
      expect(result.provider).toBe("PUZZLE")
      expect(result.reconciliationRate).toBe(100)
    })

    it("omit the provider from the body when not provided", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            provider: "PUZZLE",
            reconciliationRate: 100,
            matched: [],
            unmatchedInternal: [],
            unmatchedPuzzle: [],
            discrepancies: [],
          },
        }),
      })

      await client.reconcileAccounts({
        period_start: "2026-01-01",
        period_end: "2026-01-31",
      })

      expect(mockFetch.mock.calls[0][1].body).toBe(
        JSON.stringify({
          period_start: "2026-01-01",
          period_end: "2026-01-31",
        })
      )
    })
  })

  describe("pushBillToAccounting", () => {
    it("POST /v1/accounting/bills with the bill id and provider body", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: { externalId: "pz-bill-1", pending: false },
        }),
      })

      const result = await client.pushBillToAccounting("bb-1", "puzzle")

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.blaze.money/v1/accounting/bills",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ bill_id: "bb-1", provider: "puzzle" }),
        })
      )
      expect(result).toEqual({ externalId: "pz-bill-1", pending: false })
    })

    it("omit the provider from the body when not provided", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: { externalId: "pz-bill-2", pending: true },
        }),
      })

      await client.pushBillToAccounting("bb-2")

      expect(mockFetch.mock.calls[0][1].body).toBe(
        JSON.stringify({ bill_id: "bb-2" })
      )
    })
  })

  describe("pushInvoiceToAccounting", () => {
    it("POST /v1/accounting/invoices with the invoice id and provider body", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: { externalId: "pz-inv-1", pending: false },
        }),
      })

      const result = await client.pushInvoiceToAccounting("bi-1", "puzzle")

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.blaze.money/v1/accounting/invoices",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ invoice_id: "bi-1", provider: "puzzle" }),
        })
      )
      expect(result).toEqual({ externalId: "pz-inv-1", pending: false })
    })
  })

  describe("getCloseStatus", () => {
    it("GET /v1/accounting/close-status with start, end, and provider params", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            period: { start: "2026-01-01", end: "2026-01-31" },
            reconciliation: { rate: 100, reconciled: true },
            trialBalanceBalances: true,
          },
        }),
      })

      const result = await client.getCloseStatus({
        start: "2026-01-01",
        end: "2026-01-31",
        provider: "puzzle",
      })

      const calledUrl = mockFetch.mock.calls[0][0]
      expect(calledUrl).toContain("/v1/accounting/close-status")
      expect(calledUrl).toContain("start=2026-01-01")
      expect(calledUrl).toContain("end=2026-01-31")
      expect(calledUrl).toContain("provider=puzzle")
      expect(mockFetch.mock.calls[0][1].method).toBe("GET")
      expect(result.reconciliation.reconciled).toBe(true)
      expect(result.trialBalanceBalances).toBe(true)
    })
  })
})
