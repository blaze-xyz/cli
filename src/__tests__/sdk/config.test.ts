import * as fs from "node:fs"
import * as path from "node:path"
import * as os from "node:os"
import {
  resolveApiKey,
  resolveBaseUrl,
  detectEnvironment,
  loadConfig,
  saveConfig,
} from "../../sdk/config"

jest.mock("node:fs")
const mockedFs = jest.mocked(fs)

describe("resolveApiKey", () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.BLAZE_API_KEY
    jest.resetAllMocks()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it("returns flag value when provided", () => {
    const result = resolveApiKey("sk_test_flag_value")
    expect(result).toBe("sk_test_flag_value")
  })

  it("returns BLAZE_API_KEY env var when no flag", () => {
    process.env.BLAZE_API_KEY = "sk_test_from_env"
    const result = resolveApiKey()
    expect(result).toBe("sk_test_from_env")
  })

  it("returns config file api_key when no flag or env var", () => {
    mockedFs.existsSync.mockReturnValue(true)
    mockedFs.readFileSync.mockReturnValue(
      JSON.stringify({ api_key: "sk_test_from_config" })
    )
    const result = resolveApiKey()
    expect(result).toBe("sk_test_from_config")
  })

  it("returns null when nothing is available", () => {
    mockedFs.existsSync.mockReturnValue(false)
    const result = resolveApiKey()
    expect(result).toBeNull()
  })
})

describe("resolveBaseUrl", () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.BLAZE_BASE_URL
    jest.resetAllMocks()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it("returns flag value when provided", () => {
    const result = resolveBaseUrl("https://custom.api.com")
    expect(result).toBe("https://custom.api.com")
  })

  it("returns BLAZE_BASE_URL env var when no flag", () => {
    process.env.BLAZE_BASE_URL = "https://staging.api.blaze.money"
    const result = resolveBaseUrl()
    expect(result).toBe("https://staging.api.blaze.money")
  })

  it("returns config file base_url when no flag or env", () => {
    mockedFs.existsSync.mockReturnValue(true)
    mockedFs.readFileSync.mockReturnValue(
      JSON.stringify({
        api_key: "sk_test_x",
        base_url: "https://config.api.com",
      })
    )
    const result = resolveBaseUrl()
    expect(result).toBe("https://config.api.com")
  })

  it('returns "https://api.blaze.money" as final default', () => {
    mockedFs.existsSync.mockReturnValue(false)
    const result = resolveBaseUrl()
    expect(result).toBe("https://api.blaze.money")
  })
})

describe("detectEnvironment", () => {
  it('returns "test" for "sk_test_abc123"', () => {
    expect(detectEnvironment("sk_test_abc123")).toBe("test")
  })

  it('returns "live" for "sk_live_abc123"', () => {
    expect(detectEnvironment("sk_live_abc123")).toBe("live")
  })

  it('returns "live" for any other prefix', () => {
    expect(detectEnvironment("sk_other_abc123")).toBe("live")
    expect(detectEnvironment("random_key_value")).toBe("live")
  })
})

describe("loadConfig", () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it("returns parsed config from valid JSON file", () => {
    mockedFs.existsSync.mockReturnValue(true)
    mockedFs.readFileSync.mockReturnValue(
      JSON.stringify({
        api_key: "sk_test_loaded",
        base_url: "https://example.com",
      })
    )

    const result = loadConfig()
    expect(result).toEqual({
      api_key: "sk_test_loaded",
      base_url: "https://example.com",
    })
  })

  it("returns null when file does not exist", () => {
    mockedFs.existsSync.mockReturnValue(false)

    const result = loadConfig()
    expect(result).toBeNull()
  })

  it("returns null on malformed JSON", () => {
    mockedFs.existsSync.mockReturnValue(true)
    mockedFs.readFileSync.mockReturnValue("not valid json {{{")

    const result = loadConfig()
    expect(result).toBeNull()
  })
})

describe("saveConfig", () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it("creates directory if it does not exist", () => {
    mockedFs.existsSync.mockReturnValue(false)
    mockedFs.mkdirSync.mockReturnValue(undefined)
    mockedFs.writeFileSync.mockReturnValue(undefined)

    saveConfig({ api_key: "sk_test_save" })

    expect(mockedFs.mkdirSync).toHaveBeenCalledWith(
      path.join(os.homedir(), ".blaze"),
      { recursive: true }
    )
  })

  it("writes JSON with 2-space indent and trailing newline", () => {
    mockedFs.existsSync.mockReturnValue(true)
    mockedFs.writeFileSync.mockReturnValue(undefined)

    const config = {
      api_key: "sk_test_write",
      base_url: "https://api.blaze.money",
    }
    saveConfig(config)

    const expectedPath = path.join(os.homedir(), ".blaze", "config.json")
    const expectedContent = JSON.stringify(config, null, 2) + "\n"
    expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
      expectedPath,
      expectedContent
    )
  })
})
