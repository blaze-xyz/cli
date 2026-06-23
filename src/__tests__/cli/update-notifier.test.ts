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

import {
  buildNotice,
  isJsonFormat,
  isNewerVersion,
  isNotifierDisabled,
} from "../../cli/update-notifier"

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
