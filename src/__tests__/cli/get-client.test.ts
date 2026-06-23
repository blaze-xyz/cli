import { getClient } from "../../cli/utils"
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
})
