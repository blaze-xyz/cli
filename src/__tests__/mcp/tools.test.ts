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

/**
 * Mock BlazeClient where every method is a jest.fn resolving to a stub object.
 * Lets us invoke each registered tool handler without a real network client.
 */
function createMockClient(): BlazeClient {
  const cache = new Map<string, jest.Mock>()
  return new Proxy(
    {},
    {
      get: (_target, prop: string) => {
        if (!cache.has(prop)) {
          cache.set(
            prop,
            jest.fn().mockResolvedValue({ ok: true, method: prop })
          )
        }
        return cache.get(prop)
      },
    }
  ) as unknown as BlazeClient
}

describe("registerTools — MCP tool registry", () => {
  let tools: RegisteredTool[]
  let client: BlazeClient

  beforeEach(() => {
    const recording = createRecordingServer()
    client = createMockClient()
    registerTools(recording.server, client)
    tools = recording.tools
  })

  it("registers the blaze_cfo_forecast tool", () => {
    const forecast = tools.find(t => t.name === "blaze_cfo_forecast")
    expect(forecast).toBeDefined()
    expect(forecast?.description).toContain("cash flow forecast")
  })

  it("routes blaze_cfo_forecast to client.getCashFlowForecast with the params", async () => {
    const forecast = tools.find(t => t.name === "blaze_cfo_forecast")!

    const result = await forecast.handler({ horizon_days: 30 })

    expect(
      (client as unknown as { getCashFlowForecast: jest.Mock })
        .getCashFlowForecast
    ).toHaveBeenCalledWith({ horizon_days: 30 })
    expect(result.isError).toBeUndefined()
    expect(result.content[0].type).toBe("text")
  })

  it("serializes the forecast result as pretty JSON text", async () => {
    const forecast = tools.find(t => t.name === "blaze_cfo_forecast")!

    const result = await forecast.handler({})

    expect(JSON.parse(result.content[0].text)).toEqual({
      ok: true,
      method: "getCashFlowForecast",
    })
  })

  it("returns an isError result when the underlying client throws", async () => {
    const forecast = tools.find(t => t.name === "blaze_cfo_forecast")!
    ;(
      client as unknown as { getCashFlowForecast: jest.Mock }
    ).getCashFlowForecast.mockRejectedValueOnce(new Error("boom"))

    const result = await forecast.handler({})

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain("boom")
  })

  it("registers a non-trivial set of tools with unique names", () => {
    const names = tools.map(t => t.name)
    expect(names.length).toBeGreaterThan(40)
    expect(new Set(names).size).toBe(names.length)
  })

  it("invokes every registered tool handler without throwing", async () => {
    // Exercises each tool's handler body (param mapping + jsonResult wrapping)
    // against the mock client, covering the full registration surface.
    for (const tool of tools) {
      const result = await tool.handler({})
      expect(result.content[0].type).toBe("text")
    }
  })
})
