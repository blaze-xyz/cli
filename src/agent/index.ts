import type Anthropic from "@anthropic-ai/sdk"
import { BlazeClient } from "../sdk/client"
import { createClient, getDefaultModel } from "./llm-provider"
import { MemoryStore } from "./memory"
import { buildSystemPrompt } from "./system-prompt"
import { buildTools, executeTool } from "./tools"

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

  // Agentic loop
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const response = await anthropic.messages.create({
      model,
      system: systemPrompt,
      messages,
      tools,
      max_tokens: 4096,
    })

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
