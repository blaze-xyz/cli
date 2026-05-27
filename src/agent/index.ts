import type Anthropic from "@anthropic-ai/sdk"
import { BlazeClient } from "../sdk/client"
import { createClient, getDefaultModel } from "./llm-provider"
import { MemoryStore } from "./memory"
import { buildSystemPrompt } from "./system-prompt"
import { buildTools, executeTool } from "./tools"

// ============================================
// Loop bounds — defense against adversarial inputs that try to pin the
// agent loop (e.g. invoice text instructing repeated retries). See
// docs/projects/bills-ap-automation/agent-flow.md §6 layer 7.
// ============================================
const MAX_TURNS = 20
const MAX_TOOL_CALLS = 50
const MAX_INPUT_TOKENS = 100_000

export async function runAgent(
  userInput: string,
  client: BlazeClient
): Promise<void> {
  const anthropic = createClient()
  const memory = new MemoryStore()
  const model = getDefaultModel()
  const tools = buildTools(client, memory)
  const systemPrompt = buildSystemPrompt()

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userInput },
  ]

  let turns = 0
  let toolCalls = 0
  let cumulativeInputTokens = 0

  // Agentic loop with bounds
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (turns >= MAX_TURNS) {
      process.stderr.write(
        `\n[agent] Hit MAX_TURNS=${MAX_TURNS}. Stopping. If this was a long task, split it up.\n`
      )
      return
    }
    if (toolCalls >= MAX_TOOL_CALLS) {
      process.stderr.write(
        `\n[agent] Hit MAX_TOOL_CALLS=${MAX_TOOL_CALLS}. Stopping.\n`
      )
      return
    }
    if (cumulativeInputTokens >= MAX_INPUT_TOKENS) {
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
          if (toolCalls > MAX_TOOL_CALLS) break
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
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify({
                error: err instanceof Error ? err.message : String(err),
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
