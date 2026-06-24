import {
  getClient,
  personalAccountLabel,
  requireBusinessContext,
} from "../../cli/utils"
import { getAuthToken } from "../../cli/auth-utils"
import {
  loadConfig,
  resolveApiKey,
  resolveConfigApiKey,
} from "../../sdk/config"

jest.mock("../../cli/auth-utils", () => ({
  getAuthToken: jest.fn(),
}))

jest.mock("../../sdk/config", () => ({
  loadConfig: jest.fn(),
  saveConfig: jest.fn(),
  resolveApiKey: jest.fn(),
  resolveConfigApiKey: jest.fn(),
  resolveBaseUrl: jest.fn().mockReturnValue("https://api.blaze.money"),
}))

const mockGetAuthToken = getAuthToken as jest.MockedFunction<
  typeof getAuthToken
>
const mockLoadConfig = loadConfig as jest.MockedFunction<typeof loadConfig>
const mockResolveApiKey = resolveApiKey as jest.MockedFunction<
  typeof resolveApiKey
>
const mockResolveConfigApiKey = resolveConfigApiKey as jest.MockedFunction<
  typeof resolveConfigApiKey
>

// defaultHeaders is private on BlazeClient; read it via a narrow cast so the
// test can assert exactly which context headers the CLI attaches.
function readDefaultHeaders(client: unknown): Record<string, string> {
  return (client as { defaultHeaders: Record<string, string> }).defaultHeaders
}

// Credential precedence reads BLAZE_* env vars — clear them around every test so
// ambient developer/CI env can't make these deterministic tests flaky.
const BLAZE_ENV_KEYS = [
  "BLAZE_TOKEN",
  "BLAZE_API_KEY",
  "BLAZE_BUSINESS_ID",
  "BLAZE_PERSONAL",
]
const savedBlazeEnv: Record<string, string | undefined> = {}

beforeEach(() => {
  for (const k of BLAZE_ENV_KEYS) {
    savedBlazeEnv[k] = process.env[k]
    delete process.env[k]
  }
})

afterEach(() => {
  for (const k of BLAZE_ENV_KEYS) {
    if (savedBlazeEnv[k] === undefined) delete process.env[k]
    else process.env[k] = savedBlazeEnv[k]
  }
})

describe("getClient", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockResolveApiKey.mockReturnValue(null)
    mockResolveConfigApiKey.mockReturnValue(null)
    mockLoadConfig.mockReturnValue(null)
  })

  it("sends x-blaze-personal when authenticated via bearer token with no business selected", async () => {
    mockResolveApiKey.mockReturnValue(null)
    mockGetAuthToken.mockResolvedValue("bearer_token_abc")
    mockLoadConfig.mockReturnValue(null)

    const client = await getClient({})

    const headers = readDefaultHeaders(client)
    expect(headers["x-blaze-personal"]).toBe("true")
    expect(headers["x-business-id"]).toBeUndefined()
  })

  it("sends x-business-id and omits x-blaze-personal when an active business is selected via config", async () => {
    mockResolveApiKey.mockReturnValue(null)
    mockGetAuthToken.mockResolvedValue("bearer_token_abc")
    mockLoadConfig.mockReturnValue({
      api_key: "",
      activeBusinessId: "biz_456",
    })

    const client = await getClient({})

    const headers = readDefaultHeaders(client)
    expect(headers["x-business-id"]).toBe("biz_456")
    expect(headers["x-blaze-personal"]).toBeUndefined()
  })

  it("sends x-business-id and omits x-blaze-personal when --business flag is passed", async () => {
    mockResolveApiKey.mockReturnValue(null)
    mockGetAuthToken.mockResolvedValue("bearer_token_abc")
    mockLoadConfig.mockReturnValue(null)

    const client = await getClient({ business: "biz_789" })

    const headers = readDefaultHeaders(client)
    expect(headers["x-business-id"]).toBe("biz_789")
    expect(headers["x-blaze-personal"]).toBeUndefined()
  })

  it("does not inject x-blaze-personal on the explicit API-key path", async () => {
    mockResolveApiKey.mockReturnValue("sk_test_explicit")
    mockGetAuthToken.mockResolvedValue("bearer_token_abc")
    mockLoadConfig.mockReturnValue(null)

    const client = await getClient({ apiKey: "sk_test_explicit" })

    const headers = readDefaultHeaders(client)
    expect(headers["x-blaze-personal"]).toBeUndefined()
    expect(headers["x-business-id"]).toBeUndefined()
  })

  it("sends x-business-id from BLAZE_BUSINESS_ID when authenticated via BLAZE_TOKEN", async () => {
    process.env.BLAZE_TOKEN = "env_jwt"
    process.env.BLAZE_BUSINESS_ID = "biz_env"
    mockLoadConfig.mockReturnValue(null)

    const client = await getClient({})

    const headers = readDefaultHeaders(client)
    expect(headers["x-business-id"]).toBe("biz_env")
    expect(headers["x-blaze-personal"]).toBeUndefined()
  })
})

describe("requireBusinessContext", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockLoadConfig.mockReturnValue(null)
  })

  it("returns the --business flag value, trimmed, over env and config", async () => {
    process.env.BLAZE_BUSINESS_ID = "biz_env"
    mockLoadConfig.mockReturnValue({ api_key: "", activeBusinessId: "biz_cfg" })

    const result = await requireBusinessContext({ business: "  biz_flag  " })

    expect(result).toBe("biz_flag")
  })

  it("returns BLAZE_BUSINESS_ID, trimmed, when no --business flag is passed", async () => {
    process.env.BLAZE_BUSINESS_ID = "  biz_env\n"
    mockLoadConfig.mockReturnValue({ api_key: "", activeBusinessId: "biz_cfg" })

    const result = await requireBusinessContext({})

    expect(result).toBe("biz_env")
  })

  it("returns the persisted activeBusinessId when no flag or env is set", async () => {
    mockLoadConfig.mockReturnValue({ api_key: "", activeBusinessId: "biz_cfg" })

    const result = await requireBusinessContext({})

    expect(result).toBe("biz_cfg")
  })
})

describe("personalAccountLabel", () => {
  it("includes the identity when a blazetag/email is available", () => {
    expect(personalAccountLabel("okekejr")).toBe("okekejr (Personal)")
  })

  it("falls back to a single Personal when no identity is available", () => {
    expect(personalAccountLabel(undefined)).toBe("Personal")
  })

  it("falls back to a single Personal for an empty identity", () => {
    expect(personalAccountLabel("")).toBe("Personal")
  })
})
