import { BlazeClient } from "../../sdk/client"

describe("BlazeClient getCashFlowForecast", () => {
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

  it("POST /v1/cfo/cash-flow-forecast with default horizon_days of 90", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { runwayMonths: 12 } }),
    })

    await client.getCashFlowForecast({})

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.test.blaze.money/v1/cfo/cash-flow-forecast",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ horizon_days: 90 }),
      })
    )
  })

  it("POST /v1/cfo/cash-flow-forecast with an explicit horizon_days", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { runwayMonths: 4 } }),
    })

    await client.getCashFlowForecast({ horizon_days: 30 })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.horizon_days).toBe(30)
  })

  it("sends the X-API-Key header with the api key", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: {} }),
    })

    await client.getCashFlowForecast({ horizon_days: 60 })

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
    const forecast = {
      dailyProjections: [
        { date: "2026-06-03", projectedBalanceMinorUnits: 500000 },
      ],
      cashCrunchDate: null,
      recurringInflows: [],
      recurringOutflows: [],
      netBurnRateMonthlyMinorUnits: -120000,
      runwayMonths: 8,
      currentBalanceMinorUnits: 500000,
      currency: "USD",
    }
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: forecast }),
    })

    const result = await client.getCashFlowForecast({ horizon_days: 90 })

    expect(result).toEqual(forecast)
    expect(result.runwayMonths).toBe(8)
    expect(result.currency).toBe("USD")
  })
})
