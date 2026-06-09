import type { BlazeClient } from "../../sdk/client"
import type { MemoryStore } from "../../agent/memory"
import { buildTools, executeTool } from "../../agent/tools"

describe("agent tool registry — blaze_cfo_scenario", () => {
  let mockClient: { modelScenario: jest.Mock }
  let memory: MemoryStore

  beforeEach(() => {
    mockClient = {
      modelScenario: jest.fn().mockResolvedValue({ runwayMonths: 6 }),
    }
    memory = {} as MemoryStore
  })

  it("register a tool named blaze_cfo_scenario with name, adjustments, and horizon_days inputs", () => {
    // Arrange
    const client = mockClient as unknown as BlazeClient

    // Act
    const tools = buildTools(client, memory)

    // Assert
    const scenarioTool = tools.find(t => t.name === "blaze_cfo_scenario")
    expect(scenarioTool).toBeDefined()
    expect(scenarioTool?.input_schema.properties).toHaveProperty("name")
    expect(scenarioTool?.input_schema.properties).toHaveProperty("adjustments")
    expect(scenarioTool?.input_schema.properties).toHaveProperty("horizon_days")
  })

  it("delegate execution to client.modelScenario defaulting adjustments to [] and horizon_days to 90", async () => {
    // Arrange
    const client = mockClient as unknown as BlazeClient

    // Act
    await executeTool(
      "blaze_cfo_scenario",
      { name: "Hire 2 engineers" },
      client,
      memory
    )

    // Assert
    expect(mockClient.modelScenario).toHaveBeenCalledWith({
      name: "Hire 2 engineers",
      adjustments: [],
      horizon_days: 90,
    })
  })

  it("delegate execution passing through adjustments and an explicit horizon_days", async () => {
    // Arrange
    const client = mockClient as unknown as BlazeClient
    const adjustments = [
      {
        type: "new_recurring_expense",
        amount_cents: 2400000,
        frequency: "monthly",
      },
    ]

    // Act
    await executeTool(
      "blaze_cfo_scenario",
      { name: "Hire 2 engineers", adjustments, horizon_days: 60 },
      client,
      memory
    )

    // Assert
    expect(mockClient.modelScenario).toHaveBeenCalledWith({
      name: "Hire 2 engineers",
      adjustments,
      horizon_days: 60,
    })
  })
})
