import type { BlazeClient } from "../../sdk/client"
import type { MemoryStore } from "../../agent/memory"
import { buildTools, executeTool } from "../../agent/tools"

function makeClient(overrides: Record<string, jest.Mock> = {}): {
  client: BlazeClient
  mocks: {
    listConnectedPaymentMethods: jest.Mock
    withdrawToPaymentMethod: jest.Mock
    getBalance: jest.Mock
    checkWithdrawalLimits: jest.Mock
    getRampTransfer: jest.Mock
    getApplicableWithdrawalFee: jest.Mock
  }
} {
  const mocks = {
    listConnectedPaymentMethods: jest.fn().mockResolvedValue({
      methods: [{ id: "pm_1", type: "Bank", canWithdraw: true }],
      defaultWithdrawalMethodId: "pm_1",
      countryCode: "US",
    }),
    withdrawToPaymentMethod: jest
      .fn()
      .mockResolvedValue({ status: "PENDING", rampTransferId: "rt_1" }),
    getBalance: jest.fn().mockResolvedValue({ available: 100000, pending: 0 }),
    // Default to a passing limit check and a fee-less transfer so the happy
    // path runs unless a test overrides these.
    checkWithdrawalLimits: jest.fn().mockResolvedValue({
      meetsMinimum: true,
      isUnderLimit: true,
      minimumAmountCents: 500,
    }),
    getRampTransfer: jest
      .fn()
      .mockResolvedValue({ id: "rt_1", feeCollections: [] }),
    getApplicableWithdrawalFee: jest.fn().mockResolvedValue({
      totalFeeCents: 200,
      displayName: "Card Withdrawal Fee",
      flatFeeCents: 0,
      percentageFeeCents: 0,
      percentageRate: 0.02,
      minFeeCents: 200,
      configId: "c",
    }),
    ...overrides,
  }
  return { client: mocks as unknown as BlazeClient, mocks }
}

const memory = {} as MemoryStore

describe("agent tool registry — consumer withdrawal tools", () => {
  it("registers the list, withdraw, and estimate-fee tools", () => {
    // Arrange
    const { client } = makeClient()

    // Act
    const tools = buildTools(client, memory)

    // Assert
    const names = tools.map(t => t.name)
    expect(names).toContain("blaze_list_connected_payment_methods")
    expect(names).toContain("blaze_withdraw")
    expect(names).toContain("blaze_estimate_withdrawal_fee")
  })

  it("declares amount as the only required param for blaze_withdraw", () => {
    // Arrange
    const { client } = makeClient()

    // Act
    const tools = buildTools(client, memory)

    // Assert
    const withdraw = tools.find(t => t.name === "blaze_withdraw")
    expect(withdraw?.input_schema.required).toEqual(["amount"])
    expect(withdraw?.input_schema.properties).toHaveProperty(
      "payment_method_id"
    )
  })

  it("returns a contact-list-style shape filtered to withdrawal-eligible methods", async () => {
    // Arrange
    const { client } = makeClient({
      listConnectedPaymentMethods: jest.fn().mockResolvedValue({
        methods: [
          {
            id: "pm_1",
            type: "Card",
            displayName: "Banamex",
            maskedAccountNumber: "•••• 3899",
            canWithdraw: true,
          },
          { id: "pm_2", type: "Card", canWithdraw: false },
        ],
        defaultWithdrawalMethodId: "pm_1",
      }),
    })

    // Act
    const result = (await executeTool(
      "blaze_list_connected_payment_methods",
      {},
      client,
      memory
    )) as {
      methods: {
        id: string
        label: string
        type: string
        isDefault: boolean
        canWithdraw: boolean
      }[]
      defaultWithdrawalMethodId: string
    }

    // Assert
    expect(result.methods).toEqual([
      {
        id: "pm_1",
        label: "Banamex ••3899",
        type: "Card",
        isDefault: true,
        canWithdraw: true,
      },
    ])
    expect(result.defaultWithdrawalMethodId).toBe("pm_1")
  })

  it("humanizes the ineligibility reason only when all is true", async () => {
    // Arrange
    const { client } = makeClient({
      listConnectedPaymentMethods: jest.fn().mockResolvedValue({
        methods: [
          {
            id: "pm_2",
            type: "Card",
            displayName: "Old Card",
            canWithdraw: false,
            withdrawIneligibilityReason: "CREDIT_CARD",
          },
        ],
        defaultWithdrawalMethodId: "pm_1",
      }),
    })

    // Act
    const result = (await executeTool(
      "blaze_list_connected_payment_methods",
      { all: true },
      client,
      memory
    )) as { methods: { id: string; ineligibleReason?: string }[] }

    // Assert
    expect(result.methods[0].ineligibleReason).toBe(
      "credit cards can't receive withdrawals"
    )
  })

  it("blocks listing connected methods in business context", async () => {
    // Arrange
    const { client, mocks } = makeClient()
    ;(client as unknown as { authContext: string }).authContext = "business"

    // Act
    const result = (await executeTool(
      "blaze_list_connected_payment_methods",
      {},
      client,
      memory
    )) as { success: boolean; error: string }

    // Assert
    expect(result.success).toBe(false)
    expect(result.error).toContain("personal session")
    expect(mocks.listConnectedPaymentMethods).not.toHaveBeenCalled()
  })

  it("submits a USD withdrawal with equal usdc/fiat cents to the only eligible method", async () => {
    // Arrange
    const { client, mocks } = makeClient()

    // Act
    const result = (await executeTool(
      "blaze_withdraw",
      { amount: 25, currency: "USD" },
      client,
      memory
    )) as {
      success: boolean
      rampTransferId: string
      estimatedArrival: string
      summary: string
    }

    // Assert
    expect(mocks.withdrawToPaymentMethod).toHaveBeenCalledWith({
      paymentMethodId: "pm_1",
      usdcAmountInCents: 2500,
      fiatAmountInCents: 2500,
      currencyCode: "USD",
      instantTransfer: false,
    })
    expect(result.success).toBe(true)
    expect(result.rampTransferId).toBe("rt_1")
    expect(result.estimatedArrival).toBe(
      "It usually arrives in 1–2 business days."
    )
    expect(result.summary).toContain("is on its way.")
  })

  it("includes the real fee in the result and summary on a successful withdrawal", async () => {
    // Arrange
    const { client } = makeClient({
      getRampTransfer: jest.fn().mockResolvedValue({
        id: "rt_1",
        feeCollections: [{ amountCents: 200 }],
      }),
    })

    // Act
    const result = (await executeTool(
      "blaze_withdraw",
      { amount: 25, currency: "USD" },
      client,
      memory
    )) as { success: boolean; fee: string; summary: string }

    // Assert
    expect(result.success).toBe(true)
    expect(result.fee).toBe("$2.00")
    expect(result.summary).toContain("(fee $2.00)")
  })

  it("rejects a below-minimum withdrawal with the server minimum and never submits", async () => {
    // Arrange
    const { client, mocks } = makeClient({
      checkWithdrawalLimits: jest.fn().mockResolvedValue({
        meetsMinimum: false,
        isUnderLimit: true,
        minimumAmountCents: 500,
      }),
    })

    // Act
    const result = (await executeTool(
      "blaze_withdraw",
      { amount: 1, currency: "USD" },
      client,
      memory
    )) as { success: boolean; error: string }

    // Assert
    expect(result.success).toBe(false)
    expect(result.error).toContain("Withdrawals must be at least $5.00 USD")
    expect(mocks.withdrawToPaymentMethod).not.toHaveBeenCalled()
  })

  it("rejects an over-limit withdrawal with the remaining limit and never submits", async () => {
    // Arrange
    const { client, mocks } = makeClient({
      checkWithdrawalLimits: jest.fn().mockResolvedValue({
        meetsMinimum: true,
        isUnderLimit: false,
        minimumAmountCents: 500,
        remainingUsdCents: 1000,
      }),
    })

    // Act
    const result = (await executeTool(
      "blaze_withdraw",
      { amount: 25, currency: "USD" },
      client,
      memory
    )) as { success: boolean; error: string }

    // Assert
    expect(result.success).toBe(false)
    expect(result.error).toContain("over your current withdrawal limit")
    expect(result.error).toContain("$10.00 USD")
    expect(mocks.withdrawToPaymentMethod).not.toHaveBeenCalled()
  })

  it("submits the withdrawal when the limit check itself throws", async () => {
    // Arrange — a thrown limit check is best-effort; the server enforces on submit.
    const { client, mocks } = makeClient({
      checkWithdrawalLimits: jest
        .fn()
        .mockRejectedValue(new Error("limits unavailable")),
    })

    // Act
    const result = (await executeTool(
      "blaze_withdraw",
      { amount: 25, currency: "USD" },
      client,
      memory
    )) as { success: boolean }

    // Assert
    expect(result.success).toBe(true)
    expect(mocks.withdrawToPaymentMethod).toHaveBeenCalled()
  })

  it("defaults instantTransfer to true for a card method", async () => {
    // Arrange
    const { client, mocks } = makeClient({
      listConnectedPaymentMethods: jest.fn().mockResolvedValue({
        methods: [{ id: "pm_card", type: "Card", canWithdraw: true }],
        defaultWithdrawalMethodId: "pm_card",
      }),
    })

    // Act
    await executeTool("blaze_withdraw", { amount: 25 }, client, memory)

    // Assert
    expect(mocks.withdrawToPaymentMethod).toHaveBeenCalledWith(
      expect.objectContaining({ instantTransfer: true })
    )
  })

  it("rejects a withdrawal when the balance is below the usdc amount", async () => {
    // Arrange
    const { client, mocks } = makeClient({
      getBalance: jest.fn().mockResolvedValue({ available: 100, pending: 0 }),
    })

    // Act
    const result = (await executeTool(
      "blaze_withdraw",
      { amount: 25, currency: "USD" },
      client,
      memory
    )) as { success: boolean; error: string }

    // Assert
    expect(result.success).toBe(false)
    expect(result.error).toContain(
      "You don't have enough balance for this withdrawal"
    )
    expect(mocks.withdrawToPaymentMethod).not.toHaveBeenCalled()
  })

  it("rejects a zero amount without moving money", async () => {
    // Arrange
    const { client, mocks } = makeClient()

    // Act
    const result = (await executeTool(
      "blaze_withdraw",
      { amount: 0, currency: "USD" },
      client,
      memory
    )) as { success: boolean; error: string }

    // Assert
    expect(result.success).toBe(false)
    expect(result.error).toBe("Amount must be greater than zero.")
    expect(mocks.withdrawToPaymentMethod).not.toHaveBeenCalled()
  })

  it("rejects an unsupported currency without moving money", async () => {
    // Arrange
    const { client, mocks } = makeClient()

    // Act
    const result = (await executeTool(
      "blaze_withdraw",
      { amount: 25, currency: "JPY" },
      client,
      memory
    )) as { success: boolean; error: string }

    // Assert
    expect(result.success).toBe(false)
    expect(result.error).toContain("aren't supported yet")
    expect(mocks.withdrawToPaymentMethod).not.toHaveBeenCalled()
  })

  it("rejects an amount above the per-transaction cap", async () => {
    // Arrange — above the Int max ($21,474,836.47) in major units.
    const { client, mocks } = makeClient()

    // Act
    const result = (await executeTool(
      "blaze_withdraw",
      { amount: 21_474_837, currency: "USD" },
      client,
      memory
    )) as { success: boolean; error: string }

    // Assert
    expect(result.success).toBe(false)
    expect(result.error).toContain("too large")
    expect(mocks.withdrawToPaymentMethod).not.toHaveBeenCalled()
  })

  it("rejects an ineligible payment method id with a humanized reason", async () => {
    // Arrange — id exists in the full list but isn't withdrawal-eligible.
    const { client, mocks } = makeClient({
      listConnectedPaymentMethods: jest.fn().mockResolvedValue({
        methods: [
          { id: "pm_1", type: "Bank", canWithdraw: true },
          {
            id: "pm_credit",
            type: "Card",
            displayName: "Amex",
            canWithdraw: false,
            withdrawIneligibilityReason: "CREDIT_CARD",
          },
        ],
        defaultWithdrawalMethodId: "pm_1",
      }),
    })

    // Act
    const result = (await executeTool(
      "blaze_withdraw",
      { amount: 25, currency: "USD", payment_method_id: "pm_credit" },
      client,
      memory
    )) as { success: boolean; error: string }

    // Assert
    expect(result.success).toBe(false)
    expect(result.error).toContain("credit cards can't receive withdrawals")
    expect(mocks.withdrawToPaymentMethod).not.toHaveBeenCalled()
  })

  it("rejects a withdrawal in business context without moving money", async () => {
    // Arrange — an API-key (business) session can't withdraw to a personal method.
    const { client, mocks } = makeClient()
    ;(client as unknown as { authContext: string }).authContext = "business"

    // Act
    const result = (await executeTool(
      "blaze_withdraw",
      { amount: 25, currency: "USD" },
      client,
      memory
    )) as { success: boolean; error: string }

    // Assert
    expect(result.success).toBe(false)
    expect(result.error).toContain("personal session")
    expect(mocks.withdrawToPaymentMethod).not.toHaveBeenCalled()
  })

  it("requires a payment_method_id when multiple eligible methods exist", async () => {
    // Arrange
    const { client, mocks } = makeClient({
      listConnectedPaymentMethods: jest.fn().mockResolvedValue({
        methods: [
          { id: "pm_1", type: "Bank", canWithdraw: true },
          { id: "pm_2", type: "Card", canWithdraw: true },
        ],
        defaultWithdrawalMethodId: "pm_1",
      }),
    })

    // Act
    const result = (await executeTool(
      "blaze_withdraw",
      { amount: 25, currency: "USD" },
      client,
      memory
    )) as { success: boolean; error: string }

    // Assert
    expect(result.success).toBe(false)
    expect(result.error).toContain("which one")
    expect(mocks.withdrawToPaymentMethod).not.toHaveBeenCalled()
  })

  it("returns the fee preview without moving money in blaze_estimate_withdrawal_fee", async () => {
    // Arrange
    const { client, mocks } = makeClient()

    // Act
    const result = (await executeTool(
      "blaze_estimate_withdrawal_fee",
      { payment_method_id: "pm_1", amount: 25, currency: "USD" },
      client,
      memory
    )) as {
      success: boolean
      feeUsd: string
      totalDebitedUsdc: string
      displayName: string
    }

    // Assert
    expect(result.success).toBe(true)
    expect(result.feeUsd).toBe("$2.00")
    expect(result.totalDebitedUsdc).toBe("$27.00")
    expect(result.displayName).toBe("Card Withdrawal Fee")
    expect(mocks.withdrawToPaymentMethod).not.toHaveBeenCalled()
  })

  it("rejects estimating a fee for an ineligible method", async () => {
    // Arrange
    const { client, mocks } = makeClient({
      listConnectedPaymentMethods: jest.fn().mockResolvedValue({
        methods: [{ id: "pm_2", type: "Card", canWithdraw: false }],
        defaultWithdrawalMethodId: null,
        countryCode: "US",
      }),
    })

    // Act
    const result = (await executeTool(
      "blaze_estimate_withdrawal_fee",
      { payment_method_id: "pm_2", amount: 25, currency: "USD" },
      client,
      memory
    )) as { success: boolean; error: string }

    // Assert
    expect(result.success).toBe(false)
    expect(result.error).toContain(
      "not one of your withdrawal-eligible methods"
    )
    expect(mocks.getApplicableWithdrawalFee).not.toHaveBeenCalled()
  })
})
