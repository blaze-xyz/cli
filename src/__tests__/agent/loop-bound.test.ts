import { runAgent } from "../../agent/index"
import { BlazeServerError } from "../../sdk/errors"
import * as llmProvider from "../../agent/llm-provider"
import * as tools from "../../agent/tools"
import type { BlazeClient } from "../../sdk/client"

// A canned tool_use response that keeps the agent loop running indefinitely.
const TOOL_USE_RESPONSE = {
  stop_reason: "tool_use",
  usage: { input_tokens: 10 },
  content: [
    {
      type: "tool_use",
      id: "toolu_1",
      name: "blaze_get_balance",
      input: {},
    },
  ],
}

function mockAnthropic(
  createImpl: (args: { messages: unknown[] }) => Promise<unknown>
): { messages: { create: jest.Mock } } {
  return { messages: { create: jest.fn().mockImplementation(createImpl) } }
}

function captureStdout(): { restore: () => void; output: () => string } {
  let buffer = ""
  const spy = jest
    .spyOn(process.stdout, "write")
    .mockImplementation((chunk: string | Uint8Array): boolean => {
      buffer += chunk.toString()
      return true
    })
  return {
    restore: () => spy.mockRestore(),
    output: () => buffer,
  }
}

const fakeClient = {} as BlazeClient

beforeEach(() => {
  jest.spyOn(process.stderr, "write").mockImplementation(() => true)
  jest.spyOn(tools, "buildTools").mockReturnValue([])
  jest.spyOn(tools, "executeTool").mockResolvedValue({ available: "100" })
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe("runAgent loop bounds", () => {
  it("writes the turn-limit message to stdout when maxTurns is reached", async () => {
    const anthropic = mockAnthropic(() => Promise.resolve(TOOL_USE_RESPONSE))
    jest.spyOn(llmProvider, "createClient").mockReturnValue(anthropic as never)
    const stdout = captureStdout()

    await runAgent("do a lot", fakeClient, { maxTurns: 1 })

    stdout.restore()
    expect(stdout.output()).toContain("turn limit")
  })

  it("writes the tool-call-limit message to stdout when maxToolCalls is reached", async () => {
    const anthropic = mockAnthropic(() => Promise.resolve(TOOL_USE_RESPONSE))
    jest.spyOn(llmProvider, "createClient").mockReturnValue(anthropic as never)
    const stdout = captureStdout()

    await runAgent("do a lot", fakeClient, { maxTurns: 5, maxToolCalls: 1 })

    stdout.restore()
    expect(stdout.output()).toContain("tool-call limit")
  })

  it("translates a thrown BlazeServerError into a structured tool_result", async () => {
    const captured: unknown[] = []
    let call = 0
    // First call: force a tool call (which throws). Second call: end the loop
    // so we can inspect the tool_result that was fed back in.
    const anthropic = mockAnthropic((args: { messages: unknown[] }) => {
      call++
      if (call === 1) {
        return Promise.resolve(TOOL_USE_RESPONSE)
      }
      captured.push(...args.messages)
      return Promise.resolve({
        stop_reason: "end_turn",
        usage: { input_tokens: 5 },
        content: [{ type: "text", text: "done" }],
      })
    })
    jest
      .spyOn(tools, "executeTool")
      .mockRejectedValue(new BlazeServerError("HTTP 500: Internal error", 500))
    jest.spyOn(llmProvider, "createClient").mockReturnValue(anthropic as never)
    captureStdout().restore()

    await runAgent("get my balance", fakeClient, { maxTurns: 5 })

    // Find the tool_result block that was fed back to the model.
    const toolResultMessage = captured.find(
      (m): m is { role: string; content: Array<{ type: string }> } =>
        typeof m === "object" &&
        m !== null &&
        (m as { role?: string }).role === "user" &&
        Array.isArray((m as { content?: unknown }).content)
    )
    expect(toolResultMessage).toBeDefined()
    const toolResult = toolResultMessage!.content.find(
      (b): b is { type: string; content: string; is_error?: boolean } =>
        b.type === "tool_result"
    )
    expect(toolResult).toBeDefined()
    const parsed = JSON.parse((toolResult as { content: string }).content) as {
      kind: string
      retryable: boolean
      hint: string
      error: string
    }
    expect(parsed.kind).toBe("server")
    expect(parsed.retryable).toBe(true)
    expect(parsed.error).not.toMatch(/HTTP/i)
  })
})
