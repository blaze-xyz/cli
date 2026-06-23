import {
  annotateAmounts,
  annotateRecordCounts,
  annotateSpendingSummary,
  formatCents,
} from "../../agent/utils/format.utils"

describe("formatCents", () => {
  it("format 200077 cents as $2,000.77", () => {
    // Act
    const result = formatCents(200077)

    // Assert
    expect(result).toBe("$2,000.77")
  })

  it("format 0 cents as $0.00", () => {
    // Act
    const result = formatCents(0)

    // Assert
    expect(result).toBe("$0.00")
  })

  it("format 100099 cents as $1,000.99", () => {
    // Act
    const result = formatCents(100099)

    // Assert
    expect(result).toBe("$1,000.99")
  })

  it("format negative cents with a leading minus sign", () => {
    // Act
    const result = formatCents(-2500)

    // Assert
    expect(result).toBe("-$25.00")
  })

  it("return $0.00 for non-finite input", () => {
    // Assert
    expect(formatCents(Number.NaN)).toBe("$0.00")
    expect(formatCents(Number.POSITIVE_INFINITY)).toBe("$0.00")
    expect(formatCents("garbage" as unknown as number)).toBe("$0.00")
  })
})

describe("annotateSpendingSummary", () => {
  it("add pre-formatted dollar fields while preserving raw cents", () => {
    // Arrange
    const summary = {
      total_spending_cents: 200077,
      by_category: [
        { category: "Software", totalCents: 100099, transactionCount: 2 },
      ],
      top_merchants: [{ name: "X", totalCents: 99978, transactionCount: 1 }],
    }

    // Act
    const result = annotateSpendingSummary(summary) as {
      total_spending: string
      total_spending_cents: number
      by_category: Array<{
        category: string
        totalCents: number
        total: string
      }>
      top_merchants: Array<{ name: string; totalCents: number; total: string }>
    }

    // Assert
    expect(result.total_spending).toBe("$2,000.77")
    expect(result.by_category[0].total).toBe("$1,000.99")
    expect(result.top_merchants[0].total).toBe("$999.78")
    // Raw cents fields preserved (backward compatible)
    expect(result.total_spending_cents).toBe(200077)
    expect(result.by_category[0].totalCents).toBe(100099)
    expect(result.top_merchants[0].totalCents).toBe(99978)
  })

  it("not mutate the input object", () => {
    // Arrange
    const summary = {
      total_spending_cents: 200077,
      by_category: [{ category: "Software", totalCents: 100099 }],
      top_merchants: [],
    }

    // Act
    annotateSpendingSummary(summary)

    // Assert
    expect(summary).not.toHaveProperty("total_spending")
    expect(summary.by_category[0]).not.toHaveProperty("total")
  })

  it("return a non-summary object unchanged", () => {
    // Arrange
    const notASummary = { hello: "world" }

    // Act
    const result = annotateSpendingSummary(notASummary)

    // Assert
    expect(result).toEqual({ hello: "world" })
  })

  it("not crash on empty category/merchant arrays", () => {
    // Arrange
    const summary = {
      total_spending_cents: 0,
      by_category: [],
      top_merchants: [],
    }

    // Act
    const result = annotateSpendingSummary(summary) as {
      total_spending: string
      by_category: unknown[]
      top_merchants: unknown[]
    }

    // Assert
    expect(result.total_spending).toBe("$0.00")
    expect(result.by_category).toEqual([])
    expect(result.top_merchants).toEqual([])
  })

  it("pass through null and primitive inputs", () => {
    // Assert
    expect(annotateSpendingSummary(null)).toBeNull()
    expect(annotateSpendingSummary("nope")).toBe("nope")
  })
})

describe("annotateAmounts", () => {
  it("add amount_display to nested balance amounts in minor units", () => {
    // Arrange
    const balance = {
      object: "balance",
      available: { amount: 60, currency: "USD" },
      pending: { amount: 7062, currency: "USD" },
    }

    // Act
    const result = annotateAmounts(balance) as {
      available: { amount: number; currency: string; amount_display: string }
      pending: { amount_display: string }
    }

    // Assert
    expect(result.available.amount_display).toBe("$0.60")
    expect(result.pending.amount_display).toBe("$70.62")
    expect(result.available.amount).toBe(60)
  })

  it("annotate each item amount in a transactions list", () => {
    // Arrange
    const list = {
      object: "list",
      data: [
        { id: "t1", amount: 250000, currency: "USD", fee: null },
        { id: "t2", amount: 100000, currency: "USD", fee: 250 },
      ],
    }

    // Act
    const result = annotateAmounts(list) as {
      data: Array<{ amount_display: string; fee_display?: string }>
    }

    // Assert
    expect(result.data[0].amount_display).toBe("$2,500.00")
    expect(result.data[1].amount_display).toBe("$1,000.00")
    expect(result.data[1].fee_display).toBe("$2.50")
    expect(result.data[0].fee_display).toBeUndefined()
  })

  it("format a non-USD currency from minor units", () => {
    // Act
    const result = annotateAmounts({ amount: 250000, currency: "MXN" }) as {
      amount_display: string
    }

    // Assert
    expect(result.amount_display).toContain("2,500.00")
  })

  it("leave objects without a currency untouched", () => {
    // Arrange
    const obj = { amount: 60, name: "no currency here" }

    // Act
    const result = annotateAmounts(obj)

    // Assert
    expect(result).toEqual({ amount: 60, name: "no currency here" })
  })

  it("not mutate the input object", () => {
    // Arrange
    const balance = { available: { amount: 60, currency: "USD" } }

    // Act
    annotateAmounts(balance)

    // Assert
    expect(balance.available).not.toHaveProperty("amount_display")
  })

  it("pass through null and primitive inputs", () => {
    // Assert
    expect(annotateAmounts(null)).toBeNull()
    expect(annotateAmounts(42)).toBe(42)
    expect(annotateAmounts("nope")).toBe("nope")
  })
})

describe("annotateRecordCounts", () => {
  it("compute count and by_status from a transactions list (backend-agnostic)", () => {
    // Arrange — synthetic data, no backend involved
    const result = {
      object: "list",
      data: [
        { id: "a", status: "completed" },
        { id: "b", status: "failed" },
        { id: "c", status: "failed" },
        { id: "d", status: "completed" },
        { id: "e", status: "failed" },
      ],
    }

    // Act
    const r = annotateRecordCounts(result) as {
      summary: { count: number; by_status: Record<string, number> }
    }

    // Assert
    expect(r.summary.count).toBe(5)
    expect(r.summary.by_status).toEqual({ completed: 2, failed: 3 })
  })

  it("count records that have no status (count only)", () => {
    // Act
    const r = annotateRecordCounts({ data: [{ id: "x" }, { id: "y" }] }) as {
      summary: { count: number; by_status: Record<string, number> }
    }

    // Assert
    expect(r.summary.count).toBe(2)
    expect(r.summary.by_status).toEqual({})
  })

  it("pass through non-list results unchanged", () => {
    // Assert
    expect(annotateRecordCounts({ object: "balance", amount: 60 })).toEqual({
      object: "balance",
      amount: 60,
    })
    expect(annotateRecordCounts(null)).toBeNull()
    expect(annotateRecordCounts([1, 2, 3])).toEqual([1, 2, 3])
  })
})
