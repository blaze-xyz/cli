#!/usr/bin/env ts-node
/**
 * Agent NLP tool-call tracer.
 *
 * Replays the same agentic loop as src/agent/index.ts:runAgent, but records a
 * full step-by-step trace — per turn: the model's reasoning, every tool call
 * (name + params), each tool result (or error), and the final answer — then
 * writes it to a markdown artifact for review.
 *
 * Usage:
 *   BLAZE_TEST_API_KEY=... BLAZE_TEST_BASE_URL=http://localhost:3001 \
 *   ANTHROPIC_API_KEY=... \
 *   node_modules/.bin/ts-node scripts/trace-agent.ts ["prompt one" "prompt two" ...]
 *
 * With no prompt args, traces a default representative set.
 */
import * as fs from "fs"
import * as path from "path"
import type Anthropic from "@anthropic-ai/sdk"
import { createClient, getDefaultModel } from "../src/agent/llm-provider"
import { buildSystemPrompt } from "../src/agent/system-prompt"
import { buildTools, executeTool } from "../src/agent/tools"
import { MemoryStore } from "../src/agent/memory"
import { BlazeClient } from "../src/sdk/client"

const MAX_TURNS = 12
const MAX_TOOL_CALLS = 30

function truncate(s: string, n = 1100): string {
  return s.length > n
    ? `${s.slice(0, n)}… [truncated ${s.length - n} chars]`
    : s
}

async function tracePrompt(
  prompt: string,
  client: BlazeClient
): Promise<string> {
  const anthropic = createClient()
  const memory = new MemoryStore()
  const model = getDefaultModel()
  const tools = buildTools(client, memory)
  const systemPrompt = buildSystemPrompt()

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: prompt }]
  const lines: string[] = [`## Prompt: \`${prompt}\``]
  const sequence: string[] = []
  let turns = 0
  let toolCalls = 0

  while (turns < MAX_TURNS && toolCalls < MAX_TOOL_CALLS) {
    turns++
    const response = await anthropic.messages.create({
      model,
      system: systemPrompt,
      messages,
      tools,
      max_tokens: 4096,
    })

    lines.push(`\n### Turn ${turns} — stop_reason: \`${response.stop_reason}\``)

    const reasoning = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map(b => b.text)
      .join("\n")
      .trim()
    if (reasoning) {
      lines.push(`\n**Reasoning / response:**\n`)
      lines.push(`> ${truncate(reasoning).replace(/\n/g, "\n> ")}`)
    }

    if (response.stop_reason === "end_turn") {
      lines.push(`\n**→ Final answer reached.**`)
      break
    }

    if (response.stop_reason === "tool_use") {
      const toolResults: Anthropic.ToolResultBlockParam[] = []
      const toolUses = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      )
      for (const block of toolUses) {
        toolCalls++
        sequence.push(block.name)
        lines.push(`\n**🛠 Tool call #${toolCalls}: \`${block.name}\`**`)
        lines.push(
          "```json\n" +
            truncate(JSON.stringify(block.input, null, 2), 700) +
            "\n```"
        )
        try {
          const result = await executeTool(
            block.name,
            block.input as Record<string, unknown>,
            client,
            memory
          )
          lines.push(`**→ result:**`)
          lines.push(
            "```json\n" +
              truncate(JSON.stringify(result, null, 2), 900) +
              "\n```"
          )
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(result),
          })
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          lines.push(`**→ ❌ ERROR:** \`${truncate(msg, 400)}\``)
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify({ error: msg }),
            is_error: true,
          })
        }
      }
      messages.push({ role: "assistant", content: response.content })
      messages.push({ role: "user", content: toolResults })
    }
  }

  lines.push(
    `\n**Summary:** ${turns} turn(s), ${toolCalls} tool call(s) — sequence: ${
      sequence.length ? sequence.map(s => `\`${s}\``).join(" → ") : "_(none)_"
    }`
  )
  lines.push("\n---")
  return lines.join("\n")
}

async function main(): Promise<void> {
  const apiKey = process.env.BLAZE_TEST_API_KEY
  const baseUrl = process.env.BLAZE_TEST_BASE_URL ?? "https://api.blaze.money"
  if (!apiKey) {
    console.error("BLAZE_TEST_API_KEY not set")
    process.exit(1)
  }
  const client = new BlazeClient({ apiKey, baseUrl })

  const argPrompts = process.argv.slice(2).filter(a => !a.startsWith("--"))
  const defaults = [
    "What's my balance?",
    "Send 1000 MXN to @carlos",
    "How much did we spend on software last quarter?",
    "Pay the Notion bill",
  ]
  const prompts = argPrompts.length ? argPrompts : defaults

  const out: string[] = [
    "# Agent NLP — Tool-Call Trace",
    "",
    `**Generated:** ${new Date().toISOString()}`,
    `**Model:** ${getDefaultModel()}`,
    `**Base URL:** ${baseUrl}`,
    `**Prompts traced:** ${prompts.length}`,
    "",
    "Each prompt below shows the agent's turn-by-turn loop: the model's reasoning, every tool call (name + parameters), the tool result (or error), and the final answer.",
    "",
    "---",
  ]

  for (const p of prompts) {
    process.stderr.write(`tracing: ${p}\n`)
    out.push(await tracePrompt(p, client))
  }

  const outPath = path.join(
    __dirname,
    "..",
    "test-results",
    `agent-nlp-trace-${new Date().toISOString().slice(0, 10)}.md`
  )
  fs.writeFileSync(outPath, out.join("\n"))
  console.log(`\nTrace written: ${outPath}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
