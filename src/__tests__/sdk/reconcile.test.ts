import { BlazeClient } from "../../sdk/client"

describe("BlazeClient reconcileBankAccounts", () => {
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

  it("POST /v1/cfo/bank-reconciliation with the period bounds", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { reconciliationRate: 1 } }),
    })

    await client.reconcileBankAccounts({
      period_start: "2025-01-01",
      period_end: "2025-01-31",
    })

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.test.blaze.money/v1/cfo/bank-reconciliation",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          period_start: "2025-01-01",
          period_end: "2025-01-31",
        }),
      })
    )
  })

  it("includes account_id in the body when provided", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: {} }),
    })

    await client.reconcileBankAccounts({
      period_start: "2025-01-01",
      period_end: "2025-01-31",
      account_id: "acct_123",
    })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.account_id).toBe("acct_123")
  })

  it("omits account_id from the body when not provided", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: {} }),
    })

    await client.reconcileBankAccounts({
      period_start: "2025-01-01",
      period_end: "2025-01-31",
    })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body).not.toHaveProperty("account_id")
  })

  it("sends the X-API-Key header with the api key", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: {} }),
    })

    await client.reconcileBankAccounts({
      period_start: "2025-01-01",
      period_end: "2025-01-31",
    })

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-API-Key": "test-api-key",
        }),
      })
    )
  })

  it("returns the parsed data envelope from the response", async () => {
    const reconciliation = {
      period: { start: "2025-01-01", end: "2025-01-31" },
      matched: [
        {
          plaidTransactionId: "plaid_1",
          internalRecordId: "rec_1",
          amountMinorUnits: 50000,
          date: "2025-01-15",
          confidence: 0.98,
          description: "Vendor payment",
        },
      ],
      unmatchedBank: [],
      unmatchedInternal: [],
      lowConfidenceMatches: [],
      discrepancies: [],
      reconciliationRate: 1,
      totalPlaidTransactions: 1,
      totalInternalRecords: 1,
    }
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: reconciliation }),
    })

    const result = await client.reconcileBankAccounts({
      period_start: "2025-01-01",
      period_end: "2025-01-31",
    })

    expect(result).toEqual(reconciliation)
    expect(result.reconciliationRate).toBe(1)
    expect(result.matched).toHaveLength(1)
  })
})
