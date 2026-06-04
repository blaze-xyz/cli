import * as schemas from "../../mcp/schemas"

describe("cashFlowForecastSchema", () => {
  it("accepts an empty object since horizon_days is optional", () => {
    const result = schemas.cashFlowForecastSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it("accepts a valid horizon_days within range", () => {
    const result = schemas.cashFlowForecastSchema.safeParse({
      horizon_days: 90,
    })
    expect(result.success).toBe(true)
  })

  it("accepts the minimum horizon_days of 1", () => {
    const result = schemas.cashFlowForecastSchema.safeParse({ horizon_days: 1 })
    expect(result.success).toBe(true)
  })

  it("accepts the maximum horizon_days of 365", () => {
    const result = schemas.cashFlowForecastSchema.safeParse({
      horizon_days: 365,
    })
    expect(result.success).toBe(true)
  })

  it("rejects a horizon_days below the minimum of 1", () => {
    const result = schemas.cashFlowForecastSchema.safeParse({ horizon_days: 0 })
    expect(result.success).toBe(false)
  })

  it("rejects a horizon_days above the maximum of 365", () => {
    const result = schemas.cashFlowForecastSchema.safeParse({
      horizon_days: 366,
    })
    expect(result.success).toBe(false)
  })

  it("rejects a non-integer horizon_days", () => {
    const result = schemas.cashFlowForecastSchema.safeParse({
      horizon_days: 30.5,
    })
    expect(result.success).toBe(false)
  })
})
