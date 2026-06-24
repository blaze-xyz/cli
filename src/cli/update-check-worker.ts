#!/usr/bin/env node
/**
 * Background update-check worker.
 *
 * Spawned detached + unref'd by the update notifier so the network round-trip
 * to the npm registry never blocks or slows the user's command. It fetches the
 * latest published version, writes it to the shared cache, and exits. The notice
 * is rendered from that cache on the *next* CLI invocation (npm-style).
 *
 * Invoked as:  node dist/cli/update-check-worker.js <packageName> <currentVersion>
 *
 * All failures are silent: this process must never surface output or a non-zero
 * exit code to the user's terminal.
 */
import { readUpdateCache, writeUpdateCache } from "./update-cache"

const DEFAULT_REGISTRY = "https://registry.npmjs.org"
const TIMEOUT_MS = 8000

async function fetchLatestVersion(name: string): Promise<string | undefined> {
  const registry = (process.env.BLAZE_NPM_REGISTRY || DEFAULT_REGISTRY).replace(
    /\/$/,
    ""
  )
  const url = `${registry}/${encodeURIComponent(name)}/latest`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    })
    if (!res.ok) return undefined
    const body = (await res.json()) as { version?: unknown }
    return typeof body?.version === "string" ? body.version : undefined
  } catch {
    return undefined
  } finally {
    clearTimeout(timer)
  }
}

async function main(): Promise<void> {
  const name = process.argv[2]
  const current = process.argv[3]
  if (!name) return

  const latest = await fetchLatestVersion(name)
  const prev = await readUpdateCache()

  await writeUpdateCache({
    lastCheck: Date.now(),
    // Preserve the previously-known latest if this check couldn't reach the
    // registry, so transient network failures don't silence the notifier.
    latest: latest ?? prev?.latest,
    current,
    // Preserve a prior prompt dismissal so refreshing the cache never causes
    // the user to be re-prompted for a version they already declined.
    dismissedVersion: prev?.dismissedVersion,
  })
}

main()
  .then(() => process.exit(0))
  .catch(() => process.exit(0))
