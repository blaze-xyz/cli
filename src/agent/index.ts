import type Anthropic from "@anthropic-ai/sdk"
import { BlazeClient } from "../sdk/client"
import { translateError } from "../sdk/errors"
import { createClient, getDefaultModel } from "./llm-provider"
import { MemoryStore } from "./memory"
import { buildSystemPrompt } from "./system-prompt"
import { buildTools, executeTool } from "./tools"
import { ToolCallGuard } from "./tool-guard"

// ============================================
// Loop bounds — defense against adversarial inputs that try to pin the
// agent loop (e.g. invoice text instructing repeated retries). See
// docs/projects/bills-ap-automation/agent-flow.md §6 layer 7.
// ============================================
const MAX_TURNS = 20
const MAX_TOOL_CALLS = 50
const MAX_INPUT_TOKENS = 100_000

type LoopBoundReason = "max_turns" | "max_tool_calls" | "max_input_tokens"

/**
 * Builds the user-facing message printed when the agent loop hits a ceiling.
 * Direct, no apologies, tells the user what to do next.
 */
export function buildLoopBoundMessage(reason: LoopBoundReason): string {
  switch (reason) {
    case "max_turns":
      return "I couldn't finish this in one go — it needed more steps than I'm allowed per request (turn limit). Here's what I completed so far. Break it into smaller requests to continue."
    case "max_tool_calls":
      return "I couldn't finish this in one go — it needed more actions than I'm allowed per request (tool-call limit). Here's what I completed so far. Break it into smaller requests to continue."
    case "max_input_tokens":
      return "I couldn't finish this in one go — this request grew too large to keep going (context limit). Here's what I completed so far. Break it into smaller requests to continue."
  }
}

export interface RunAgentOptions {
  maxTurns?: number
  maxToolCalls?: number
}

export async function runAgent(
  userInput: string,
  client: BlazeClient,
  opts?: RunAgentOptions
): Promise<void> {
  const maxTurns = opts?.maxTurns ?? MAX_TURNS
  const maxToolCalls = opts?.maxToolCalls ?? MAX_TOOL_CALLS

  const anthropic = createClient()
  const memory = new MemoryStore()
  const model = getDefaultModel()
  const tools = buildTools(client, memory)
  const systemPrompt = buildSystemPrompt(client.authContext)

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userInput },
  ]

  let turns = 0
  let toolCalls = 0
  let cumulativeInputTokens = 0

  const guard = new ToolCallGuard()

  // Agentic loop with bounds
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (turns >= maxTurns) {
      process.stdout.write(`\n${buildLoopBoundMessage("max_turns")}\n`)
      process.stderr.write(
        `\n[agent] Hit MAX_TURNS=${maxTurns}. Stopping. If this was a long task, split it up.\n`
      )
      return
    }
    if (toolCalls >= maxToolCalls) {
      process.stdout.write(`\n${buildLoopBoundMessage("max_tool_calls")}\n`)
      process.stderr.write(
        `\n[agent] Hit MAX_TOOL_CALLS=${maxToolCalls}. Stopping.\n`
      )
      return
    }
    if (cumulativeInputTokens >= MAX_INPUT_TOKENS) {
      process.stdout.write(`\n${buildLoopBoundMessage("max_input_tokens")}\n`)
      process.stderr.write(
        `\n[agent] Hit MAX_INPUT_TOKENS=${MAX_INPUT_TOKENS}. Stopping.\n`
      )
      return
    }

    turns++
    const response = await anthropic.messages.create({
      model,
      system: systemPrompt,
      messages,
      tools,
      max_tokens: 4096,
    })

    cumulativeInputTokens += response.usage?.input_tokens ?? 0

    // Print text blocks as they arrive
    for (const block of response.content) {
      if (block.type === "text") {
        process.stdout.write(block.text)
      }
    }

    if (response.stop_reason === "end_turn") {
      process.stdout.write("\n")
      break
    }

    if (response.stop_reason === "tool_use") {
      const toolResults: Anthropic.ToolResultBlockParam[] = []

      for (const block of response.content) {
        if (block.type === "tool_use") {
          toolCalls++
          if (toolCalls > maxToolCalls) break
          const shortCircuit = guard.shortCircuit(block.name)
          if (shortCircuit) {
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify(shortCircuit),
              is_error: true,
            })
            continue
          }
          try {
            const result = await executeTool(
              block.name,
              block.input as Record<string, unknown>,
              client,
              memory
            )
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify(result),
            })
          } catch (err) {
            guard.recordError(block.name, err)
            const t = translateError(err)
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify({
                kind: t.kind,
                retryable: t.retryable,
                hint: t.hint,
                error: t.message,
              }),
              is_error: true,
            })
          }
        }
      }

      messages.push({ role: "assistant", content: response.content })
      messages.push({ role: "user", content: toolResults })
    }
  }
}
