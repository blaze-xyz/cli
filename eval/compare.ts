#!/usr/bin/env ts-node
/**
 * Compare the two most recent agent-nlp eval runs (or two explicit files).
 *
 * Usage:
 *   ts-node eval/compare.ts                 # two most recent runs in eval-runs/
 *   ts-node eval/compare.ts <before.json> <after.json>
 */
import * as fs from "fs"
import * as path from "path"
import {
  EVAL_DIR,
  compareEvalResults,
  formatComparison,
  type EvalResult,
} from "./eval-store"

function load(file: string): EvalResult {
  return JSON.parse(fs.readFileSync(file, "utf-8")) as EvalResult
}

function main(): void {
  const args = process.argv.slice(2)
  let beforeFile: string
  let afterFile: string

  if (args.length >= 2) {
    ;[beforeFile, afterFile] = args
  } else {
    let files: string[]
    try {
      files = fs
        .readdirSync(EVAL_DIR)
        .filter(f => f.endsWith(".json") && !f.startsWith("_partial"))
        .map(f => path.join(EVAL_DIR, f))
        .sort((a, b) =>
          (load(b).timestamp || "").localeCompare(load(a).timestamp || "")
        )
    } catch {
      console.error(`No eval runs found in ${EVAL_DIR}`)
      process.exit(1)
    }
    if (files.length < 2) {
      console.error("Need at least two eval runs to compare.")
      process.exit(1)
    }
    afterFile = files[0]
    beforeFile = files[1]
  }

  const cmp = compareEvalResults(load(beforeFile), load(afterFile))
  process.stdout.write(formatComparison(cmp) + "\n")
}

main()
