import {
  resolveContextHeaders,
  resolveCredential,
} from "../../cli/auth-context"
import { getAuthToken } from "../../cli/auth-utils"
import { loadConfig, resolveConfigApiKey } from "../../sdk/config"

jest.mock("../../cli/auth-utils", () => ({
  getAuthToken: jest.fn(),
}))

jest.mock("../../sdk/config", () => ({
  loadConfig: jest.fn(),
  resolveConfigApiKey: jest.fn(),
}))

const mockGetAuthToken = getAuthToken as jest.MockedFunction<
  typeof getAuthToken
>
const mockLoadConfig = loadConfig as jest.MockedFunction<typeof loadConfig>
const mockResolveConfigApiKey = resolveConfigApiKey as jest.MockedFunction<
  typeof resolveConfigApiKey
>

/** Saves, clears, and restores the given env vars around each test. */
function manageEnv(keys: string[]) {
  const saved: Record<string, string | undefined> = {}
  return {
    clear: () => {
      for (const k of keys) {
        saved[k] = process.env[k]
        delete process.env[k]
      }
    },
    restore: () => {
      for (const k of keys) {
        if (saved[k] === undefined) delete process.env[k]
        else process.env[k] = saved[k]
      }
    },
  }
}

describe("resolveCredential", () => {
  const env = manageEnv(["BLAZE_TOKEN", "BLAZE_API_KEY"])

  beforeEach(() => {
    jest.clearAllMocks()
    env.clear()
    mockGetAuthToken.mockResolvedValue(null)
    mockResolveConfigApiKey.mockReturnValue(null)
  })

  afterEach(() => {
    env.restore()
  })

  it("returns the bearer token from the --token flag above all other sources", async () => {
    process.env.BLAZE_TOKEN = "env_jwt"
    process.env.BLAZE_API_KEY = "sk_env"
    mockGetAuthToken.mockResolvedValue("stored_jwt")

    const result = await resolveCredential({ token: "flag_jwt" })

    expect(result).toEqual({ kind: "bearer", token: "flag_jwt" })
  })

  it("returns the api key from the --api-key flag when no --token flag is set", async () => {
    process.env.BLAZE_TOKEN = "env_jwt"

    const result = await resolveCredential({ apiKey: "sk_flag" })

    expect(result).toEqual({ kind: "apiKey", apiKey: "sk_flag" })
  })

  it("throws when both --token and --api-key flags are provided", async () => {
    await expect(
      resolveCredential({ token: "flag_jwt", apiKey: "sk_flag" })
    ).rejects.toThrow("Provide either --token or --api-key, not both.")
  })

  it("returns the bearer token from BLAZE_TOKEN over BLAZE_API_KEY", async () => {
    process.env.BLAZE_TOKEN = "env_jwt"
    process.env.BLAZE_API_KEY = "sk_env"

    const result = await resolveCredential()

    expect(result).toEqual({ kind: "bearer", token: "env_jwt" })
  })

  it("returns the api key from BLAZE_API_KEY when no token source is set", async () => {
    process.env.BLAZE_API_KEY = "sk_env"
    mockGetAuthToken.mockResolvedValue("stored_jwt")

    const result = await resolveCredential()

    expect(result).toEqual({ kind: "apiKey", apiKey: "sk_env" })
  })

  it("returns the stored bearer session when no flags or env vars are set", async () => {
    mockGetAuthToken.mockResolvedValue("stored_jwt")
    mockResolveConfigApiKey.mockReturnValue("sk_config")

    const result = await resolveCredential()

    expect(result).toEqual({ kind: "bearer", token: "stored_jwt" })
  })

  it("returns the config-file api key when nothing else is set", async () => {
    mockResolveConfigApiKey.mockReturnValue("sk_config")

    const result = await resolveCredential()

    expect(result).toEqual({ kind: "apiKey", apiKey: "sk_config" })
  })

  it("returns null when no credential is configured", async () => {
    const result = await resolveCredential()

    expect(result).toBeNull()
  })

  it("trims surrounding whitespace from BLAZE_TOKEN", async () => {
    process.env.BLAZE_TOKEN = "  jwt_with_newline\n"

    const result = await resolveCredential()

    expect(result).toEqual({ kind: "bearer", token: "jwt_with_newline" })
  })

  it("treats a whitespace-only --token as absent and falls through", async () => {
    process.env.BLAZE_API_KEY = "sk_env"

    const result = await resolveCredential({ token: "   " })

    expect(result).toEqual({ kind: "apiKey", apiKey: "sk_env" })
  })

  it("does not flag a conflict when --api-key is whitespace-only", async () => {
    const result = await resolveCredential({ token: "jwt", apiKey: "  " })

    expect(result).toEqual({ kind: "bearer", token: "jwt" })
  })
})

describe("resolveContextHeaders", () => {
  const env = manageEnv(["BLAZE_BUSINESS_ID", "BLAZE_PERSONAL"])

  beforeEach(() => {
    jest.clearAllMocks()
    env.clear()
    mockLoadConfig.mockReturnValue(null)
  })

  afterEach(() => {
    env.restore()
  })

  it("returns undefined when no context is configured", () => {
    expect(resolveContextHeaders()).toBeUndefined()
  })

  it("sends x-business-id from the persisted activeBusinessId", () => {
    mockLoadConfig.mockReturnValue({ api_key: "", activeBusinessId: "biz_cfg" })

    expect(resolveContextHeaders()).toEqual({ "x-business-id": "biz_cfg" })
  })

  it("sends x-business-id from BLAZE_BUSINESS_ID over the persisted business", () => {
    process.env.BLAZE_BUSINESS_ID = "biz_env"
    mockLoadConfig.mockReturnValue({ api_key: "", activeBusinessId: "biz_cfg" })

    expect(resolveContextHeaders()).toEqual({ "x-business-id": "biz_env" })
  })

  it("sends x-business-id from the --business flag over env and config", () => {
    process.env.BLAZE_BUSINESS_ID = "biz_env"
    mockLoadConfig.mockReturnValue({ api_key: "", activeBusinessId: "biz_cfg" })

    expect(resolveContextHeaders({ business: "biz_flag" })).toEqual({
      "x-business-id": "biz_flag",
    })
  })

  it("sends x-blaze-personal from the --personal flag over any business", () => {
    process.env.BLAZE_BUSINESS_ID = "biz_env"
    mockLoadConfig.mockReturnValue({ api_key: "", activeBusinessId: "biz_cfg" })

    expect(resolveContextHeaders({ personal: true })).toEqual({
      "x-blaze-personal": "true",
    })
  })

  it("sends x-blaze-personal when BLAZE_PERSONAL is true over any business override", () => {
    process.env.BLAZE_PERSONAL = "true"
    process.env.BLAZE_BUSINESS_ID = "biz_env"

    expect(resolveContextHeaders()).toEqual({ "x-blaze-personal": "true" })
  })

  it("sends x-blaze-personal when BLAZE_PERSONAL is 1", () => {
    process.env.BLAZE_PERSONAL = "1"

    expect(resolveContextHeaders()).toEqual({ "x-blaze-personal": "true" })
  })

  it("ignores BLAZE_PERSONAL when it is not a truthy value", () => {
    process.env.BLAZE_PERSONAL = "false"
    process.env.BLAZE_BUSINESS_ID = "biz_env"

    expect(resolveContextHeaders()).toEqual({ "x-business-id": "biz_env" })
  })

  it("trims surrounding whitespace from BLAZE_BUSINESS_ID", () => {
    process.env.BLAZE_BUSINESS_ID = "  biz_env\n"

    expect(resolveContextHeaders()).toEqual({ "x-business-id": "biz_env" })
  })
})
