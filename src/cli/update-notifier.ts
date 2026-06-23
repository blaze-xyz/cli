/**
 * CLI update notifier.
 *
 * Gives users an npm-style "update available" prompt when a newer version of
 * the CLI is published, without ever slowing down or breaking their command.
 *
 * How it works (mirrors npm/yarn's `update-notifier`):
 *   1. On startup we read a locally cached "latest version" (instant, no I/O
 *      beyond a local config read). If it's newer than what's installed, we
 *      queue a notice to print at process exit — after the command's own output
 *      and to stderr, so piped/JSON stdout is never polluted.
 *   2. If that cache is older than the check interval (24h default), we spawn a
 *      DETACHED, unref'd background process to refresh it from the npm registry.
 *      The current command does not wait for it. The result surfaces next run.
 *
 * Suppressed automatically for non-interactive use (piped output, CI,
 * `--format json`/`--json`) and via the standard `NO_UPDATE_NOTIFIER`
 * opt-out env var.
 */
import { spawn } from "node:child_process"
import path from "node:path"

import { readUpdateCache } from "./update-cache"

/** Minimal structural type for the chalk color helpers we use. */
type ColorFn = (text: string) => string
interface ChalkLike {
  yellow: ColorFn
  dim: ColorFn
  green: ColorFn
  cyan: ColorFn
}

const DAY_MS = 1000 * 60 * 60 * 24
const DEFAULT_INTERVAL_MS = DAY_MS

export interface CheckForUpdatesOptions {
  /** Package name to check on the registry (e.g. "@blaze-money/cli"). */
  name: string
  /** Currently installed version. */
  version: string
  /** Argv to inspect for output-format flags (defaults to process.argv). */
  argv?: string[]
}

/**
 * Entry point — call once during CLI startup, before parsing commands.
 * Resolves quickly and never throws.
 */
export async function checkForUpdates(
  opts: CheckForUpdatesOptions
): Promise<void> {
  try {
    const argv = opts.argv ?? process.argv
    if (isNotifierDisabled(argv)) return

    const cache = await readUpdateCache()

    // 1) Surface a known newer version (cheap, from local cache).
    if (cache?.latest && isNewerVersion(cache.latest, opts.version)) {
      const notice = await buildNotice(opts.version, cache.latest, opts.name)
      registerExitNotice(notice)
    }

    // 2) Refresh the cache in the background if it's stale.
    const interval = getIntervalMs()
    const isStale = !cache || Date.now() - cache.lastCheck > interval
    if (isStale) {
      spawnBackgroundCheck(opts.name, opts.version)
    }
  } catch {
    // The update check must never affect the CLI. Swallow everything.
  }
}

/**
 * Returns true when the notifier should stay silent: non-interactive output,
 * CI, machine-readable formats, or an explicit opt-out.
 */
export function isNotifierDisabled(argv: string[]): boolean {
  if (!process.stdout.isTTY) return true
  if (process.env.CI) return true
  if (process.env.NO_UPDATE_NOTIFIER) return true
  if (isJsonFormat(argv)) return true
  return false
}

/** Detects `--format json`, `--format=json`, or `--json` in argv. */
export function isJsonFormat(argv: string[]): boolean {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === "--json") return true
    if (arg === "--format=json") return true
    if (arg === "--format" && argv[i + 1]?.toLowerCase() === "json") return true
  }
  return false
}

/**
 * Semantic-version "is `latest` newer than `current`?" comparison.
 *
 * Compares major/minor/patch numerically. A prerelease build is treated as
 * older than its release, so a user on `1.2.0-beta.1` is prompted to move to
 * `1.2.0`, but a stable user is never nagged toward a prerelease.
 */
export function isNewerVersion(latest: string, current: string): boolean {
  const l = parseVersion(latest)
  const c = parseVersion(current)
  if (!l || !c) return false

  if (l.major !== c.major) return l.major > c.major
  if (l.minor !== c.minor) return l.minor > c.minor
  if (l.patch !== c.patch) return l.patch > c.patch

  // Equal release core: latest is "newer" only if the user is on a prerelease
  // of it and latest is the stable release.
  return !!c.prerelease && !l.prerelease
}

interface ParsedVersion {
  major: number
  minor: number
  patch: number
  prerelease: string | null
}

function parseVersion(value: string): ParsedVersion | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/.exec(
    value.trim()
  )
  if (!match) return null
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ?? null,
  }
}

function getIntervalMs(): number {
  const raw = process.env.BLAZE_UPDATE_CHECK_INTERVAL_MS
  const parsed = raw ? Number(raw) : NaN
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_INTERVAL_MS
}

let exitNoticeRegistered = false

function registerExitNotice(notice: string): void {
  if (exitNoticeRegistered) return
  exitNoticeRegistered = true
  process.once("exit", () => {
    try {
      // stderr so it never mingles with the command's stdout (pipes/JSON).
      process.stderr.write(notice)
    } catch {
      // ignore
    }
  })
}

function spawnBackgroundCheck(name: string, version: string): void {
  try {
    const workerPath = path.join(__dirname, "update-check-worker.js")
    const child = spawn(process.execPath, [workerPath, name, version], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    })
    // Never let a failed spawn bubble up, and don't keep the event loop alive.
    child.on("error", () => {})
    child.unref()
  } catch {
    // ignore — background refresh is best-effort
  }
}

/** Builds the styled, npm-style notification box (returns the full string). */
export async function buildNotice(
  current: string,
  latest: string,
  name: string
): Promise<string> {
  const chalk = (await import("chalk")).default as ChalkLike
  const updateCmd = `npm i -g ${name}`

  const lines: BoxLine[] = [
    {
      plain: `Update available ${current} → ${latest}`,
      styled: `Update available ${chalk.dim(current)} ${chalk.dim("→")} ${chalk.green(latest)}`,
    },
    {
      plain: `Run ${updateCmd} to update`,
      styled: `Run ${chalk.cyan(updateCmd)} to update`,
    },
  ]

  return renderBox(lines, chalk)
}

interface BoxLine {
  plain: string
  styled: string
}

function renderBox(lines: BoxLine[], chalk: ChalkLike): string {
  const PAD = 2
  const contentWidth = Math.max(...lines.map(line => line.plain.length))
  const innerWidth = contentWidth + PAD * 2
  const border = chalk.yellow

  const top = border("╭" + "─".repeat(innerWidth) + "╮")
  const bottom = border("╰" + "─".repeat(innerWidth) + "╯")
  const blank = border("│") + " ".repeat(innerWidth) + border("│")

  const body = lines.map(line => {
    const trailing = contentWidth - line.plain.length
    return (
      border("│") +
      " ".repeat(PAD) +
      line.styled +
      " ".repeat(PAD + trailing) +
      border("│")
    )
  })

  const indented = [top, blank, ...body, blank, bottom].map(row => "  " + row)
  return "\n" + indented.join("\n") + "\n\n"
}
