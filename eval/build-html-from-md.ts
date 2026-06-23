#!/usr/bin/env ts-node
/**
 * Standalone backfill: parse an existing eval trace.md + report.md pair into
 * HtmlReportData and emit the interactive HTML viewer — WITHOUT re-running the
 * (paid) eval. Lets us generate the viewer for past runs.
 *
 * Usage:
 *   ts-node eval/build-html-from-md.ts <trace.md> <report.md> <out.html>
 *
 * The trace.md / report.md formats are produced by run-eval.ts (writeTraceDump /
 * writeMarkdown). Parsing is intentionally resilient: a missing section degrades
 * to empty arrays rather than crashing.
 *
 * Layout recap (trace.md):
 *   **Generated:** <iso>
 *   **Model:** <model> | **Base URL:** <url>
 *   ## <emoji> <id> — <context>          (✅ PASS ⚠️ WARN ❌ FAIL ⏭️ SKIP)
 *   **Prompt:** `<prompt>`
 *   ### Turn N
 *   **Reasoning / response:**            (followed by `> ` quoted lines)
 *   **🛠 `<tool>`**  [— ❌ error]         (then a ```json input block)
 *   → result:                            (then a ```json result block)
 *   **Final answer:**                    (followed by `> ` quoted lines)
 *   **Tool sequence:** `a → b` · **Verdict:** <PASS|WARN|FAIL>
 *
 * report.md adds: the summary counts table, the full Results table (incl. SKIPs
 * that never appear in trace.md), and a "Failures & warnings" section with
 * per-scenario **Reasons:** / **Judge:** lines.
 */
import * as fs from "fs"
import * as path from "path"
import {
  buildHtmlReport,
  type HtmlReportData,
  type HtmlReportScenario,
} from "./html-report"

const SCENARIOS_FILE = path.resolve(__dirname, "agent-nlp-scenarios.json")

interface CorpusMaps {
  /** base id → category (per #3476). */
  category: Map<string, string>
  /** base id → canonical prompt (fallback when a scenario has no trace prompt, e.g. SKIPs). */
  prompt: Map<string, string>
}

/**
 * Load id → category and id → prompt maps from the scenarios corpus. markdown
 * traces carry no category, and SKIP scenarios never produce a trace prompt — we
 * recover both from the JSON. Variant ids (`<base>#vN`) inherit their base
 * scenario's values, so callers strip any `#vN` suffix before lookup.
 */
function loadCorpusMaps(): CorpusMaps {
  const category = new Map<string, string>()
  const prompt = new Map<string, string>()
  try {
    const raw = JSON.parse(fs.readFileSync(SCENARIOS_FILE, "utf-8")) as {
      scenarios: Array<{ id: string; category?: string; prompt?: string }>
    }
    for (const s of raw.scenarios) {
      if (s.category) category.set(s.id, s.category)
      if (s.prompt) prompt.set(s.id, s.prompt)
    }
  } catch {
    // Corpus unreadable → categories fall back to "Other", prompts to trace only.
  }
  return { category, prompt }
}

/** Look up a corpus value, stripping any `#vN` phrasing-variant suffix. */
function corpusLookup(
  id: string,
  map: Map<string, string>
): string | undefined {
  return map.get(id.split("#")[0])
}

type Verdict = "PASS" | "FAIL" | "WARN" | "SKIP"

const EMOJI_VERDICT: Record<string, Verdict> = {
  "✅": "PASS",
  "⚠️": "WARN",
  "❌": "FAIL",
  "⏭️": "SKIP",
}

/** Strip leading "> " (and an optional single space) from a quoted block line. */
function unquote(line: string): string {
  return line.replace(/^>\s?/, "")
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    // Trace JSON may be truncated ("… [truncated N chars]"); keep the raw string
    // so the viewer still shows something useful rather than crashing.
    return raw
  }
}

interface ParsedToolCall {
  name: string
  input: unknown
  result: unknown
  isError: boolean
}
interface ParsedTurn {
  index: number
  reasoning?: string
  toolCalls: ParsedToolCall[]
}
interface ParsedTraceScenario {
  id: string
  context: string
  verdict: Verdict
  prompt: string
  finalAnswer: string
  toolSequence: string[]
  turns: ParsedTurn[]
}

// --- trace.md parsing ---

function parseTraceHeader(text: string): {
  generatedAt: string
  model: string
  baseUrl: string
} {
  const gen = /\*\*Generated:\*\*\s*(.+)/.exec(text)
  const mb = /\*\*Model:\*\*\s*(.+?)\s*\|\s*\*\*Base URL:\*\*\s*(.+)/.exec(text)
  return {
    generatedAt: gen ? gen[1].trim() : "",
    model: mb ? mb[1].trim() : "",
    baseUrl: mb ? mb[2].trim() : "",
  }
}

/** Read a fenced ```json block starting at/after line i. Returns [value, nextIndex]. */
function readJsonBlock(lines: string[], i: number): [unknown, number] {
  // advance to the opening fence
  let j = i
  while (j < lines.length && !lines[j].trim().startsWith("```")) j++
  if (j >= lines.length) return [undefined, i]
  const body: string[] = []
  j++ // past opening fence
  while (j < lines.length && !lines[j].trim().startsWith("```")) {
    body.push(lines[j])
    j++
  }
  j++ // past closing fence
  return [safeJsonParse(body.join("\n")), j]
}

function parseTrace(text: string): ParsedTraceScenario[] {
  const lines = text.split("\n")
  const scenarios: ParsedTraceScenario[] = []
  let cur: ParsedTraceScenario | null = null
  let curTurn: ParsedTurn | null = null

  // Matches "## <emoji> <id> — <context>". The emoji may be 1-2 codepoints.
  const headRe = /^##\s+(\S+)\s+(.+?)\s+—\s+(.+?)\s*$/

  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    const head = headRe.exec(line)
    if (head) {
      if (cur) scenarios.push(cur)
      const verdict = EMOJI_VERDICT[head[1]] ?? "PASS"
      cur = {
        id: head[2].trim(),
        context: head[3].trim(),
        verdict,
        prompt: "",
        finalAnswer: "",
        toolSequence: [],
        turns: [],
      }
      curTurn = null
      i++
      continue
    }

    if (!cur) {
      i++
      continue
    }

    const promptM = /^\*\*Prompt:\*\*\s*`([\s\S]*?)`\s*$/.exec(line)
    if (promptM) {
      cur.prompt = promptM[1]
      i++
      continue
    }

    const turnM = /^###\s+Turn\s+(\d+)/.exec(line)
    if (turnM) {
      curTurn = { index: Number(turnM[1]), toolCalls: [] }
      cur.turns.push(curTurn)
      i++
      continue
    }

    if (/^\*\*Reasoning \/ response:\*\*/.test(line)) {
      // collect following `> ` quoted lines (after a possible blank line)
      let j = i + 1
      while (j < lines.length && lines[j].trim() === "") j++
      const quoted: string[] = []
      while (j < lines.length && lines[j].startsWith(">")) {
        quoted.push(unquote(lines[j]))
        j++
      }
      if (curTurn) curTurn.reasoning = quoted.join("\n").trim()
      i = j
      continue
    }

    const toolM = /^\*\*🛠\s*`([^`]+)`\*\*(\s*—\s*❌\s*error)?/.exec(line)
    if (toolM) {
      const name = toolM[1]
      const isError = Boolean(toolM[2])
      const [input, afterInput] = readJsonBlock(lines, i + 1)
      // find "→ result:" then its json block
      let k = afterInput
      while (k < lines.length && !/→\s*result:/.test(lines[k])) {
        // stop if we hit the next structural marker without a result
        if (
          /^###\s+Turn/.test(lines[k]) ||
          /^##\s+/.test(lines[k]) ||
          /^\*\*🛠/.test(lines[k]) ||
          /^\*\*Final answer:/.test(lines[k])
        )
          break
        k++
      }
      let result: unknown
      let next = k
      if (k < lines.length && /→\s*result:/.test(lines[k])) {
        const [res, afterRes] = readJsonBlock(lines, k + 1)
        result = res
        next = afterRes
      } else {
        next = afterInput
      }
      const call: ParsedToolCall = { name, input, result, isError }
      if (!curTurn) {
        curTurn = { index: cur.turns.length + 1, toolCalls: [] }
        cur.turns.push(curTurn)
      }
      curTurn.toolCalls.push(call)
      i = next
      continue
    }

    if (/^\*\*Final answer:\*\*/.test(line)) {
      let j = i + 1
      while (j < lines.length && lines[j].trim() === "") j++
      const quoted: string[] = []
      while (j < lines.length && lines[j].startsWith(">")) {
        quoted.push(unquote(lines[j]))
        j++
      }
      cur.finalAnswer = quoted.join("\n").trim()
      i = j
      continue
    }

    const seqM =
      /^\*\*Tool sequence:\*\*\s*(.+?)\s*·\s*\*\*Verdict:\*\*\s*(\w+)/.exec(
        line
      )
    if (seqM) {
      const seqRaw = seqM[1].trim()
      if (seqRaw && !/^none$/i.test(seqRaw)) {
        cur.toolSequence = seqRaw
          .split("→")
          .map(t => t.replace(/`/g, "").trim())
          .filter(Boolean)
      }
      const v = seqM[2].toUpperCase()
      if (
        v in EMOJI_VERDICT === false &&
        ["PASS", "WARN", "FAIL", "SKIP"].includes(v)
      )
        cur.verdict = v as Verdict
      i++
      continue
    }

    i++
  }
  if (cur) scenarios.push(cur)
  return scenarios
}

// --- report.md parsing ---

interface ReportRow {
  verdict: Verdict
  id: string
  tier: HtmlReportScenario["tier"]
  context: string
  toolSequence: string[]
}
interface ReportExtras {
  rows: ReportRow[]
  reasonsById: Map<string, string[]>
  judgeById: Map<string, { verdict?: "PASS" | "FAIL"; reasoning?: string }>
}

const VALID_TIERS = ["Deterministic", "Live", "Agentic", "Safety"]

function tierOf(raw: string): HtmlReportScenario["tier"] {
  const t = raw.trim()
  return (VALID_TIERS.includes(t) ? t : "Live") as HtmlReportScenario["tier"]
}

function parseReport(text: string): ReportExtras {
  const lines = text.split("\n")
  const rows: ReportRow[] = []
  const reasonsById = new Map<string, string[]>()
  const judgeById = new Map<
    string,
    { verdict?: "PASS" | "FAIL"; reasoning?: string }
  >()

  // Results table rows: | <emoji> VERDICT | id | tier | context | seq | judge | notes |
  const rowRe =
    /^\|\s*(\S+)\s+(PASS|WARN|FAIL|SKIP)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|/
  for (const line of lines) {
    const m = rowRe.exec(line)
    if (!m) continue
    const verdict = (EMOJI_VERDICT[m[1]] ?? (m[2] as Verdict)) as Verdict
    const id = m[3].trim()
    const tier = tierOf(m[4])
    const context = m[5].trim()
    const seqCell = m[6].trim()
    const toolSequence =
      seqCell && seqCell !== "—"
        ? seqCell
            .split("→")
            .map(t => t.replace(/`/g, "").trim())
            .filter(Boolean)
        : []
    rows.push({ verdict, id, tier, context, toolSequence })
  }

  // Failures & warnings section: blocks led by "### <VERDICT> — <id>".
  let curId: string | null = null
  const failHead = /^###\s+(PASS|WARN|FAIL|SKIP)\s+—\s+(.+?)\s*$/
  for (const line of lines) {
    const fh = failHead.exec(line)
    if (fh) {
      curId = fh[2].trim()
      continue
    }
    if (!curId) continue
    const reasonsM = /^\*\*Reasons:\*\*\s*(.+)$/.exec(line)
    if (reasonsM) {
      reasonsById.set(
        curId,
        reasonsM[1]
          .split(";")
          .map(r => r.trim())
          .filter(Boolean)
      )
      continue
    }
    const judgeM = /^\*\*Judge:\*\*\s*(PASS|FAIL)\s*—\s*(.+)$/.exec(line)
    if (judgeM) {
      judgeById.set(curId, {
        verdict: judgeM[1] as "PASS" | "FAIL",
        reasoning: judgeM[2].trim(),
      })
    }
  }

  return { rows, reasonsById, judgeById }
}

// --- assembly ---

function build(traceText: string, reportText: string): HtmlReportData {
  const header = parseTraceHeader(traceText || reportText)
  const traceScenarios = traceText ? parseTrace(traceText) : []
  const report = reportText
    ? parseReport(reportText)
    : { rows: [], reasonsById: new Map(), judgeById: new Map() }

  const traceById = new Map(traceScenarios.map(s => [s.id, s]))
  const rowById = new Map(report.rows.map(r => [r.id, r]))
  const corpus = loadCorpusMaps()

  // Preserve report Results-table order (it includes SKIPs absent from trace);
  // fall back to trace order if the report had no rows.
  const orderedIds: string[] = []
  const seen = new Set<string>()
  for (const r of report.rows) {
    if (!seen.has(r.id)) {
      orderedIds.push(r.id)
      seen.add(r.id)
    }
  }
  for (const s of traceScenarios) {
    if (!seen.has(s.id)) {
      orderedIds.push(s.id)
      seen.add(s.id)
    }
  }

  const scenarios: HtmlReportScenario[] = orderedIds.map(id => {
    const tr = traceById.get(id)
    const row = rowById.get(id)
    const verdict: Verdict = row?.verdict ?? tr?.verdict ?? "PASS"
    const judge = report.judgeById.get(id)
    return {
      id,
      tier: row?.tier ?? tierOf(""),
      context: row?.context ?? tr?.context ?? "",
      category: corpusLookup(id, corpus.category) ?? "Other",
      // Prefer the trace prompt; fall back to the corpus prompt so SKIP rows
      // (no trace) still surface a real prompt as their sidebar title.
      prompt: tr?.prompt || corpusLookup(id, corpus.prompt) || "",
      verdict,
      toolSequence: tr?.toolSequence ?? row?.toolSequence ?? [],
      finalAnswer: tr?.finalAnswer ?? "",
      reasons: report.reasonsById.get(id) ?? [],
      judgeVerdict: judge?.verdict,
      judgeReasoning: judge?.reasoning,
      turns: (tr?.turns ?? []).map(t => ({
        index: t.index,
        reasoning: t.reasoning,
        toolCalls: t.toolCalls.map(c => ({
          name: c.name,
          input: c.input,
          result: c.result,
          isError: c.isError,
        })),
      })),
    }
  })

  const count = (v: Verdict) => scenarios.filter(s => s.verdict === v).length
  return {
    generatedAt: header.generatedAt,
    model: header.model,
    baseUrl: header.baseUrl,
    counts: {
      total: scenarios.length,
      pass: count("PASS"),
      fail: count("FAIL"),
      warn: count("WARN"),
      skip: count("SKIP"),
    },
    scenarios,
  }
}

function main(): void {
  const [tracePath, reportPath, outPath] = process.argv.slice(2)
  if (!tracePath || !reportPath || !outPath) {
    console.error(
      "Usage: ts-node eval/build-html-from-md.ts <trace.md> <report.md> <out.html>"
    )
    process.exit(2)
  }
  const traceText = fs.existsSync(tracePath)
    ? fs.readFileSync(tracePath, "utf-8")
    : ""
  const reportText = fs.existsSync(reportPath)
    ? fs.readFileSync(reportPath, "utf-8")
    : ""
  if (!traceText)
    console.error(`warning: trace file not readable: ${tracePath}`)
  if (!reportText)
    console.error(`warning: report file not readable: ${reportPath}`)

  const data = build(traceText, reportText)
  fs.writeFileSync(outPath, buildHtmlReport(data))

  const c = data.counts
  console.error(
    `Parsed ${data.scenarios.length} scenarios ` +
      `(PASS ${c.pass} / WARN ${c.warn} / FAIL ${c.fail} / SKIP ${c.skip}). ` +
      `Wrote ${outPath}`
  )
}

main()
