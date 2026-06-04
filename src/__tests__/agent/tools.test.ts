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
