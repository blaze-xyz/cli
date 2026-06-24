/**
 * CLI update notifier.
 *
 * Gives users an interactive "a new version is available — update now?" prompt
 * when a newer version of the CLI is published, without ever slowing down or
 * breaking automated/non-interactive use.
 *
 * How it works:
 *   1. A locally cached "latest version" is kept fresh by a DETACHED, unref'd
 *      background process that refreshes it from the npm registry at most once
 *      per check interval (24h default). The current command never waits for it
 *      (the npm/`update-notifier` pattern), so startup is never slowed.
 *   2. On startup we read that cache. If it shows a newer version than what's
 *      installed, we prompt the user `y/N`. On "yes" we run `npm i -g <pkg>` for
 *      them and exit so they can re-run on the new version. On "no" we remember
 *      the declined version so we don't ask again until a newer one ships.
 *
 * The prompt is suppressed automatically for non-interactive use (piped output,
 * CI, `--format json`/`--json`), on fast paths (`--version`/`--help`/`mcp`), and
 * via the standard `NO_UPDATE_NOTIFIER` opt-out env var. When stdout is a TTY
 * but stdin is not (so a prompt can't be answered), we fall back to a passive
 * stderr notice instead.
 */
import { spawn } from "node:child_process"
import path from "node:path"

import { readUpdateCache, writeUpdateCache } from "./update-cache"

/**
 * Default answer for the update prompt. `false` means hitting Enter skips the
 * update (shown as `y/N`), so a stray keystroke never triggers a global install.
 * Flip to `true` to make Enter accept (`Y/n`).
 */
const PROMPT_DEFAULT_ACCEPT = false

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
    if (isFastPathCommand(argv)) return

    const cache = await readUpdateCache()

    // 1) Refresh the cache in the background if it's stale (never blocks).
    const interval = getIntervalMs()
    const isStale = !cache || Date.now() - cache.lastCheck > interval
    if (isStale) {
      spawnBackgroundCheck(opts.name, opts.version)
    }

    // 2) Nothing newer known locally → nothing to do this run.
    const latest = cache?.latest
    if (!latest || !isNewerVersion(latest, opts.version)) return

    // 3) Respect a prior "no" for this exact version — don't nag every command.
    if (cache?.dismissedVersion === latest) return

    // 4) Can't run an interactive prompt without a TTY stdin (e.g. stdin piped):
    //    fall back to a passive stderr notice so the user still learns of it.
    if (!process.stdin.isTTY) {
      registerExitNotice(await buildNotice(opts.version, latest, opts.name))
      return
    }

    // 5) Prompt, and act on the answer.
    const accepted = await promptForUpdate(opts.version, latest)

    if (accepted) {
      const updated = await runUpdate(opts.name, latest)
      if (updated) {
        process.stdout.write(
          `You're all set on v${latest}. Re-run your command to pick it up.\n\n`
        )
        process.exit(0)
      }
      // Update failed — show how to do it by hand, then let their command run.
      process.stderr.write(
        `\nCouldn't update automatically. Run npm i -g ${opts.name} to update manually.\n\n`
      )
      return
    }

    // Declined — remember this version so we don't ask again until a newer one.
    await writeUpdateCache({
      lastCheck: cache?.lastCheck ?? Date.now(),
      latest,
      current: opts.version,
      dismissedVersion: latest,
    })
  } catch {
    // The update check must never affect the CLI. Swallow everything.
  }
}

/**
 * Prompts the user to update now. Returns true if they accept. A cancelled
 * prompt (Ctrl-C) is treated as "no" so the CLI never crashes on the prompt.
 */
async function promptForUpdate(
  current: string,
  latest: string
): Promise<boolean> {
  try {
    const chalk = (await import("chalk")).default as ChalkLike
    const { confirm } = await import("@inquirer/prompts")

    // A short, friendly heading carries the version detail (in color) so the
    // question itself can stay a clean one-liner.
    process.stdout.write(
      `\n✨ Blaze CLI ${chalk.green(`v${latest}`)} is available ` +
        `${chalk.dim(`— you're on v${current}`)}\n`
    )

    return await confirm({
      message: "Update now?",
      default: PROMPT_DEFAULT_ACCEPT,
    })
  } catch {
    // Ctrl-C / non-interactive stdin / any prompt error → treat as declined.
    return false
  }
}

/**
 * Runs `npm install -g <name>@latest` with a spinner. Returns true on success.
 * Never throws — a failed self-update must not break the user's command.
 */
async function runUpdate(name: string, latest: string): Promise<boolean> {
  const ora = (await import("ora")).default
  const spinner = ora({
    text: `Updating to v${latest}…`,
    color: "cyan",
  }).start()

  return await new Promise<boolean>(resolve => {
    try {
      const child = spawn("npm", ["install", "-g", `${name}@latest`], {
        stdio: ["ignore", "ignore", "pipe"],
        // npm is a .cmd shim on Windows and must be run via the shell there.
        shell: process.platform === "win32",
        windowsHide: true,
      })

      let stderr = ""
      child.stderr?.on("data", chunk => {
        stderr += String(chunk)
      })
      child.on("error", () => {
        spinner.fail("Update failed.")
        resolve(false)
      })
      child.on("close", code => {
        if (code === 0) {
          spinner.succeed(`Updated to v${latest} 🎉`)
          resolve(true)
          return
        }
        spinner.fail("Update didn't go through.")
        const tail = stderr.trim().split("\n").slice(-3).join("\n")
        if (tail) process.stderr.write(`${tail}\n`)
        resolve(false)
      })
    } catch {
      spinner.fail("Update failed.")
      resolve(false)
    }
  })
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

/**
 * Fast paths where we must never inject an interactive prompt: `--version` and
 * `--help` should stay instant, and `mcp` runs a stdio server for a machine
 * client that would hang on a prompt.
 */
export function isFastPathCommand(argv: string[]): boolean {
  const args = argv.slice(2)
  if (args[0] === "mcp") return true
  return args.some(
    arg =>
      arg === "-V" || arg === "--version" || arg === "-h" || arg === "--help"
  )
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
