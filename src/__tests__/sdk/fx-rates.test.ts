import { USD_RATES, estimateUsdAmount } from "../../constants/fx-rates"

describe("estimateUsdAmount", () => {
  it("returns correct USD for MXN", () => {
    // Arrange
    const amount = 1715
    const currency = "MXN"

    // Act
    const result = estimateUsdAmount(amount, currency)

    // Assert
    expect(result).toBeCloseTo(1715 / 17.15, 5)
  })

  it("returns correct USD for EUR", () => {
    // Arrange
    const amount = 92
    const currency = "EUR"

    // Act
    const result = estimateUsdAmount(amount, currency)

    // Assert
    expect(result).toBeCloseTo(92 / 0.92, 5)
  })

  it("falls back to rate of 1 for unknown currency", () => {
    // Arrange
    const amount = 250
    const currency = "XYZ"

    // Act
    const result = estimateUsdAmount(amount, currency)

    // Assert
    expect(result).toBe(250)
  })

  it("performs case-insensitive currency lookup", () => {
    // Arrange
    const amount = 500

    // Act
    const upperResult = estimateUsdAmount(amount, "BRL")
    const lowerResult = estimateUsdAmount(amount, "brl")

    // Assert
    expect(lowerResult).toBe(upperResult)
    expect(lowerResult).toBeCloseTo(500 / 5.05, 5)
  })
})

describe("USD_RATES", () => {
  it("contains expected currencies", () => {
    // Arrange & Act
    const currencies = Object.keys(USD_RATES)

    // Assert
    expect(currencies).toContain("MXN")
    expect(currencies).toContain("BRL")
    expect(currencies).toContain("EUR")
    expect(currencies).toContain("GBP")
    expect(currencies).toContain("COP")
    expect(currencies).toContain("ARS")
  })
})
