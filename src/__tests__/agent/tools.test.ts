import type { BlazeClient } from "../../sdk/client"
import type { MemoryStore } from "../../agent/memory"
import { buildTools, executeTool } from "../../agent/tools"

describe("agent tool registry — blaze_cfo_forecast", () => {
  let mockClient: { getCashFlowForecast: jest.Mock }
  let memory: MemoryStore

  beforeEach(() => {
    mockClient = {
      getCashFlowForecast: jest.fn().mockResolvedValue({ runwayDays: 120 }),
    }
    memory = {} as MemoryStore
  })

  it("register a tool named blaze_cfo_forecast in the agent tool registry", () => {
    // Arrange
    const client = mockClient as unknown as BlazeClient

    // Act
    const tools = buildTools(client, memory)

    // Assert
    const forecastTool = tools.find(t => t.name === "blaze_cfo_forecast")
    expect(forecastTool).toBeDefined()
    expect(forecastTool?.input_schema.properties).toHaveProperty("horizon_days")
  })

  it("delegate execution to client.getCashFlowForecast with default horizon_days of 90", async () => {
    // Arrange
    const client = mockClient as unknown as BlazeClient

    // Act
    await executeTool("blaze_cfo_forecast", {}, client, memory)

    // Assert
    expect(mockClient.getCashFlowForecast).toHaveBeenCalledWith({
      horizon_days: 90,
    })
  })

  it("delegate execution to client.getCashFlowForecast with the passed horizon_days", async () => {
    // Arrange
    const client = mockClient as unknown as BlazeClient

    // Act
    await executeTool(
      "blaze_cfo_forecast",
      { horizon_days: 30 },
      client,
      memory
    )

    // Assert
    expect(mockClient.getCashFlowForecast).toHaveBeenCalledWith({
      horizon_days: 30,
    })
  })
})

describe("agent tool registry — blaze_cfo_reconcile", () => {
  let mockClient: { reconcileBankAccounts: jest.Mock }
  let memory: MemoryStore

  beforeEach(() => {
    mockClient = {
      reconcileBankAccounts: jest
        .fn()
        .mockResolvedValue({ reconciliationRate: 1 }),
    }
    memory = {} as MemoryStore
  })

  it("register a tool named blaze_cfo_reconcile in the agent tool registry", () => {
    // Arrange
    const client = mockClient as unknown as BlazeClient

    // Act
    const tools = buildTools(client, memory)

    // Assert
    const reconcileTool = tools.find(t => t.name === "blaze_cfo_reconcile")
    expect(reconcileTool).toBeDefined()
    expect(reconcileTool?.input_schema.properties).toHaveProperty(
      "period_start"
    )
    expect(reconcileTool?.input_schema.properties).toHaveProperty("period_end")
    expect(reconcileTool?.input_schema.required).toEqual([
      "period_start",
      "period_end",
    ])
  })

  it("delegate execution to client.reconcileBankAccounts with the period bounds", async () => {
    // Arrange
    const client = mockClient as unknown as BlazeClient

    // Act
    await executeTool(
      "blaze_cfo_reconcile",
      { period_start: "2025-01-01", period_end: "2025-01-31" },
      client,
      memory
    )

    // Assert
    expect(mockClient.reconcileBankAccounts).toHaveBeenCalledWith({
      period_start: "2025-01-01",
      period_end: "2025-01-31",
      account_id: undefined,
    })
  })

  it("delegate execution to client.reconcileBankAccounts with an account_id", async () => {
    // Arrange
    const client = mockClient as unknown as BlazeClient

    // Act
    await executeTool(
      "blaze_cfo_reconcile",
      {
        period_start: "2025-01-01",
        period_end: "2025-01-31",
        account_id: "acct_123",
      },
      client,
      memory
    )

    // Assert
    expect(mockClient.reconcileBankAccounts).toHaveBeenCalledWith({
      period_start: "2025-01-01",
      period_end: "2025-01-31",
      account_id: "acct_123",
    })
  })
})
