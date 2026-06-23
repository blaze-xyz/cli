import {
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
