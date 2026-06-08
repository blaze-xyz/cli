import * as schemas from "../../mcp/schemas"

describe("bankReconciliationSchema", () => {
  it("accepts the required period bounds without account_id", () => {
    const result = schemas.bankReconciliationSchema.safeParse({
      period_start: "2025-01-01",
      period_end: "2025-01-31",
    })
    expect(result.success).toBe(true)
  })

  it("accepts an optional account_id", () => {
    const result = schemas.bankReconciliationSchema.safeParse({
      period_start: "2025-01-01",
      period_end: "2025-01-31",
      account_id: "acct_123",
    })
    expect(result.success).toBe(true)
  })

  it("rejects a missing period_start", () => {
    const result = schemas.bankReconciliationSchema.safeParse({
      period_end: "2025-01-31",
    })
    expect(result.success).toBe(false)
  })

  it("rejects a missing period_end", () => {
    const result = schemas.bankReconciliationSchema.safeParse({
      period_start: "2025-01-01",
    })
    expect(result.success).toBe(false)
  })

  it("rejects a non-string period_start", () => {
    const result = schemas.bankReconciliationSchema.safeParse({
      period_start: 20250101,
      period_end: "2025-01-31",
    })
    expect(result.success).toBe(false)
  })

  it("rejects a non-string account_id", () => {
    const result = schemas.bankReconciliationSchema.safeParse({
      period_start: "2025-01-01",
      period_end: "2025-01-31",
      account_id: 123,
    })
    expect(result.success).toBe(false)
  })
})
