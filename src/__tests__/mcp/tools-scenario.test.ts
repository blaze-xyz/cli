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

/**
 * Minimal recording stub of McpServer that captures every tool registration.
 * The handler is always the last argument passed to server.tool(...).
 */
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

describe("MCP tool registry — blaze_cfo_scenario", () => {
  let tools: RegisteredTool[]
  let client: BlazeClient & { modelScenario: jest.Mock }

  beforeEach(() => {
    const recording = createRecordingServer()
    client = {
      modelScenario: jest
        .fn()
        .mockResolvedValue({ name: "Hire 2 engineers", runwayMonths: 6 }),
    } as unknown as BlazeClient & { modelScenario: jest.Mock }
    registerTools(recording.server, client)
    tools = recording.tools
  })

  it("registers the blaze_cfo_scenario tool", () => {
    const scenario = tools.find(t => t.name === "blaze_cfo_scenario")
    expect(scenario).toBeDefined()
    expect(scenario?.description.toLowerCase()).toContain("scenario")
  })

  it("routes blaze_cfo_scenario to client.modelScenario with the params", async () => {
    const scenario = tools.find(t => t.name === "blaze_cfo_scenario")!
    const params = {
      name: "Hire 2 engineers",
      adjustments: [],
      horizon_days: 90,
    }

    const result = await scenario.handler(params)

    expect(client.modelScenario).toHaveBeenCalledWith(params)
    expect(result.isError).toBeUndefined()
    expect(result.content[0].type).toBe("text")
  })

  it("returns an isError result when client.modelScenario throws", async () => {
    const scenario = tools.find(t => t.name === "blaze_cfo_scenario")!
    client.modelScenario.mockRejectedValueOnce(new Error("boom"))

    const result = await scenario.handler({ name: "x", adjustments: [] })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain("boom")
  })
})
