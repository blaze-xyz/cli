// chalk v5 is pure ESM and cannot be loaded by ts-jest's CommonJS output.
// buildNotice only uses chalk for styling, so mock it with identity color
// helpers — the assertions verify the plain content (versions + npm command),
// which the styling never alters.
jest.mock("chalk", () => {
  const identity = (text: string) => text
  const colors = {
    yellow: identity,
    dim: identity,
    green: identity,
    cyan: identity,
  }
  // Expose helpers at both the module root and under `default` so the mock
  // works whether the dynamic import resolves to the namespace or its default.
  return { ...colors, default: colors }
})

jest.mock("../../cli/update-cache", () => ({
  readUpdateCache: jest.fn(),
  writeUpdateCache: jest.fn(),
}))

jest.mock("@inquirer/prompts", () => ({
  __esModule: true,
  confirm: jest.fn(),
}))

jest.mock("ora", () => {
  const spinner = { succeed: jest.fn(), fail: jest.fn() }
  return {
    __esModule: true,
    default: jest.fn(() => ({ start: jest.fn(() => spinner) })),
  }
})

jest.mock("node:child_process", () => ({
  spawn: jest.fn(),
}))

import { spawn } from "node:child_process"

import { confirm } from "@inquirer/prompts"

import { readUpdateCache, writeUpdateCache } from "../../cli/update-cache"
import {
  buildNotice,
  checkForUpdates,
  isFastPathCommand,
  isJsonFormat,
  isNewerVersion,
  isNotifierDisabled,
} from "../../cli/update-notifier"

const mockReadCache = readUpdateCache as jest.MockedFunction<
  typeof readUpdateCache
>
const mockWriteCache = writeUpdateCache as jest.MockedFunction<
  typeof writeUpdateCache
>
const mockConfirm = confirm as unknown as jest.Mock
const mockSpawn = spawn as unknown as jest.Mock

/**
 * Builds a fake child process whose `close` listener fires synchronously with
 * the given exit code, so `runUpdate`'s promise resolves without a real spawn.
 */
function makeChild(closeCode: number): unknown {
  const child: {
    stderr: { on: jest.Mock }
    on: jest.Mock
    unref: jest.Mock
  } = {
    stderr: { on: jest.fn() },
    on: jest.fn((event: string, cb: (arg?: unknown) => void) => {
      if (event === "close") {
        cb(closeCode)
      }
      return child
    }),
    unref: jest.fn(),
  }
  return child
}

describe("isNewerVersion", () => {
  it("returns true when latest has a greater major version", () => {
    expect(isNewerVersion("2.0.0", "1.9.9")).toBe(true)
  })

  it("returns true when latest has a greater minor version", () => {
    expect(isNewerVersion("1.3.0", "1.2.9")).toBe(true)
  })

  it("returns true when latest has a greater patch version", () => {
    expect(isNewerVersion("1.2.4", "1.2.3")).toBe(true)
  })

  it("returns false when versions are equal", () => {
    expect(isNewerVersion("1.2.3", "1.2.3")).toBe(false)
  })

  it("returns false when latest is older than current", () => {
    expect(isNewerVersion("1.2.3", "1.3.0")).toBe(false)
  })

  it("returns true when current is a prerelease of the stable latest", () => {
    expect(isNewerVersion("1.2.0", "1.2.0-beta.1")).toBe(true)
  })

  it("returns false when latest is a prerelease of the stable current", () => {
    expect(isNewerVersion("1.2.0-beta.1", "1.2.0")).toBe(false)
  })

  it("returns false when latest version string is invalid", () => {
    expect(isNewerVersion("not-a-version", "1.2.3")).toBe(false)
  })

  it("returns false when current version string is invalid", () => {
    expect(isNewerVersion("1.2.3", "not-a-version")).toBe(false)
  })

  it("returns true when comparing v-prefixed versions", () => {
    expect(isNewerVersion("v2.0.0", "v1.0.0")).toBe(true)
  })
})

describe("isJsonFormat", () => {
  it("returns true when argv contains --json", () => {
    expect(isJsonFormat(["node", "blaze", "send", "--json"])).toBe(true)
  })

  it("returns true when argv contains --format=json", () => {
    expect(isJsonFormat(["node", "blaze", "send", "--format=json"])).toBe(true)
  })

  it("returns true when argv contains --format json as separate args", () => {
    expect(isJsonFormat(["node", "blaze", "send", "--format", "json"])).toBe(
      true
    )
  })

  it("returns true when --format value is uppercase JSON", () => {
    expect(isJsonFormat(["node", "blaze", "send", "--format", "JSON"])).toBe(
      true
    )
  })

  it("returns false when argv requests table format", () => {
    expect(isJsonFormat(["node", "blaze", "send", "--format", "table"])).toBe(
      false
    )
  })

  it("returns false when argv contains no format flag", () => {
    expect(isJsonFormat(["node", "blaze", "send", "@bossman"])).toBe(false)
  })
})

describe("isNotifierDisabled", () => {
  const originalEnv = process.env
  const originalIsTTY = process.stdout.isTTY

  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.CI
    delete process.env.NO_UPDATE_NOTIFIER
    Object.defineProperty(process.stdout, "isTTY", {
      value: true,
      configurable: true,
    })
  })

  afterEach(() => {
    process.env = originalEnv
    Object.defineProperty(process.stdout, "isTTY", {
      value: originalIsTTY,
      configurable: true,
    })
  })

  it("returns false when stdout is a TTY and no suppression applies", () => {
    expect(isNotifierDisabled(["node", "blaze", "send"])).toBe(false)
  })

  it("returns true when stdout is not a TTY", () => {
    Object.defineProperty(process.stdout, "isTTY", {
      value: false,
      configurable: true,
    })
    expect(isNotifierDisabled(["node", "blaze", "send"])).toBe(true)
  })

  it("returns true when CI env var is set", () => {
    process.env.CI = "true"
    expect(isNotifierDisabled(["node", "blaze", "send"])).toBe(true)
  })

  it("returns true when NO_UPDATE_NOTIFIER env var is set", () => {
    process.env.NO_UPDATE_NOTIFIER = "1"
    expect(isNotifierDisabled(["node", "blaze", "send"])).toBe(true)
  })

  it("returns true when argv requests json format", () => {
    expect(isNotifierDisabled(["node", "blaze", "send", "--json"])).toBe(true)
  })
})

describe("buildNotice", () => {
  it("returns a notice containing both versions and the npm install command", async () => {
    const notice = await buildNotice("1.2.3", "1.3.0", "@blaze-money/cli")

    expect(notice).toContain("1.2.3")
    expect(notice).toContain("1.3.0")
    expect(notice).toContain("npm i -g @blaze-money/cli")
  })
})

describe("isFastPathCommand", () => {
  it("returns true for the mcp subcommand", () => {
    expect(isFastPathCommand(["node", "blaze", "mcp"])).toBe(true)
  })

  it("returns true when --version is present", () => {
    expect(isFastPathCommand(["node", "blaze", "--version"])).toBe(true)
  })

  it("returns true when -V is present", () => {
    expect(isFastPathCommand(["node", "blaze", "-V"])).toBe(true)
  })

  it("returns true when --help is present", () => {
    expect(isFastPathCommand(["node", "blaze", "balance", "--help"])).toBe(true)
  })

  it("returns false for a normal command", () => {
    expect(isFastPathCommand(["node", "blaze", "balance"])).toBe(false)
  })
})

describe("checkForUpdates", () => {
  const OPTS = {
    name: "@blaze-money/cli",
    version: "1.2.0",
    argv: ["node", "blaze", "balance"],
  }
  const originalEnv = process.env
  const originalStdoutTTY = process.stdout.isTTY
  const originalStdinTTY = process.stdin.isTTY

  let exitSpy: jest.SpyInstance
  let stdoutSpy: jest.SpyInstance
  let stderrSpy: jest.SpyInstance

  const setTTY = (
    stream: NodeJS.WriteStream | NodeJS.ReadStream,
    value: boolean
  ) => Object.defineProperty(stream, "isTTY", { value, configurable: true })

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...originalEnv }
    delete process.env.CI
    delete process.env.NO_UPDATE_NOTIFIER
    setTTY(process.stdout, true)
    setTTY(process.stdin, true)
    exitSpy = jest.spyOn(process, "exit").mockImplementation(((): never => {
      throw new Error("__exit__")
    }) as never)
    stdoutSpy = jest
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true)
    stderrSpy = jest
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true)
    mockReadCache.mockResolvedValue({
      lastCheck: Date.now(),
      latest: "1.3.0",
      current: "1.2.0",
    })
    mockConfirm.mockResolvedValue(false)
    mockSpawn.mockImplementation(() => makeChild(0))
  })

  afterEach(() => {
    process.env = originalEnv
    setTTY(process.stdout, originalStdoutTTY)
    setTTY(process.stdin, originalStdinTTY)
    exitSpy.mockRestore()
    stdoutSpy.mockRestore()
    stderrSpy.mockRestore()
  })

  it("prompts the user when a newer version is cached", async () => {
    await checkForUpdates(OPTS)

    expect(mockConfirm).toHaveBeenCalledTimes(1)
  })

  it("does not prompt when no newer version is cached", async () => {
    mockReadCache.mockResolvedValue({
      lastCheck: Date.now(),
      latest: "1.2.0",
      current: "1.2.0",
    })

    await checkForUpdates(OPTS)

    expect(mockConfirm).not.toHaveBeenCalled()
  })

  it("does not prompt when the latest version was already dismissed", async () => {
    mockReadCache.mockResolvedValue({
      lastCheck: Date.now(),
      latest: "1.3.0",
      current: "1.2.0",
      dismissedVersion: "1.3.0",
    })

    await checkForUpdates(OPTS)

    expect(mockConfirm).not.toHaveBeenCalled()
  })

  it("does not prompt on a fast-path command even when an update exists", async () => {
    await checkForUpdates({ ...OPTS, argv: ["node", "blaze", "mcp"] })

    expect(mockConfirm).not.toHaveBeenCalled()
  })

  it("does not prompt in CI", async () => {
    process.env.CI = "true"

    await checkForUpdates(OPTS)

    expect(mockConfirm).not.toHaveBeenCalled()
  })

  it("runs npm install with the latest version and exits when the user accepts", async () => {
    mockConfirm.mockResolvedValue(true)

    await checkForUpdates(OPTS)

    expect(mockSpawn).toHaveBeenCalledWith(
      "npm",
      ["install", "-g", "@blaze-money/cli@latest"],
      expect.any(Object)
    )
    expect(exitSpy).toHaveBeenCalledWith(0)
    expect(mockWriteCache).not.toHaveBeenCalled()
  })

  it("persists the dismissed version and does not install when the user declines", async () => {
    mockConfirm.mockResolvedValue(false)

    await checkForUpdates(OPTS)

    expect(mockSpawn).not.toHaveBeenCalled()
    expect(mockWriteCache).toHaveBeenCalledWith(
      expect.objectContaining({ dismissedVersion: "1.3.0", latest: "1.3.0" })
    )
  })
})
