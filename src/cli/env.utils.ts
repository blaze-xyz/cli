/**
 * Environment detection for the CLI.
 *
 * `isHeadless()` answers "is there no usable GUI browser here?" — used to decide
 * whether to try auto-opening a browser during `blaze auth`. No single signal is
 * reliable (a VS Code Remote-SSH terminal can have an empty `DISPLAY` yet still
 * complete a browser flow), so we combine a UNION of signals. The cost of a
 * false positive is tiny (we print the URL instead of opening it), so we lean
 * toward detecting headless.
 */
import * as fs from "node:fs"

/** True inside a Docker container (best-effort). */
function hasDockerEnv(): boolean {
  try {
    return fs.existsSync("/.dockerenv")
  } catch {
    return false
  }
}

/**
 * Detects a headless / remote / containerized environment where auto-opening a
 * browser won't reach the user (VPS over SSH, cloud IDEs, cloud agents, CI).
 */
export function isHeadless(): boolean {
  const env = process.env

  // CI is the strongest "no human at a GUI" signal.
  if (env.CI) return true

  // stdin not a terminal → piped / automated.
  if (!process.stdin.isTTY) return true

  // Remote shell.
  if (env.SSH_CONNECTION || env.SSH_TTY || env.SSH_CLIENT) return true

  // Cloud dev environments / agents.
  if (env.CODESPACES) return true
  if (env.GITPOD_WORKSPACE_ID) return true
  if (env.CLOUD_SHELL) return true
  if (env.REPL_ID) return true

  // Containers.
  if (hasDockerEnv()) return true

  // Linux with no display server and no configured browser → no GUI. Gated on
  // the full conjunction so it never fires on a desktop Linux session.
  if (
    process.platform === "linux" &&
    !env.DISPLAY &&
    !env.WAYLAND_DISPLAY &&
    !env.BROWSER
  ) {
    return true
  }

  return false
}
