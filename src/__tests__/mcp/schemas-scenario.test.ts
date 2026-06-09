import * as schemas from "../../mcp/schemas"

describe("scenarioAdjustmentSchema", () => {
  it("accepts a minimal adjustment with only a valid type", () => {
    const result = schemas.scenarioAdjustmentSchema.safeParse({
      type: "one_time_cost",
    })
    expect(result.success).toBe(true)
  })

  it("accepts a fully specified adjustment", () => {
    const result = schemas.scenarioAdjustmentSchema.safeParse({
      type: "new_recurring_expense",
      amount_cents: 2400000,
      frequency: "monthly",
      start_date: "2026-06-01",
      end_date: "2026-09-01",
      description: "2 senior engineers",
    })
    expect(result.success).toBe(true)
  })

  it("rejects an unknown adjustment type", () => {
    const result = schemas.scenarioAdjustmentSchema.safeParse({ type: "bogus" })
    expect(result.success).toBe(false)
  })

  it("rejects an adjustment missing the type", () => {
    const result = schemas.scenarioAdjustmentSchema.safeParse({
      amount_cents: 100,
    })
    expect(result.success).toBe(false)
  })
})

describe("scenarioModelingSchema", () => {
  const validAdjustment = {
    type: "new_recurring_expense",
    amount_cents: 100000,
    frequency: "monthly",
  }

  it("accepts a scenario without horizon_days since it is optional", () => {
    const result = schemas.scenarioModelingSchema.safeParse({
      name: "Hire 2 engineers",
      adjustments: [validAdjustment],
    })
    expect(result.success).toBe(true)
  })

  it("accepts a scenario with a valid horizon_days", () => {
    const result = schemas.scenarioModelingSchema.safeParse({
      name: "Hire 2 engineers",
      adjustments: [validAdjustment],
      horizon_days: 90,
    })
    expect(result.success).toBe(true)
  })

  it("accepts an empty adjustments array", () => {
    const result = schemas.scenarioModelingSchema.safeParse({
      name: "Baseline echo",
      adjustments: [],
    })
    expect(result.success).toBe(true)
  })

  it("rejects a scenario missing the name", () => {
    const result = schemas.scenarioModelingSchema.safeParse({
      adjustments: [validAdjustment],
    })
    expect(result.success).toBe(false)
  })

  it("rejects a scenario missing the adjustments", () => {
    const result = schemas.scenarioModelingSchema.safeParse({ name: "x" })
    expect(result.success).toBe(false)
  })

  it("rejects an adjustment with an invalid type inside the array", () => {
    const result = schemas.scenarioModelingSchema.safeParse({
      name: "x",
      adjustments: [{ type: "not_a_real_type" }],
    })
    expect(result.success).toBe(false)
  })

  it("rejects a horizon_days below the minimum of 1", () => {
    const result = schemas.scenarioModelingSchema.safeParse({
      name: "x",
      adjustments: [],
      horizon_days: 0,
    })
    expect(result.success).toBe(false)
  })

  it("rejects a horizon_days above the maximum of 365", () => {
    const result = schemas.scenarioModelingSchema.safeParse({
      name: "x",
      adjustments: [],
      horizon_days: 366,
    })
    expect(result.success).toBe(false)
  })

  it("rejects a non-integer horizon_days", () => {
    const result = schemas.scenarioModelingSchema.safeParse({
      name: "x",
      adjustments: [],
      horizon_days: 30.5,
    })
    expect(result.success).toBe(false)
  })
})
