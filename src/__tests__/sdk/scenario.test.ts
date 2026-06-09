import { BlazeClient } from "../../sdk/client"
import type { ScenarioAdjustment } from "../../sdk/types"

describe("BlazeClient modelScenario", () => {
  let client: BlazeClient
  let mockFetch: jest.Mock

  const adjustments: ScenarioAdjustment[] = [
    {
      type: "new_recurring_expense",
      amount_cents: 2400000,
      frequency: "monthly",
    },
  ]

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

  it("POST /v1/cfo/scenario with default horizon_days of 90", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { name: "Hire 2 engineers" } }),
    })

    await client.modelScenario({ name: "Hire 2 engineers", adjustments })

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.test.blaze.money/v1/cfo/scenario",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          name: "Hire 2 engineers",
          adjustments,
          horizon_days: 90,
        }),
      })
    )
  })

  it("POST /v1/cfo/scenario with an explicit horizon_days, name, and adjustments", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: {} }),
    })

    await client.modelScenario({ name: "x", adjustments, horizon_days: 30 })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.horizon_days).toBe(30)
    expect(body.name).toBe("x")
    expect(body.adjustments).toEqual(adjustments)
  })

  it("sends the X-API-Key header with the api key", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: {} }),
    })

    await client.modelScenario({ name: "x", adjustments: [] })

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
    const scenario = {
      name: "Hire 2 engineers",
      monthlyProjections: [],
      runwayMonths: 6,
      breakEvenDate: null,
      comparisonToBaseline: {
        runwayDiffMonths: 0,
        monthlyBurnDiffCents: -1800000,
        endingBalanceDiffCents: -7200000,
      },
    }
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: scenario }),
    })

    const result = await client.modelScenario({
      name: "Hire 2 engineers",
      adjustments,
    })

    expect(result).toEqual(scenario)
    expect(result.comparisonToBaseline.endingBalanceDiffCents).toBe(-7200000)
  })
})
