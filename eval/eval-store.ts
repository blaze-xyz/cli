/**
 * Agent NLP eval persistence + run-over-run comparison.
 *
 * Adapted from gstack's test/helpers/eval-store.ts. EvalCollector accumulates
 * per-scenario verdicts, writes a JSON run to test-results/eval-runs/, prints a
 * summary, and auto-compares against the most recent prior run on the same branch.
 *
 * Tests are keyed by scenario `id`. The deterministic verdict (PASS/FAIL/WARN/SKIP)
 * is the stable signal; the LLM judge verdict is recorded alongside it.
 */
import * as fs from "fs"
import * as path from "path"
import * as os from "os"
import { spawnSync } from "child_process"

const SCHEMA_VERSION = 1

export const EVAL_DIR = path.resolve(
  __dirname,
  "..",
  "test-results",
  "eval-runs"
)

export type Verdict = "PASS" | "FAIL" | "SKIP" | "WARN"

export interface EvalTestEntry {
  id: string
  tier: string
  context: string
  verdict: Verdict
  passed: boolean // verdict === "PASS"
  duration_ms: number
  cost_usd: number
  tool_sequence: string[]
  judge_verdict?: "PASS" | "FAIL"
  judge_reasoning?: string
  reasons?: string[]
}

export interface EvalResult {
  schema_version: number
  version: string
  branch: string
  git_sha: string
  timestamp: string
  hostname: string
  base_url: string
  model: string
  total: number
  passed: number
  failed: number
  warned: number
  skipped: number
  total_cost_usd: number
  total_duration_ms: number
  tests: EvalTestEntry[]
  _partial?: boolean
}

export interface TestDelta {
  id: string
  before: { verdict: Verdict | "—"; tools: number; cost_usd: number }
  after: { verdict: Verdict | "—"; tools: number; cost_usd: number }
  status_change: "improved" | "regressed" | "unchanged"
}

export interface ComparisonResult {
  before_branch: string
  after_branch: string
  before_timestamp: string
  after_timestamp: string
  deltas: TestDelta[]
  improved: number
  regressed: number
  unchanged: number
  total_cost_delta: number
  tool_count_before: number
  tool_count_after: number
}

// --- git/version helpers ---

function getGitInfo(): { branch: string; sha: string } {
  try {
    const branch = spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      stdio: "pipe",
      timeout: 5000,
    })
    const sha = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
      stdio: "pipe",
      timeout: 5000,
    })
    return {
      branch: branch.stdout?.toString().trim() || "unknown",
      sha: sha.stdout?.toString().trim() || "unknown",
    }
  } catch {
    return { branch: "unknown", sha: "unknown" }
  }
}

function getVersion(): string {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, "..", "package.json"), "utf-8")
    )
    return pkg.version || "unknown"
  } catch {
    return "unknown"
  }
}

// --- comparison ---

export function findPreviousRun(
  evalDir: string,
  branch: string,
  excludeFile: string
): string | null {
  let files: string[]
  try {
    files = fs
      .readdirSync(evalDir)
      .filter(f => f.endsWith(".json") && !f.startsWith("_partial"))
  } catch {
    return null
  }
  const entries: Array<{ file: string; branch: string; timestamp: string }> = []
  for (const file of files) {
    if (file === path.basename(excludeFile)) continue
    try {
      const data = JSON.parse(
        fs.readFileSync(path.join(evalDir, file), "utf-8")
      )
      entries.push({
        file: path.join(evalDir, file),
        branch: data.branch || "",
        timestamp: data.timestamp || "",
      })
    } catch {
      continue
    }
  }
  if (entries.length === 0) return null
  entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  const sameBranch = entries.find(e => e.branch === branch)
  return sameBranch ? sameBranch.file : entries[0].file
}

export function compareEvalResults(
  before: EvalResult,
  after: EvalResult
): ComparisonResult {
  const deltas: TestDelta[] = []
  let improved = 0,
    regressed = 0,
    unchanged = 0,
    toolBefore = 0,
    toolAfter = 0
  const beforeMap = new Map<string, EvalTestEntry>()
  for (const t of before.tests) beforeMap.set(t.id, t)

  for (const a of after.tests) {
    const b = beforeMap.get(a.id)
    const bTools = b?.tool_sequence?.length ?? 0
    const aTools = a.tool_sequence?.length ?? 0
    toolBefore += bTools
    toolAfter += aTools
    let status: TestDelta["status_change"] = "unchanged"
    if (b) {
      if (!b.passed && a.passed) {
        status = "improved"
        improved++
      } else if (b.passed && !a.passed) {
        status = "regressed"
        regressed++
      } else unchanged++
    } else unchanged++
    deltas.push({
      id: a.id,
      before: {
        verdict: b?.verdict ?? "—",
        tools: bTools,
        cost_usd: b?.cost_usd ?? 0,
      },
      after: { verdict: a.verdict, tools: aTools, cost_usd: a.cost_usd },
      status_change: status,
    })
    beforeMap.delete(a.id)
  }
  for (const [id, b] of beforeMap) {
    toolBefore += b.tool_sequence?.length ?? 0
    unchanged++
    deltas.push({
      id: `${id} (removed)`,
      before: {
        verdict: b.verdict,
        tools: b.tool_sequence?.length ?? 0,
        cost_usd: b.cost_usd,
      },
      after: { verdict: "—", tools: 0, cost_usd: 0 },
      status_change: "unchanged",
    })
  }
  return {
    before_branch: before.branch,
    after_branch: after.branch,
    before_timestamp: before.timestamp,
    after_timestamp: after.timestamp,
    deltas,
    improved,
    regressed,
    unchanged,
    total_cost_delta: after.total_cost_usd - before.total_cost_usd,
    tool_count_before: toolBefore,
    tool_count_after: toolAfter,
  }
}

export function formatComparison(c: ComparisonResult): string {
  const lines: string[] = []
  const ts = c.before_timestamp.replace("T", " ").slice(0, 16)
  lines.push(`\nvs previous run: ${c.before_branch} (${ts})`)
  lines.push("─".repeat(72))
  for (const d of c.deltas) {
    const arrow =
      d.status_change === "improved"
        ? "↑"
        : d.status_change === "regressed"
          ? "↓"
          : "="
    const id = d.id.length > 36 ? d.id.slice(0, 33) + "..." : d.id.padEnd(36)
    lines.push(
      `  ${id}  ${String(d.before.verdict).padEnd(5)} → ${String(d.after.verdict).padEnd(5)}  ${arrow}`
    )
  }
  lines.push("─".repeat(72))
  const parts: string[] = []
  if (c.improved) parts.push(`${c.improved} improved`)
  if (c.regressed) parts.push(`${c.regressed} regressed`)
  if (c.unchanged) parts.push(`${c.unchanged} unchanged`)
  lines.push(`  Status: ${parts.join(", ") || "no overlap"}`)
  const toolDelta = c.tool_count_after - c.tool_count_before
  lines.push(
    `  Tool calls: ${c.tool_count_before} → ${c.tool_count_after} (${toolDelta >= 0 ? "+" : ""}${toolDelta})`
  )
  const cs = c.total_cost_delta >= 0 ? "+" : ""
  lines.push(`  Cost:   ${cs}$${c.total_cost_delta.toFixed(2)}`)
  const regressions = c.deltas.filter(d => d.status_change === "regressed")
  if (regressions.length) {
    lines.push("\n  ⚠️  Regressions:")
    for (const d of regressions)
      lines.push(
        `    REGRESSION: "${d.id}" was passing, now ${d.after.verdict}.`
      )
  }
  return lines.join("\n")
}

// --- collector ---

export class EvalCollector {
  private tests: EvalTestEntry[] = []
  private evalDir: string
  private baseUrl: string
  private model: string

  constructor(opts: { baseUrl: string; model: string; evalDir?: string }) {
    this.baseUrl = opts.baseUrl
    this.model = opts.model
    this.evalDir = opts.evalDir || EVAL_DIR
  }

  add(entry: EvalTestEntry): void {
    this.tests.push(entry)
    this.savePartial()
  }

  private build(partial: boolean): EvalResult {
    const git = getGitInfo()
    const passed = this.tests.filter(t => t.verdict === "PASS").length
    const failed = this.tests.filter(t => t.verdict === "FAIL").length
    const warned = this.tests.filter(t => t.verdict === "WARN").length
    const skipped = this.tests.filter(t => t.verdict === "SKIP").length
    return {
      schema_version: SCHEMA_VERSION,
      version: getVersion(),
      branch: git.branch,
      git_sha: git.sha,
      timestamp: new Date().toISOString(),
      hostname: os.hostname(),
      base_url: this.baseUrl,
      model: this.model,
      total: this.tests.length,
      passed,
      failed,
      warned,
      skipped,
      total_cost_usd:
        Math.round(this.tests.reduce((s, t) => s + t.cost_usd, 0) * 1000) /
        1000,
      total_duration_ms: this.tests.reduce((s, t) => s + t.duration_ms, 0),
      tests: this.tests,
      _partial: partial || undefined,
    }
  }

  private savePartial(): void {
    try {
      fs.mkdirSync(this.evalDir, { recursive: true })
      const p = path.join(this.evalDir, "_partial.json")
      const tmp = p + ".tmp"
      fs.writeFileSync(tmp, JSON.stringify(this.build(true), null, 2) + "\n")
      fs.renameSync(tmp, p)
    } catch {
      /* best-effort */
    }
  }

  /** Write the final run JSON, print summary + comparison. Returns the filepath. */
  finalize(): string {
    const result = this.build(false)
    fs.mkdirSync(this.evalDir, { recursive: true })
    const dateStr = result.timestamp
      .replace(/[:.]/g, "")
      .replace("T", "-")
      .slice(0, 15)
    const safeBranch = result.branch.replace(/[^a-zA-Z0-9._-]/g, "-")
    const filepath = path.join(
      this.evalDir,
      `${result.version}-${safeBranch}-agent-nlp-${dateStr}.json`
    )
    fs.writeFileSync(filepath, JSON.stringify(result, null, 2) + "\n")

    process.stderr.write(`\nSaved run: ${filepath}\n`)
    try {
      const prev = findPreviousRun(this.evalDir, result.branch, filepath)
      if (prev) {
        const prevResult: EvalResult = JSON.parse(
          fs.readFileSync(prev, "utf-8")
        )
        process.stderr.write(
          formatComparison(compareEvalResults(prevResult, result)) + "\n"
        )
      } else {
        process.stderr.write("First run — no comparison available.\n")
      }
    } catch (err) {
      process.stderr.write(
        `Compare error: ${err instanceof Error ? err.message : String(err)}\n`
      )
    }
    return filepath
  }
}
