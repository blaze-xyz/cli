/**
 * Persistent cache for the CLI update notifier.
 *
 * Stored inside the existing `blaze-cli` config store (same file used for auth)
 * under the `updateCheck` key, so we don't create a second config file.
 *
 * This module deliberately has NO heavy dependencies (no chalk, no SDK) so the
 * background worker that writes the cache stays lean and fast to spawn.
 */

export interface UpdateCheckCache {
  /** Epoch ms of the last completed background registry check. */
  lastCheck: number
  /** Latest version seen on the registry (preserved across failed checks). */
  latest?: string
  /** The installed version at the time of the last check. */
  current?: string
  /**
   * A version the user explicitly declined to update to at the prompt. We won't
   * prompt again for this exact version — only once a newer one is published.
   */
  dismissedVersion?: string
}

interface ConfigStore {
  get(key: string): unknown
  set(key: string, value: unknown): void
  delete(key: string): void
}

export const CACHE_KEY = "updateCheck"

let configInstance: ConfigStore | null = null

async function getConfig(): Promise<ConfigStore> {
  if (!configInstance) {
    const ConfModule = (await import("conf")).default
    configInstance = new ConfModule({
      projectName: "blaze-cli",
      configName: "config",
    }) as ConfigStore
  }
  return configInstance
}

export async function readUpdateCache(): Promise<UpdateCheckCache | null> {
  try {
    const config = await getConfig()
    return (config.get(CACHE_KEY) as UpdateCheckCache | undefined) ?? null
  } catch {
    // Best-effort — a missing/corrupt cache must never break the CLI.
    return null
  }
}

export async function writeUpdateCache(cache: UpdateCheckCache): Promise<void> {
  try {
    const config = await getConfig()
    config.set(CACHE_KEY, cache)
  } catch {
    // Best-effort — failing to persist the cache is non-fatal.
  }
}
