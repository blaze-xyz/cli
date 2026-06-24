import * as fs from "node:fs"

import { isHeadless } from "../../cli/env.utils"

jest.mock("node:fs", () => ({
  existsSync: jest.fn().mockReturnValue(false),
}))

const mockExistsSync = fs.existsSync as jest.MockedFunction<
  typeof fs.existsSync
>

describe("isHeadless", () => {
  const HEADLESS_ENV_KEYS = [
    "CI",
    "SSH_CONNECTION",
    "SSH_TTY",
    "SSH_CLIENT",
    "CODESPACES",
    "GITPOD_WORKSPACE_ID",
    "CLOUD_SHELL",
    "REPL_ID",
    "DISPLAY",
    "WAYLAND_DISPLAY",
    "BROWSER",
  ]
  const savedEnv: Record<string, string | undefined> = {}
  const originalPlatform = process.platform
  const originalIsTTY = process.stdin.isTTY

  const setPlatform = (value: string) =>
    Object.defineProperty(process, "platform", { value, configurable: true })
  const setStdinTTY = (value: boolean) =>
    Object.defineProperty(process.stdin, "isTTY", { value, configurable: true })

  beforeEach(() => {
    jest.clearAllMocks()
    mockExistsSync.mockReturnValue(false)
    for (const k of HEADLESS_ENV_KEYS) {
      savedEnv[k] = process.env[k]
      delete process.env[k]
    }
    // Default to an interactive macOS desktop so each test isolates one signal.
    setPlatform("darwin")
    setStdinTTY(true)
  })

  afterEach(() => {
    for (const k of HEADLESS_ENV_KEYS) {
      if (savedEnv[k] === undefined) delete process.env[k]
      else process.env[k] = savedEnv[k]
    }
    setPlatform(originalPlatform)
    setStdinTTY(originalIsTTY as boolean)
  })

  it("returns false for an interactive desktop session", () => {
    expect(isHeadless()).toBe(false)
  })

  it("returns true when CI is set", () => {
    process.env.CI = "true"

    expect(isHeadless()).toBe(true)
  })

  it("returns true when stdin is not a TTY", () => {
    setStdinTTY(false)

    expect(isHeadless()).toBe(true)
  })

  it("returns true inside an SSH session", () => {
    process.env.SSH_CONNECTION = "10.0.0.1 5000 10.0.0.2 22"

    expect(isHeadless()).toBe(true)
  })

  it("returns true inside GitHub Codespaces", () => {
    process.env.CODESPACES = "true"

    expect(isHeadless()).toBe(true)
  })

  it("returns true inside Gitpod", () => {
    process.env.GITPOD_WORKSPACE_ID = "ws-123"

    expect(isHeadless()).toBe(true)
  })

  it("returns true in a cloud shell", () => {
    process.env.CLOUD_SHELL = "true"

    expect(isHeadless()).toBe(true)
  })

  it("returns true on Replit", () => {
    process.env.REPL_ID = "repl-123"

    expect(isHeadless()).toBe(true)
  })

  it("returns true inside a Docker container", () => {
    mockExistsSync.mockReturnValue(true)

    expect(isHeadless()).toBe(true)
  })

  it("returns true on Linux with no display server or browser", () => {
    setPlatform("linux")

    expect(isHeadless()).toBe(true)
  })

  it("returns false on Linux when a display server is present", () => {
    setPlatform("linux")
    process.env.DISPLAY = ":0"

    expect(isHeadless()).toBe(false)
  })
})
