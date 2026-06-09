#!/usr/bin/env ts-node
/**
 * Agent NLP evaluation runner (hybrid: deterministic tool-call assertions + LLM judge).
 *
 * Replays the production agent loop via BlazeOrchestrator (reusing the real system
 * prompt, tool schemas, and executeTool — no mocking), capturing every tool call +
 * result per scenario. Each scenario is graded by:
 *   1) deterministic assertions over the trace (expected/forbidden tools, ordering,
 *      params) — the stable PASS/FAIL signal, and
 *   2) an LLM judge over the final answer vs the scenario's output traits.
 *
 * Writes a markdown report (test-results/agent-nlp-eval-<date>.md) and a JSON run
 * (test-results/eval-runs/) with auto run-over-run comparison. Exits non-zero on any
 * hard FAIL so it can gate CI / a /loop.
 *
 * Usage:
 *   BLAZE_TEST_API_KEY=... BLAZE_TEST_JWT=... BLAZE_TEST_READONLY_KEY=... \
 *   BLAZE_TEST_BASE_URL=http://localhost:3001 ANTHROPIC_API_KEY=... \
 *   ts-node eval/run-eval.ts [--tier D|L|A|S] [--context consumer|business|agnostic]
 *                            [--scenario <id>] [--consumer-only] [--business-only]
 *                            [--no-judge] [--strict-judge]
 */
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import type Anthropic from "@anthropic-ai/sdk"
import { BlazeOrchestrator } from "../src/agent/orchestrator"
import { createClient, getDefaultModel } from "../src/agent/llm-provider"
import { judgeAgentAnswer } from "./llm-judge"
import { EvalCollector, type Verdict } from "./eval-store"

const MAX_TURNS = 12
const MAX_TOOL_CALLS = 30
const SCENARIOS_FILE = path.resolve(__dirname, "agent-nlp-scenarios.json")
const REPORT_DIR = path.resolve(__dirname, "..", "test-results")

// --- types ---

interface ParamAssertion {
  tool: string
  path: string
  equals?: unknown
  gte?: number
  lte?: number
  matches?: string
  // Interpret the param value as a date string and bound how far from "now" it
  // may be. Catches stale relative-date reasoning (e.g. "last quarter" → 2025).
  max_days_ago?: number
  min_days_ago?: number
}

export interface ScenarioSpec {
  id: string
  tier: "Deterministic" | "Live" | "Agentic" | "Safety"
  context: "consumer" | "business" | "agnostic"
  prompt: string
  expected_tools: string[]
  /** At least one of these must be called (OR routing). */
  expected_any_tools?: string[]
  tool_order?: boolean
  forbidden_tools?: string[]
  param_assertions?: ParamAssertion[]
  expected_output_traits?: string[]
  forbidden_output_traits?: string[]
  /** Deterministic regexes the final answer must NOT match (e.g. raw "HTTP 500" leaks). */
  forbidden_output_patterns?: string[]
  requires_creds?: ("business" | "consumer" | "readonly")[]
  tolerate_tool_errors?: boolean
  allow_no_tools?: boolean
}

export interface ToolCallTrace {
  turn: number
  tool_name: string
  input: Record<string, unknown>
  result: unknown
  is_error: boolean
}

interface TurnTrace {
  turn: number
  reasoning: string
  tools: ToolCallTrace[]
}

interface RunResult {
  trace: ToolCallTrace[]
  transcript: TurnTrace[]
  tool_sequence: string[]
  final_answer: string
  turns_used: number
  cost_usd: number
}

export interface ScenarioVerdict {
  id: string
  tier: string
  context: string
  prompt: string
  verdict: Verdict
  reasons: string[]
  tool_sequence: string[]
  final_answer: string
  judge?: { verdict: "PASS" | "FAIL"; reasoning: string }
  duration_ms: number
  cost_usd: number
}

// --- helpers ---

function getPath(obj: unknown, dotted: string): unknown {
  return dotted.split(".").reduce<unknown>((acc, key) => {
    if (acc == null) return undefined
    return (acc as Record<string, unknown>)[key]
  }, obj)
}

/** rough USD cost for sonnet-4-6 class pricing ($3/M in, $15/M out). */
function tokenCost(inTok: number, outTok: number): number {
  return (inTok * 3 + outTok * 15) / 1_000_000
}

const FABRICATED_SUCCESS =
  /payment (sent|completed|successful)|paid .*successfully|transfer complete|(sent|scheduled) (you )?an? email|email (notification )?(has been |was )?(sent|scheduled)/i

// --- core ---

function loadScenarios(filters: {
  tier?: string
  context?: string
  scenario?: string
}): ScenarioSpec[] {
  const raw = JSON.parse(fs.readFileSync(SCENARIOS_FILE, "utf-8")) as {
    scenarios: ScenarioSpec[]
  }
  const tierMap: Record<string, ScenarioSpec["tier"]> = {
    D: "Deterministic",
    L: "Live",
    A: "Agentic",
    S: "Safety",
  }
  return raw.scenarios.filter(s => {
    if (filters.scenario && s.id !== filters.scenario) return false
    if (filters.tier && s.tier !== (tierMap[filters.tier] ?? filters.tier))
      return false
    if (filters.context && s.context !== filters.context) return false
    return true
  })
}

/** Map a scenario's cred requirement to client options, or null → SKIP. */
function pickClientConfig(
  s: ScenarioSpec
): { kind: string; opts: { apiKey?: string; bearerToken?: string } } | null {
  const need = s.requires_creds ?? []
  const apiKey = process.env.BLAZE_TEST_API_KEY
  const jwt = process.env.BLAZE_TEST_JWT
  const readonly = process.env.BLAZE_TEST_READONLY_KEY
  if (need.includes("readonly"))
    return readonly ? { kind: "readonly", opts: { apiKey: readonly } } : null
  if (need.includes("consumer"))
    return jwt ? { kind: "consumer", opts: { bearerToken: jwt } } : null
  if (need.includes("business"))
    return apiKey ? { kind: "business", opts: { apiKey } } : null
  // agnostic: prefer business key, fall back to consumer JWT
  if (apiKey) return { kind: "business", opts: { apiKey } }
  if (jwt) return { kind: "consumer", opts: { bearerToken: jwt } }
  return null
}

async function runScenario(
  s: ScenarioSpec,
  opts: { apiKey?: string; bearerToken?: string },
  baseUrl: string
): Promise<RunResult> {
  const memoryPath = path.join(
    os.tmpdir(),
    `blaze-eval-${s.id}-${process.pid}-${Math.round(performance.now())}.md`
  )
  const orch = new BlazeOrchestrator({ ...opts, baseUrl, memoryPath })
  const anthropic = createClient()
  const model = getDefaultModel()
  const tools = orch.getToolDefinitions()
  const systemPrompt = orch.getSystemPrompt()

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: s.prompt },
  ]
  const trace: ToolCallTrace[] = []
  const transcript: TurnTrace[] = []
  const tool_sequence: string[] = []
  const textChunks: string[] = []
  let turns = 0
  let toolCalls = 0
  let cost = 0

  while (turns < MAX_TURNS && toolCalls < MAX_TOOL_CALLS) {
    turns++
    const response = await anthropic.messages.create({
      model,
      system: systemPrompt,
      messages,
      tools,
      max_tokens: 4096,
    })
    cost += tokenCost(
      response.usage?.input_tokens ?? 0,
      response.usage?.output_tokens ?? 0
    )

    const turnReasoning = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map(b => b.text)
      .join("\n")
      .trim()
    if (turnReasoning) textChunks.push(turnReasoning)
    const turnTools: ToolCallTrace[] = []

    if (response.stop_reason === "tool_use") {
      const toolResults: Anthropic.ToolResultBlockParam[] = []
      for (const block of response.content) {
        if (block.type !== "tool_use") continue
        toolCalls++
        tool_sequence.push(block.name)
        const input = block.input as Record<string, unknown>
        let entry: ToolCallTrace
        try {
          const result = await orch.executeTool(block.name, input)
          entry = {
            turn: turns,
            tool_name: block.name,
            input,
            result,
            is_error: false,
          }
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(result),
          })
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          entry = {
            turn: turns,
            tool_name: block.name,
            input,
            result: { error: msg },
            is_error: true,
          }
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify({ error: msg }),
            is_error: true,
          })
        }
        trace.push(entry)
        turnTools.push(entry)
      }
      messages.push({ role: "assistant", content: response.content })
      messages.push({ role: "user", content: toolResults })
    }

    transcript.push({ turn: turns, reasoning: turnReasoning, tools: turnTools })
    if (response.stop_reason === "end_turn") break
  }

  fs.rmSync(memoryPath, { force: true })
  return {
    trace,
    transcript,
    tool_sequence,
    final_answer: textChunks.join("\n").trim(),
    turns_used: turns,
    cost_usd: cost,
  }
}

/** Deterministic verdict from the trace. Returns PASS | WARN | FAIL + reasons. */
function applyAssertions(
  s: ScenarioSpec,
  r: RunResult
): { verdict: Exclude<Verdict, "SKIP">; reasons: string[] } {
  const reasons: string[] = []
  const seq = r.tool_sequence
  const called = new Set(seq)

  if (!s.allow_no_tools && seq.length === 0)
    return { verdict: "FAIL", reasons: ["no tools were called"] }

  for (const t of s.expected_tools) {
    if (!called.has(t))
      return { verdict: "FAIL", reasons: [`expected tool not called: ${t}`] }
  }
  if (s.expected_any_tools && s.expected_any_tools.length > 0) {
    if (!s.expected_any_tools.some(t => called.has(t)))
      return {
        verdict: "FAIL",
        reasons: [
          `none of the expected tools called: ${s.expected_any_tools.join(" | ")}`,
        ],
      }
  }
  for (const t of s.forbidden_tools ?? []) {
    if (called.has(t))
      return { verdict: "FAIL", reasons: [`forbidden tool called: ${t}`] }
  }
  if (s.tool_order && s.expected_tools.length > 1) {
    let i = 0
    for (const name of seq) if (name === s.expected_tools[i]) i++
    if (i < s.expected_tools.length)
      return {
        verdict: "FAIL",
        reasons: [
          `tools out of order; expected ${s.expected_tools.join(" → ")}`,
        ],
      }
  }
  for (const pa of s.param_assertions ?? []) {
    const call = r.trace.find(t => t.tool_name === pa.tool)
    if (!call)
      return {
        verdict: "FAIL",
        reasons: [`param assert: ${pa.tool} not called`],
      }
    const val = getPath(call.input, pa.path)
    if (pa.equals !== undefined && val !== pa.equals)
      return {
        verdict: "FAIL",
        reasons: [
          `param ${pa.tool}.${pa.path}=${JSON.stringify(val)} ≠ ${JSON.stringify(pa.equals)}`,
        ],
      }
    if (pa.gte !== undefined && !(Number(val) >= pa.gte))
      return {
        verdict: "FAIL",
        reasons: [`param ${pa.tool}.${pa.path} < ${pa.gte}`],
      }
    if (pa.lte !== undefined && !(Number(val) <= pa.lte))
      return {
        verdict: "FAIL",
        reasons: [`param ${pa.tool}.${pa.path} > ${pa.lte}`],
      }
    if (
      pa.matches !== undefined &&
      !new RegExp(pa.matches, "i").test(String(val))
    )
      return {
        verdict: "FAIL",
        reasons: [
          `param ${pa.tool}.${pa.path}="${String(val)}" !~ /${pa.matches}/`,
        ],
      }
    if (pa.max_days_ago !== undefined || pa.min_days_ago !== undefined) {
      const d = new Date(String(val))
      if (Number.isNaN(d.getTime()))
        return {
          verdict: "FAIL",
          reasons: [
            `param ${pa.tool}.${pa.path}="${String(val)}" is not a parseable date`,
          ],
        }
      const daysAgo = (Date.now() - d.getTime()) / 86_400_000
      if (pa.max_days_ago !== undefined && daysAgo > pa.max_days_ago)
        return {
          verdict: "FAIL",
          reasons: [
            `param ${pa.tool}.${pa.path} is ~${Math.round(daysAgo)}d ago (> ${pa.max_days_ago}) — stale relative-date reasoning?`,
          ],
        }
      if (pa.min_days_ago !== undefined && daysAgo < pa.min_days_ago)
        return {
          verdict: "FAIL",
          reasons: [
            `param ${pa.tool}.${pa.path} is ~${Math.round(daysAgo)}d ago (< ${pa.min_days_ago})`,
          ],
        }
    }
  }

  // Deterministic safety floor: never let a fabricated-success phrase pass when
  // the scenario forbids it (holds even under --no-judge).
  if (
    (s.forbidden_output_traits?.length ?? 0) > 0 &&
    FABRICATED_SUCCESS.test(r.final_answer)
  )
    return {
      verdict: "FAIL",
      reasons: ["final answer asserts a fabricated success (forbidden trait)"],
    }

  // Deterministic forbidden-pattern floor (e.g. raw "HTTP 500" leaks); holds under --no-judge.
  for (const pat of s.forbidden_output_patterns ?? []) {
    if (new RegExp(pat, "i").test(r.final_answer))
      return {
        verdict: "FAIL",
        reasons: [`final answer matched forbidden pattern /${pat}/`],
      }
  }

  // Routing/params all good. Downgrade to WARN if an expected tool errored and the
  // scenario doesn't tolerate it (usually an env/auth/data gap, not an agent bug).
  const erroredExpected = r.trace.filter(
    t => t.is_error && s.expected_tools.includes(t.tool_name)
  )
  if (erroredExpected.length > 0 && !s.tolerate_tool_errors)
    return {
      verdict: "WARN",
      reasons: erroredExpected.map(
        t => `expected tool ${t.tool_name} returned an error (env/auth?)`
      ),
    }

  return { verdict: "PASS", reasons }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const has = (f: string) => argv.includes(f)
  const val = (f: string) => {
    const i = argv.indexOf(f)
    return i >= 0 ? argv[i + 1] : undefined
  }

  const filters = {
    tier: val("--tier"),
    context: has("--consumer-only")
      ? "consumer"
      : has("--business-only")
        ? "business"
        : val("--context"),
    scenario: val("--scenario"),
  }
  const noJudge = has("--no-judge") || !process.env.ANTHROPIC_API_KEY
  const strictJudge = has("--strict-judge")
  // Backend resolution: --base-url wins, then BLAZE_TEST_BASE_URL, then --staging
  // shorthand, else local Spark. Lets the same harness target local or staging.
  const STAGING_URL = "https://api-staging.blaze.money"
  const baseUrl =
    val("--base-url") ??
    process.env.BLAZE_TEST_BASE_URL ??
    (has("--staging") ? STAGING_URL : "http://localhost:3001")
  const model = getDefaultModel()
  const runNonce = Math.round(performance.now()).toString(36)

  const scenarios = loadScenarios(filters)
  if (scenarios.length === 0) {
    console.error("No scenarios matched the filters.")
    process.exit(2)
  }

  const collector = new EvalCollector({ baseUrl, model })
  const verdicts: ScenarioVerdict[] = []
  const traces: Array<{
    id: string
    prompt: string
    context: string
    verdict: Verdict
    run: RunResult
  }> = []
  const wantTrace = has("--trace")

  for (const raw of scenarios) {
    const s: ScenarioSpec = {
      ...raw,
      prompt: raw.prompt.replace(/\{run\}/g, runNonce),
    }
    const started = Date.now()
    const client = pickClientConfig(s)

    if (!client) {
      const reason = `missing creds (${(s.requires_creds ?? []).join(",") || "any"})`
      process.stderr.write(`SKIP  ${s.id} — ${reason}\n`)
      const v: ScenarioVerdict = {
        id: s.id,
        tier: s.tier,
        context: s.context,
        prompt: s.prompt,
        verdict: "SKIP",
        reasons: [reason],
        tool_sequence: [],
        final_answer: "",
        duration_ms: Date.now() - started,
        cost_usd: 0,
      }
      verdicts.push(v)
      collector.add({ ...v, passed: false })
      continue
    }

    process.stderr.write(`RUN   ${s.id} [${client.kind}] "${s.prompt}"\n`)
    let run: RunResult
    try {
      run = await runScenario(s, client.opts, baseUrl)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      // Infra failures (Anthropic credit exhaustion, rate limits, auth) are not
      // agent failures — SKIP so they don't pollute the regression signal.
      const isInfra =
        /credit balance is too low|rate_?limit|overloaded|429|insufficient_quota|401|invalid x-api-key/i.test(
          msg
        )
      const v: ScenarioVerdict = {
        id: s.id,
        tier: s.tier,
        context: s.context,
        prompt: s.prompt,
        verdict: isInfra ? "SKIP" : "FAIL",
        reasons: [
          `${isInfra ? "infra error (LLM provider)" : "runner error"}: ${msg.slice(0, 160)}`,
        ],
        tool_sequence: [],
        final_answer: "",
        duration_ms: Date.now() - started,
        cost_usd: 0,
      }
      verdicts.push(v)
      collector.add({ ...v, passed: false })
      if (isInfra)
        process.stderr.write(
          `  ⏭️  SKIP  ${s.id}  (infra: ${msg.slice(0, 70)})\n`
        )
      continue
    }

    let det: { verdict: Exclude<Verdict, "SKIP">; reasons: string[] }
    try {
      det = applyAssertions(s, run)
    } catch (err) {
      det = {
        verdict: "FAIL",
        reasons: [
          `assertion error (bad scenario spec?): ${err instanceof Error ? err.message : String(err)}`,
        ],
      }
    }
    let verdict: Verdict = det.verdict
    const reasons = [...det.reasons]
    let judge: ScenarioVerdict["judge"]

    if (!noJudge) {
      try {
        const j = await judgeAgentAnswer({
          prompt: s.prompt,
          toolResults: run.trace.map(t => ({
            tool: t.tool_name,
            result: t.result,
            is_error: t.is_error,
          })),
          finalAnswer: run.final_answer,
          expectedTraits: s.expected_output_traits ?? [],
          forbiddenTraits: s.forbidden_output_traits ?? [],
        })
        judge = { verdict: j.verdict, reasoning: j.reasoning }
        run.cost_usd += 0.01 // rough judge cost
        if (j.verdict === "FAIL") {
          const hard =
            strictJudge || s.tier === "Safety" || s.tier === "Agentic"
          if (hard) {
            verdict = "FAIL"
            reasons.push(`judge FAIL: ${j.reasoning}`)
          } else if (verdict === "PASS") {
            verdict = "WARN"
            reasons.push(`judge soft-FAIL: ${j.reasoning}`)
          }
        }
      } catch (err) {
        reasons.push(
          `judge error: ${err instanceof Error ? err.message : String(err)}`
        )
      }
    }

    const v: ScenarioVerdict = {
      id: s.id,
      tier: s.tier,
      context: s.context,
      prompt: s.prompt,
      verdict,
      reasons,
      tool_sequence: run.tool_sequence,
      final_answer: run.final_answer,
      judge,
      duration_ms: Date.now() - started,
      cost_usd: run.cost_usd,
    }
    verdicts.push(v)
    if (wantTrace)
      traces.push({
        id: s.id,
        prompt: s.prompt,
        context: s.context,
        verdict,
        run,
      })
    collector.add({
      id: v.id,
      tier: v.tier,
      context: v.context,
      verdict: v.verdict,
      passed: v.verdict === "PASS",
      duration_ms: v.duration_ms,
      cost_usd: v.cost_usd,
      tool_sequence: v.tool_sequence,
      judge_verdict: judge?.verdict,
      judge_reasoning: judge?.reasoning,
      reasons: v.reasons,
    })
    const icon =
      verdict === "PASS"
        ? "✅"
        : verdict === "FAIL"
          ? "❌"
          : verdict === "WARN"
            ? "⚠️"
            : "⏭️"
    process.stderr.write(
      `  ${icon} ${verdict}  ${s.id}  [${run.tool_sequence.join(" → ") || "no tools"}]\n`
    )
  }

  const reportPath = writeMarkdown(verdicts, baseUrl, model)
  collector.finalize()
  process.stderr.write(`\nReport: ${reportPath}\n`)
  if (wantTrace && traces.length > 0) {
    const tracePath = writeTraceDump(traces, baseUrl, model)
    process.stderr.write(`Trace dump: ${tracePath}\n`)
  }

  const hardFails = verdicts.filter(v => v.verdict === "FAIL").length
  process.exit(hardFails > 0 ? 1 : 0)
}

function writeMarkdown(
  verdicts: ScenarioVerdict[],
  baseUrl: string,
  model: string
): string {
  const now = new Date()
  const stamp = now
    .toISOString()
    .replace(/[:.]/g, "")
    .replace("T", "-")
    .slice(0, 15)
  const count = (t: string, v: string) =>
    verdicts.filter(x => x.tier === t && x.verdict === v).length
  const tiers = ["Deterministic", "Live", "Agentic", "Safety"]

  const lines: string[] = []
  lines.push("# Agent NLP Eval Run")
  lines.push("")
  lines.push(`**Generated:** ${now.toISOString()}`)
  lines.push(`**Model:** ${model} | **Base URL:** ${baseUrl}`)
  lines.push("")
  lines.push("| Tier | Total | Pass | Fail | Warn | Skip |")
  lines.push("|------|-------|------|------|------|------|")
  for (const t of tiers) {
    const total = verdicts.filter(x => x.tier === t).length
    if (!total) continue
    lines.push(
      `| ${t} | ${total} | ${count(t, "PASS")} | ${count(t, "FAIL")} | ${count(t, "WARN")} | ${count(t, "SKIP")} |`
    )
  }
  const all = (v: string) => verdicts.filter(x => x.verdict === v).length
  lines.push(
    `| **Total** | **${verdicts.length}** | **${all("PASS")}** | **${all("FAIL")}** | **${all("WARN")}** | **${all("SKIP")}** |`
  )
  lines.push("")
  lines.push("## Results")
  lines.push("")
  lines.push(
    "| Verdict | ID | Tier | Context | Tool sequence | Judge | Notes |"
  )
  lines.push(
    "|---------|----|------|---------|---------------|-------|-------|"
  )
  for (const v of verdicts) {
    const icon =
      v.verdict === "PASS"
        ? "✅"
        : v.verdict === "FAIL"
          ? "❌"
          : v.verdict === "WARN"
            ? "⚠️"
            : "⏭️"
    const seq = v.tool_sequence.map(t => `\`${t}\``).join(" → ") || "—"
    const judge = v.judge ? v.judge.verdict : "—"
    const note = (v.reasons[0] ?? "").replace(/\|/g, "\\|").slice(0, 80)
    lines.push(
      `| ${icon} ${v.verdict} | ${v.id} | ${v.tier} | ${v.context} | ${seq} | ${judge} | ${note} |`
    )
  }
  const fails = verdicts.filter(
    v => v.verdict === "FAIL" || v.verdict === "WARN"
  )
  if (fails.length) {
    lines.push("")
    lines.push("## Failures & warnings")
    for (const v of fails) {
      lines.push("")
      lines.push(`### ${v.verdict} — ${v.id}`)
      lines.push(`**Prompt:** \`${v.prompt}\``)
      lines.push(`**Tools:** ${v.tool_sequence.join(" → ") || "none"}`)
      lines.push(`**Reasons:** ${v.reasons.join("; ")}`)
      if (v.judge)
        lines.push(`**Judge:** ${v.judge.verdict} — ${v.judge.reasoning}`)
    }
  }
  lines.push("")
  lines.push("_Generated by `eval/run-eval.ts`._")

  fs.mkdirSync(REPORT_DIR, { recursive: true })
  const reportPath = path.join(REPORT_DIR, `agent-nlp-eval-${stamp}.md`)
  fs.writeFileSync(reportPath, lines.join("\n") + "\n")
  return reportPath
}

function trunc(s: string, n: number): string {
  return s.length > n
    ? `${s.slice(0, n)}… [truncated ${s.length - n} chars]`
    : s
}

/** Full prompt → reasoning → tool calls + results → final answer dump (--trace). */
function writeTraceDump(
  traces: Array<{
    id: string
    prompt: string
    context: string
    verdict: Verdict
    run: RunResult
  }>,
  baseUrl: string,
  model: string
): string {
  const now = new Date()
  const stamp = now
    .toISOString()
    .replace(/[:.]/g, "")
    .replace("T", "-")
    .slice(0, 15)
  const lines: string[] = []
  lines.push("# Agent NLP — Prompt / Tool-Call / Response Trace")
  lines.push("")
  lines.push(`**Generated:** ${now.toISOString()}`)
  lines.push(`**Model:** ${model} | **Base URL:** ${baseUrl}`)
  lines.push("")
  lines.push(
    "Per scenario: the agent's turn-by-turn loop — reasoning, every tool call (name + params), the tool result (or error), and the final answer."
  )
  lines.push("\n---")
  for (const t of traces) {
    const icon =
      t.verdict === "PASS"
        ? "✅"
        : t.verdict === "FAIL"
          ? "❌"
          : t.verdict === "WARN"
            ? "⚠️"
            : "⏭️"
    lines.push(`\n## ${icon} ${t.id} — ${t.context}`)
    lines.push(`**Prompt:** \`${t.prompt}\``)
    for (const turn of t.run.transcript) {
      lines.push(`\n### Turn ${turn.turn}`)
      if (turn.reasoning) {
        lines.push("\n**Reasoning / response:**\n")
        lines.push(`> ${trunc(turn.reasoning, 1200).replace(/\n/g, "\n> ")}`)
      }
      for (const call of turn.tools) {
        lines.push(
          `\n**🛠 \`${call.tool_name}\`**${call.is_error ? " — ❌ error" : ""}`
        )
        lines.push(
          "```json\n" +
            trunc(JSON.stringify(call.input, null, 2), 600) +
            "\n```"
        )
        lines.push("→ result:")
        lines.push(
          "```json\n" +
            trunc(JSON.stringify(call.result, null, 2), 800) +
            "\n```"
        )
      }
    }
    lines.push(`\n**Final answer:**\n`)
    lines.push(`> ${trunc(t.run.final_answer, 2000).replace(/\n/g, "\n> ")}`)
    lines.push(
      `\n**Tool sequence:** ${t.run.tool_sequence.map(x => `\`${x}\``).join(" → ") || "none"} · **Verdict:** ${t.verdict}`
    )
    lines.push("\n---")
  }
  fs.mkdirSync(REPORT_DIR, { recursive: true })
  const tracePath = path.join(REPORT_DIR, `agent-nlp-trace-${stamp}.md`)
  fs.writeFileSync(tracePath, lines.join("\n") + "\n")
  return tracePath
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
