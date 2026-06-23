import { registerTools } from "../../mcp/tools"
import type { BlazeClient } from "../../sdk/client"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

interface RegisteredTool {
  name: string
  description: string
  handler: (params: Record<string, unknown>) => Promise<{
    isError?: boolean
    content: { type: string; text: string }[]
  }>
}

function createRecordingServer(): {
  server: McpServer
  tools: RegisteredTool[]
} {
  const tools: RegisteredTool[] = []
  const server = {
    tool: (...args: unknown[]) => {
      const name = args[0] as string
      const description = args[1] as string
      const handler = args[args.length - 1] as RegisteredTool["handler"]
      tools.push({ name, description, handler })
    },
  } as unknown as McpServer
  return { server, tools }
}

function jsonOf(result: { content: { text: string }[] }): unknown {
  return JSON.parse(result.content[0].text)
}

describe("MCP consumer withdrawal tools", () => {
  let tools: RegisteredTool[]
  let listConnectedPaymentMethods: jest.Mock
  let withdrawToPaymentMethod: jest.Mock
  let getBalance: jest.Mock
  let checkWithdrawalLimits: jest.Mock
  let getRampTransfer: jest.Mock
  let getApplicableWithdrawalFee: jest.Mock

  // Rebuilds the recording server + tools against a fresh client. Lets a test
  // override authContext (e.g. business) before the tools capture the client.
  function buildTools(clientOverrides: Record<string, unknown> = {}): void {
    const client = {
      authContext: "consumer",
      listConnectedPaymentMethods,
      withdrawToPaymentMethod,
      getBalance,
      checkWithdrawalLimits,
      getRampTransfer,
      getApplicableWithdrawalFee,
      ...clientOverrides,
    } as unknown as BlazeClient
    const recording = createRecordingServer()
    registerTools(recording.server, client)
    tools = recording.tools
  }

  beforeEach(() => {
    listConnectedPaymentMethods = jest.fn().mockResolvedValue({
      methods: [
        { id: "pm_1", type: "Bank", canWithdraw: true },
        { id: "pm_2", type: "Card", canWithdraw: false },
      ],
      defaultWithdrawalMethodId: "pm_1",
    })
    withdrawToPaymentMethod = jest
      .fn()
      .mockResolvedValue({ status: "PENDING", rampTransferId: "rt_1" })
    getBalance = jest.fn().mockResolvedValue({ available: 100000, pending: 0 })
    // Default to a passing limit check and a fee-less transfer so the happy
    // path runs unless a test overrides these.
    checkWithdrawalLimits = jest.fn().mockResolvedValue({
      meetsMinimum: true,
      isUnderLimit: true,
      minimumAmountCents: 500,
    })
    getRampTransfer = jest
      .fn()
      .mockResolvedValue({ id: "rt_1", feeCollections: [] })
    getApplicableWithdrawalFee = jest.fn().mockResolvedValue({
      totalFeeCents: 200,
      displayName: "Card Withdrawal Fee",
      flatFeeCents: 0,
      percentageFeeCents: 0,
      percentageRate: 0.02,
      minFeeCents: 200,
      configId: "c",
    })
    buildTools()
  })

  it("registers the list, withdraw, and estimate-fee tools", () => {
    const names = tools.map(t => t.name)
    expect(names).toContain("blaze_list_connected_payment_methods")
    expect(names).toContain("blaze_withdraw_to_payment_method")
    expect(names).toContain("blaze_estimate_withdrawal_fee")
  })

  it("filters to canWithdraw methods by default in the list handler", async () => {
    const tool = tools.find(
      t => t.name === "blaze_list_connected_payment_methods"
    )!

    const result = await tool.handler({})

    const payload = jsonOf(result) as {
      methods: { id: string }[]
      defaultWithdrawalMethodId: string
    }
    expect(payload.methods).toEqual([
      { id: "pm_1", type: "Bank", canWithdraw: true },
    ])
    expect(payload.defaultWithdrawalMethodId).toBe("pm_1")
  })

  it("includes ineligible methods when all is true", async () => {
    const tool = tools.find(
      t => t.name === "blaze_list_connected_payment_methods"
    )!

    const result = await tool.handler({ all: true })

    const payload = jsonOf(result) as { methods: { id: string }[] }
    expect(payload.methods).toHaveLength(2)
  })

  it("calls withdrawToPaymentMethod with equal usdc/fiat cents for a USD withdrawal", async () => {
    const tool = tools.find(t => t.name === "blaze_withdraw_to_payment_method")!

    const result = await tool.handler({
      payment_method_id: "pm_1",
      amount: 25,
      currency: "USD",
      confirm: true,
    })

    expect(withdrawToPaymentMethod).toHaveBeenCalledWith({
      paymentMethodId: "pm_1",
      usdcAmountInCents: 2500,
      fiatAmountInCents: 2500,
      currencyCode: "USD",
      instantTransfer: false,
    })
    const payload = jsonOf(result) as {
      status: string
      estimatedArrival: string
    }
    expect(payload.status).toBe("PENDING")
    expect(payload.estimatedArrival).toBe(
      "It usually arrives in 1–2 business days."
    )
  })

  it("reports an instant arrival estimate when instant_transfer is true", async () => {
    const tool = tools.find(t => t.name === "blaze_withdraw_to_payment_method")!

    const result = await tool.handler({
      payment_method_id: "pm_1",
      amount: 25,
      currency: "USD",
      instant_transfer: true,
      confirm: true,
    })

    const payload = jsonOf(result) as { estimatedArrival: string }
    expect(payload.estimatedArrival).toBe(
      "It should land within a few minutes."
    )
  })

  it("calls withdrawToPaymentMethod with FX-derived usdc cents for a non-USD withdrawal", async () => {
    const tool = tools.find(t => t.name === "blaze_withdraw_to_payment_method")!

    // MXN rate is 17.15 → 100 MXN ≈ $5.83 USD → round(5.83... * 100) = 583.
    await tool.handler({
      payment_method_id: "pm_1",
      amount: 100,
      currency: "MXN",
      confirm: true,
    })

    expect(withdrawToPaymentMethod).toHaveBeenCalledWith({
      paymentMethodId: "pm_1",
      usdcAmountInCents: 583,
      fiatAmountInCents: 10000,
      currencyCode: "MXN",
      instantTransfer: false,
    })
  })

  it("returns an isError result when the withdrawal client throws", async () => {
    const tool = tools.find(t => t.name === "blaze_withdraw_to_payment_method")!
    withdrawToPaymentMethod.mockRejectedValueOnce(
      new Error("Daily withdrawal limit exceeded")
    )

    const result = await tool.handler({
      payment_method_id: "pm_1",
      amount: 25,
      confirm: true,
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain("Daily withdrawal limit exceeded")
  })

  it("includes the real fee in the success result", async () => {
    getRampTransfer.mockResolvedValueOnce({
      id: "rt_1",
      feeCollections: [{ amountCents: 200 }],
    })
    const tool = tools.find(t => t.name === "blaze_withdraw_to_payment_method")!

    const result = await tool.handler({
      payment_method_id: "pm_1",
      amount: 25,
      currency: "USD",
      confirm: true,
    })

    const payload = jsonOf(result) as { fee: string; status: string }
    expect(payload.status).toBe("PENDING")
    expect(payload.fee).toBe("$2.00")
  })

  it("rejects a below-minimum withdrawal with the server minimum and never submits", async () => {
    // Arrange
    checkWithdrawalLimits.mockResolvedValueOnce({
      meetsMinimum: false,
      isUnderLimit: true,
      minimumAmountCents: 500,
    })
    const tool = tools.find(t => t.name === "blaze_withdraw_to_payment_method")!

    // Act
    const result = await tool.handler({
      payment_method_id: "pm_1",
      amount: 1,
      currency: "USD",
      confirm: true,
    })

    // Assert
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain(
      "Withdrawals must be at least $5.00 USD"
    )
    expect(withdrawToPaymentMethod).not.toHaveBeenCalled()
  })

  it("rejects an over-limit withdrawal with the remaining limit and never submits", async () => {
    // Arrange
    checkWithdrawalLimits.mockResolvedValueOnce({
      meetsMinimum: true,
      isUnderLimit: false,
      minimumAmountCents: 500,
      remainingUsdCents: 1000,
    })
    const tool = tools.find(t => t.name === "blaze_withdraw_to_payment_method")!

    // Act
    const result = await tool.handler({
      payment_method_id: "pm_1",
      amount: 25,
      currency: "USD",
      confirm: true,
    })

    // Assert
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain(
      "over your current withdrawal limit"
    )
    expect(result.content[0].text).toContain("$10.00 USD")
    expect(withdrawToPaymentMethod).not.toHaveBeenCalled()
  })

  it("rejects a withdrawal in business context without moving money", async () => {
    // Arrange — an API-key (business) session can't withdraw to a personal method.
    buildTools({ authContext: "business" })
    const tool = tools.find(t => t.name === "blaze_withdraw_to_payment_method")!

    // Act
    const result = await tool.handler({
      payment_method_id: "pm_1",
      amount: 25,
      confirm: true,
    })

    // Assert
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain("personal session")
    expect(withdrawToPaymentMethod).not.toHaveBeenCalled()
  })

  it("rejects an ineligible payment method with a humanized reason", async () => {
    // Arrange
    listConnectedPaymentMethods.mockResolvedValueOnce({
      methods: [
        {
          id: "pm_credit",
          type: "Card",
          canWithdraw: false,
          withdrawIneligibilityReason: "CREDIT_CARD",
        },
      ],
      defaultWithdrawalMethodId: null,
    })
    const tool = tools.find(t => t.name === "blaze_withdraw_to_payment_method")!

    // Act
    const result = await tool.handler({
      payment_method_id: "pm_credit",
      amount: 25,
      confirm: true,
    })

    // Assert
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain(
      "credit cards can't receive withdrawals"
    )
    expect(withdrawToPaymentMethod).not.toHaveBeenCalled()
  })

  it("rejects an unknown payment method id", async () => {
    // Arrange
    const tool = tools.find(t => t.name === "blaze_withdraw_to_payment_method")!

    // Act
    const result = await tool.handler({
      payment_method_id: "pm_missing",
      amount: 25,
      confirm: true,
    })

    // Assert
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain(
      "not one of your connected methods"
    )
    expect(withdrawToPaymentMethod).not.toHaveBeenCalled()
  })

  it("rejects a withdrawal when the balance is below the usdc amount", async () => {
    // Arrange
    getBalance.mockResolvedValueOnce({ available: 100, pending: 0 })
    const tool = tools.find(t => t.name === "blaze_withdraw_to_payment_method")!

    // Act
    const result = await tool.handler({
      payment_method_id: "pm_1",
      amount: 25,
      currency: "USD",
      confirm: true,
    })

    // Assert
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain(
      "You don't have enough balance for this withdrawal"
    )
    expect(withdrawToPaymentMethod).not.toHaveBeenCalled()
  })

  it("rejects an unsupported currency without moving money", async () => {
    // Arrange
    const tool = tools.find(t => t.name === "blaze_withdraw_to_payment_method")!

    // Act
    const result = await tool.handler({
      payment_method_id: "pm_1",
      amount: 25,
      currency: "JPY",
      confirm: true,
    })

    // Assert
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain("aren't supported yet")
    expect(withdrawToPaymentMethod).not.toHaveBeenCalled()
  })

  it("lists eligible connected methods in the default consumer context", async () => {
    // The MCP list tool returns withdrawal-eligible methods in consumer context.
    const tool = tools.find(
      t => t.name === "blaze_list_connected_payment_methods"
    )!

    const result = await tool.handler({})

    const payload = jsonOf(result) as { methods: { id: string }[] }
    expect(payload.methods).toHaveLength(1)
  })

  it("returns the fee preview without moving money in blaze_estimate_withdrawal_fee", async () => {
    // Arrange
    const tool = tools.find(t => t.name === "blaze_estimate_withdrawal_fee")!

    // Act
    const result = await tool.handler({
      payment_method_id: "pm_1",
      amount: 25,
      currency: "USD",
    })

    // Assert
    const payload = jsonOf(result) as {
      feeUsd: string
      totalDebitedUsdc: string
      displayName: string
    }
    expect(payload.feeUsd).toBe("$2.00")
    expect(payload.totalDebitedUsdc).toBe("$27.00")
    expect(payload.displayName).toBe("Card Withdrawal Fee")
    expect(withdrawToPaymentMethod).not.toHaveBeenCalled()
  })

  it("rejects estimating a fee for an ineligible method", async () => {
    // Arrange
    const tool = tools.find(t => t.name === "blaze_estimate_withdrawal_fee")!

    // Act
    const result = await tool.handler({
      payment_method_id: "pm_2",
      amount: 25,
      currency: "USD",
    })

    // Assert
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain(
      "not one of your withdrawal-eligible methods"
    )
    expect(getApplicableWithdrawalFee).not.toHaveBeenCalled()
  })
})
