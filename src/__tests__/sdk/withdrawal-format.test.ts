import {
  formatConnectedPaymentMethodLabel,
  estimateWithdrawalArrival,
  estimateLocalAmount,
  deriveWithdrawalAmounts,
  humanizeWithdrawIneligibilityReason,
  mapToPaymentMethodType,
  suggestedLocalMinimum,
  toCents,
  totalFeeCents,
  MAX_TRANSACTION_CENTS,
} from "../../constants/withdrawal-format"
import type { ConnectedPaymentMethod } from "../../sdk/types"

function makeMethod(
  overrides: Partial<ConnectedPaymentMethod> = {}
): ConnectedPaymentMethod {
  return {
    id: "pm_1",
    type: "Bank",
    displayName: null,
    nickname: null,
    maskedAccountNumber: null,
    canDeposit: false,
    canWithdraw: true,
    withdrawIneligibilityReason: null,
    disbursementEligible: null,
    isDefault: false,
    rampVerificationStatus: "Verified",
    provider: null,
    card: null,
    binData: null,
    ...overrides,
  }
}

describe("formatConnectedPaymentMethodLabel", () => {
  it("combines displayName with last 4 parsed from maskedAccountNumber", () => {
    // Arrange
    const method = makeMethod({
      type: "Card",
      displayName: "Banamex",
      nickname: "Banamex",
      maskedAccountNumber: "•••• 3899",
      card: null,
    })

    // Act
    const label = formatConnectedPaymentMethodLabel(method)

    // Assert
    expect(label).toBe("Banamex ••3899")
  })

  it("combines card brand with card lastFour when no displayName", () => {
    // Arrange
    const method = makeMethod({
      type: "Card",
      displayName: null,
      nickname: null,
      card: { id: "card_1", lastFour: "4242", brand: "Visa" },
    })

    // Act
    const label = formatConnectedPaymentMethodLabel(method)

    // Assert
    expect(label).toBe("Visa ••4242")
  })

  it("falls back to nickname plus last 4 when displayName is missing", () => {
    // Arrange
    const method = makeMethod({
      displayName: null,
      nickname: "Savings",
      maskedAccountNumber: "•••• 1234",
    })

    // Act
    const label = formatConnectedPaymentMethodLabel(method)

    // Assert
    expect(label).toBe("Savings ••1234")
  })

  it("uses the name alone when no last 4 is available", () => {
    // Arrange
    const method = makeMethod({
      displayName: "Wise Account",
      maskedAccountNumber: null,
      card: null,
    })

    // Act
    const label = formatConnectedPaymentMethodLabel(method)

    // Assert
    expect(label).toBe("Wise Account")
  })

  it("uses the masked account number when there is no name", () => {
    // Arrange
    const method = makeMethod({
      displayName: null,
      nickname: null,
      card: null,
      maskedAccountNumber: "ACCT-XYZ",
    })

    // Act
    const label = formatConnectedPaymentMethodLabel(method)

    // Assert
    expect(label).toBe("ACCT-XYZ")
  })

  it("falls back to type and id when no other detail is present", () => {
    // Arrange
    const method = makeMethod({
      id: "pm_99",
      type: "Bank",
      displayName: null,
      nickname: null,
      card: null,
      maskedAccountNumber: null,
    })

    // Act
    const label = formatConnectedPaymentMethodLabel(method)

    // Assert
    expect(label).toBe("Bank (pm_99)")
  })
})

describe("estimateWithdrawalArrival", () => {
  it("estimates minutes for an instant transfer regardless of currency", () => {
    // Arrange & Act
    const arrival = estimateWithdrawalArrival({
      instantTransfer: true,
      currency: "USD",
    })

    // Assert
    expect(arrival).toBe("It should land within a few minutes.")
  })

  it("estimates 1-2 business days for a standard USD withdrawal", () => {
    // Arrange & Act
    const arrival = estimateWithdrawalArrival({
      instantTransfer: false,
      currency: "USD",
    })

    // Assert
    expect(arrival).toBe("It usually arrives in 1–2 business days.")
  })

  it("estimates a few minutes to a couple of hours for standard MXN", () => {
    // Arrange & Act
    const arrival = estimateWithdrawalArrival({
      instantTransfer: false,
      currency: "MXN",
    })

    // Assert
    expect(arrival).toBe(
      "It usually arrives within a few minutes to a couple of hours."
    )
  })

  it("estimates minutes for standard BRL", () => {
    // Arrange & Act
    const arrival = estimateWithdrawalArrival({
      instantTransfer: false,
      currency: "BRL",
    })

    // Assert
    expect(arrival).toBe("It usually arrives within minutes.")
  })

  it("performs a case-insensitive currency lookup", () => {
    // Arrange & Act
    const arrival = estimateWithdrawalArrival({
      instantTransfer: false,
      currency: "mxn",
    })

    // Assert
    expect(arrival).toBe(
      "It usually arrives within a few minutes to a couple of hours."
    )
  })
})

describe("toCents", () => {
  it("rounds half-cent boundaries up without float drift", () => {
    // Arrange & Act — 1.005 * 100 = 100.4999… in IEEE-754; toCents must give 101.
    const cents = toCents(1.005)

    // Assert
    expect(cents).toBe(101)
  })

  it("converts a clean major amount to exact cents", () => {
    // Arrange & Act
    const cents = toCents(25)

    // Assert
    expect(cents).toBe(2500)
  })

  it("avoids float drift on 0.1 + 0.2 style sums", () => {
    // Arrange — 0.1 + 0.2 = 0.30000000000000004 in IEEE-754.
    const amount = 0.1 + 0.2

    // Act
    const cents = toCents(amount)

    // Assert
    expect(cents).toBe(30)
  })
})

describe("deriveWithdrawalAmounts", () => {
  it("returns equal usdc and fiat cents for a USD withdrawal", () => {
    // Arrange & Act
    const result = deriveWithdrawalAmounts({ amount: 25, currency: "USD" })

    // Assert
    expect(result).toEqual({
      ok: true,
      amounts: {
        fiatAmountInCents: 2500,
        usdcAmountInCents: 2500,
        conversionNote: "",
      },
    })
  })

  it("converts a supported non-USD currency and includes a conversion note", () => {
    // Arrange & Act — MXN rate 17.15 → 100 MXN ≈ $5.83 USD → 583 cents.
    const result = deriveWithdrawalAmounts({ amount: 100, currency: "MXN" })

    // Assert
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("expected ok result")
    expect(result.amounts.fiatAmountInCents).toBe(10000)
    expect(result.amounts.usdcAmountInCents).toBe(583)
    expect(result.amounts.conversionNote).toBe(
      " (~$5.83 USD from your balance)"
    )
  })

  it("uppercases the currency before validating and converting", () => {
    // Arrange & Act
    const result = deriveWithdrawalAmounts({ amount: 100, currency: "mxn" })

    // Assert
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("expected ok result")
    expect(result.amounts.usdcAmountInCents).toBe(583)
  })

  it("rejects an unsupported currency with a supported-list message", () => {
    // Arrange & Act
    const result = deriveWithdrawalAmounts({ amount: 50, currency: "JPY" })

    // Assert
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("expected error result")
    expect(result.error).toContain("Withdrawals in JPY aren't supported yet")
    expect(result.error).toContain("USD")
  })

  it("rejects a zero amount", () => {
    // Arrange & Act
    const result = deriveWithdrawalAmounts({ amount: 0, currency: "USD" })

    // Assert
    expect(result).toEqual({
      ok: false,
      error: "Amount must be greater than zero.",
    })
  })

  it("rejects a negative amount", () => {
    // Arrange & Act
    const result = deriveWithdrawalAmounts({ amount: -5, currency: "USD" })

    // Assert
    expect(result).toEqual({
      ok: false,
      error: "Amount must be greater than zero.",
    })
  })

  it("rejects an amount above the per-transaction cap", () => {
    // Arrange — just over $21.47M (the Int max in cents).
    const amount = MAX_TRANSACTION_CENTS / 100 + 1

    // Act
    const result = deriveWithdrawalAmounts({ amount, currency: "USD" })

    // Assert
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("expected error result")
    expect(result.error).toContain("too large")
  })
})

describe("estimateLocalAmount", () => {
  it("converts a USD amount to MXN using the static rate", () => {
    // Arrange & Act — MXN rate is 17.15, so $5 ≈ 85.75 MXN.
    const local = estimateLocalAmount(5, "MXN")

    // Assert
    expect(local).toBeCloseTo(85.75, 2)
  })

  it("performs a case-insensitive currency lookup", () => {
    // Arrange & Act
    const local = estimateLocalAmount(5, "mxn")

    // Assert
    expect(local).toBeCloseTo(85.75, 2)
  })

  it("returns the USD amount unchanged for an unknown currency", () => {
    // Arrange & Act
    const local = estimateLocalAmount(5, "JPY")

    // Assert
    expect(local).toBe(5)
  })
})

describe("suggestedLocalMinimum", () => {
  it("uses the live rate plus a one-unit spread buffer when a rate is given", () => {
    // Arrange & Act — $5 / 0.0567 = 88.18 → ceil 89, +1 spread buffer = 90.
    const local = suggestedLocalMinimum(5, "MXN", 0.0567)

    // Assert
    expect(local).toBe(90)
  })

  it("falls back to a 10% buffered static estimate when no rate is given", () => {
    // Arrange & Act — static $5 in MXN is 85.75 → ceil(85.75 * 1.1) = 95.
    const local = suggestedLocalMinimum(5, "MXN", null)

    // Assert
    expect(local).toBe(Math.ceil(estimateLocalAmount(5, "MXN") * 1.1))
    expect(local).toBe(95)
  })

  it("falls back to the static estimate when the rate is zero or negative", () => {
    // Arrange & Act — a non-positive rate is treated as unavailable.
    const local = suggestedLocalMinimum(5, "MXN", 0)

    // Assert
    expect(local).toBe(95)
  })
})

describe("totalFeeCents", () => {
  it("sums the amountCents across multiple fee rows", () => {
    // Arrange & Act
    const total = totalFeeCents([{ amountCents: 200 }, { amountCents: 50 }])

    // Assert
    expect(total).toBe(250)
  })

  it("returns 0 for an empty fee collection array", () => {
    // Arrange & Act
    const total = totalFeeCents([])

    // Assert
    expect(total).toBe(0)
  })

  it("returns 0 for a null fee collection", () => {
    // Arrange & Act
    const total = totalFeeCents(null)

    // Assert
    expect(total).toBe(0)
  })

  it("returns 0 for an undefined fee collection", () => {
    // Arrange & Act
    const total = totalFeeCents(undefined)

    // Assert
    expect(total).toBe(0)
  })
})

describe("mapToPaymentMethodType", () => {
  it("maps Card to the Card fee-API type", () => {
    // Arrange & Act
    const type = mapToPaymentMethodType("Card")

    // Assert
    expect(type).toBe("Card")
  })

  it("maps Bank to the Bank fee-API type", () => {
    // Arrange & Act
    const type = mapToPaymentMethodType("Bank")

    // Assert
    expect(type).toBe("Bank")
  })

  it("maps Cash to the Cash fee-API type", () => {
    // Arrange & Act
    const type = mapToPaymentMethodType("Cash")

    // Assert
    expect(type).toBe("Cash")
  })

  it("maps VirtualAccount to the VirtualAccount fee-API type", () => {
    // Arrange & Act
    const type = mapToPaymentMethodType("VirtualAccount")

    // Assert
    expect(type).toBe("VirtualAccount")
  })

  it("returns null for an unpriceable Other type", () => {
    // Arrange & Act
    const type = mapToPaymentMethodType("Other")

    // Assert
    expect(type).toBeNull()
  })

  it("returns null for PayPal which the fee API doesn't price", () => {
    // Arrange & Act
    const type = mapToPaymentMethodType("PayPal")

    // Assert
    expect(type).toBeNull()
  })

  it("returns null for a null user type", () => {
    // Arrange & Act
    const type = mapToPaymentMethodType(null)

    // Assert
    expect(type).toBeNull()
  })
})

describe("humanizeWithdrawIneligibilityReason", () => {
  it("maps the CREDIT_CARD token to a friendly explanation", () => {
    // Arrange & Act
    const reason = humanizeWithdrawIneligibilityReason("CREDIT_CARD")

    // Assert
    expect(reason).toBe("credit cards can't receive withdrawals")
  })

  it("lowercases and de-underscores an unknown token", () => {
    // Arrange & Act
    const reason = humanizeWithdrawIneligibilityReason("SOME_NEW_REASON")

    // Assert
    expect(reason).toBe("some new reason")
  })

  it("returns a generic message for a null reason", () => {
    // Arrange & Act
    const reason = humanizeWithdrawIneligibilityReason(null)

    // Assert
    expect(reason).toBe("this method can't receive withdrawals right now")
  })
})
