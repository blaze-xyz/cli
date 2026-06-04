import { Command } from "commander"
import { input, select, confirm, password } from "@inquirer/prompts"
import { BlazeGraphQLClient } from "../../sdk/graphql"
import { BlazeClient } from "../../sdk/client"
import {
  saveConfig,
  detectEnvironment,
  loadConfig,
  resolveBaseUrl,
} from "../../sdk/config"
import { handleError } from "../utils"
import { saveAuth } from "../auth-utils"

// ---------------------------------------------------------------------------
// GraphQL operations
// ---------------------------------------------------------------------------

const MY_BUSINESS_QUERY = `
  query MyBusiness {
    myBusiness {
      id
      name
      email
      active
    }
  }
`

const CREATE_BUSINESS_MUTATION = `
  mutation CreateBusiness($input: CreateBusinessInput!) {
    createBusiness(input: $input) {
      id
      name
      email
    }
  }
`

const CREATE_API_KEY_MUTATION = `
  mutation CreateBusinessAPIKey($input: CreateAPIKeyInput!) {
    createBusinessAPIKey(input: $input) {
      id
      name
      key
      keyPrefix
      scopes
      isTest
      expiresAt
      createdAt
    }
  }
`

const ALL_SCOPES = [
  "PAYMENT_LINKS_READ",
  "PAYMENT_LINKS_WRITE",
  "TRANSACTIONS_READ",
  "PAYOUTS_READ",
  "PAYOUTS_WRITE",
  "CUSTOMERS_READ",
  "CUSTOMERS_WRITE",
  "WEBHOOKS_READ",
  "WEBHOOKS_WRITE",
  "BALANCE_READ",
  "CHECKOUT_SESSIONS_READ",
  "CHECKOUT_SESSIONS_WRITE",
  "REFUNDS_READ",
  "REFUNDS_WRITE",
]

// ---------------------------------------------------------------------------
// Types for GraphQL responses
// ---------------------------------------------------------------------------

interface MyBusinessResponse {
  myBusiness: {
    id: string
    name: string
    email: string
    active: boolean
  } | null
}

interface CreateBusinessResponse {
  createBusiness: {
    id: string
    name: string
    email: string
  }
}

interface CreateApiKeyResponse {
  createBusinessAPIKey: {
    id: string
    name: string
    key: string
    keyPrefix: string
    scopes: string[]
    isTest: boolean
    expiresAt: string | null
    createdAt: string
  }
}

// ---------------------------------------------------------------------------
// Setup command
// ---------------------------------------------------------------------------

export function registerSetupCommand(program: Command): void {
  program
    .command("setup")
    .description(
      "Interactive onboarding — authenticate, create a business, and generate an API key"
    )
    .action(async () => {
      try {
        await runSetup()
      } catch (err) {
        // If the user presses Ctrl+C during a prompt, inquirer throws an
        // ExitPromptError. Treat that as a graceful cancellation.
        if (err instanceof Error && err.name === "ExitPromptError") {
          console.log("\nSetup cancelled.")
          process.exit(0)
        }
        handleError(err)
      }
    })
}

async function runSetup(): Promise<void> {
  console.log("")
  console.log("  Blaze CLI Setup")
  console.log("  ===============")
  console.log("")

  // ------------------------------------------------------------------
  // Step 1: Authentication
  // ------------------------------------------------------------------
  console.log("  Step 1/4: Authentication")
  console.log("")

  const existingConfig = loadConfig()

  const authMethod = await select({
    message: "How would you like to authenticate?",
    choices: [
      {
        name: "Authenticate via browser (recommended)",
        value: "browser" as const,
        description: "Opens your browser for secure OAuth authentication",
      },
      {
        name: "I have a JWT token (from the Blaze app)",
        value: "jwt" as const,
      },
      {
        name: "I already have an API key",
        value: "api_key" as const,
      },
      ...(existingConfig?.api_key
        ? [
            {
              name: `Use existing key (${maskKey(existingConfig.api_key)})`,
              value: "existing" as const,
            },
          ]
        : []),
    ],
  })

  if (authMethod === "browser") {
    // Browser-based OAuth authentication
    console.log("")
    console.log("  Opening browser for authentication...")
    console.log("")

    try {
      await runBrowserAuth()
      console.log("")
      console.log("  ✓ Authentication successful!")
      console.log("")
      console.log("  Setup complete! You're ready to use the Blaze CLI.")
      console.log("")
      return
    } catch (err) {
      console.error("")
      console.error(
        `  Authentication failed: ${err instanceof Error ? err.message : "Unknown error"}`
      )
      console.error("  Please try again or use an API key instead.")
      process.exit(1)
    }
  }

  if (authMethod === "api_key") {
    // Fast path: user already has an API key, just save and verify.
    const apiKey = await password({
      message: "Enter your API key:",
      mask: "*",
    })

    if (!apiKey.trim()) {
      console.error("  API key cannot be empty.")
      process.exit(1)
    }

    await saveAndVerify(apiKey.trim())
    return
  }

  if (authMethod === "existing" && existingConfig?.api_key) {
    await verifyExistingKey(existingConfig.api_key, existingConfig.base_url)
    return
  }

  // JWT flow
  const endpoint = await input({
    message: "Blaze GraphQL endpoint:",
    default: "https://api.blaze.money/graphql",
  })

  const jwtToken = await password({
    message: "Enter your JWT token:",
    mask: "*",
  })

  if (!jwtToken.trim()) {
    console.error("  JWT token cannot be empty.")
    process.exit(1)
  }

  const gql = new BlazeGraphQLClient(endpoint.trim(), jwtToken.trim())

  // Validate the JWT by attempting a query
  console.log("")
  console.log("  Validating token...")

  let business: MyBusinessResponse["myBusiness"] = null
  try {
    const result = await gql.query<MyBusinessResponse>(MY_BUSINESS_QUERY)
    business = result.myBusiness
  } catch (err) {
    console.error("")
    console.error(
      `  Authentication failed: ${err instanceof Error ? err.message : "Unknown error"}`
    )
    console.error("  Make sure you have a valid JWT from the Blaze app.")
    process.exit(1)
  }

  console.log("  Token validated.")
  console.log("")

  // ------------------------------------------------------------------
  // Step 2: Check existing business
  // ------------------------------------------------------------------
  console.log("  Step 2/4: Business")
  console.log("")

  if (business) {
    console.log(`  Business found: "${business.name}" (${business.id})`)
    console.log(`  Email: ${business.email}`)
    console.log(`  Active: ${business.active ? "yes" : "no"}`)
    console.log("")
  } else {
    // ------------------------------------------------------------------
    // Step 3: Create business
    // ------------------------------------------------------------------
    console.log("  No business found. Let's create one.")
    console.log("")

    const businessName = await input({
      message: "Business name:",
    })

    const businessEmail = await input({
      message: "Business email:",
    })

    const businessDescription = await input({
      message: "Description (optional):",
      default: "",
    })

    const businessCategory = await input({
      message: "Category (e.g. payments, ecommerce, saas):",
      default: "",
    })

    const businessWebsite = await input({
      message: "Website URL (optional):",
      default: "",
    })

    console.log("")
    console.log("  Creating business...")

    const createInput: Record<string, unknown> = {
      name: businessName,
      email: businessEmail,
    }
    if (businessDescription) createInput.description = businessDescription
    if (businessCategory) createInput.category = businessCategory
    if (businessWebsite) createInput.website = businessWebsite

    try {
      const result = await gql.query<CreateBusinessResponse>(
        CREATE_BUSINESS_MUTATION,
        { input: createInput }
      )
      business = { ...result.createBusiness, active: true }
      console.log(`  Business created: "${business.name}" (${business.id})`)
      console.log("")
    } catch (err) {
      console.error(
        `  Failed to create business: ${err instanceof Error ? err.message : "Unknown error"}`
      )
      process.exit(1)
    }
  }

  // ------------------------------------------------------------------
  // Step 3/4: Generate API key
  // ------------------------------------------------------------------
  console.log("  Step 3/4: API Key")
  console.log("")

  const keyName = await input({
    message: "Key name:",
    default: "CLI Key",
  })

  const keyMode = await select({
    message: "Key mode:",
    choices: [
      { name: "Test (sk_test_*)", value: "test" as const },
      { name: "Live (sk_live_*)", value: "live" as const },
    ],
    default: "test",
  })

  console.log("")
  console.log("  Creating API key with all scopes...")

  let apiKeyValue: string
  try {
    const result = await gql.query<CreateApiKeyResponse>(
      CREATE_API_KEY_MUTATION,
      {
        input: {
          name: keyName,
          scopes: ALL_SCOPES,
          isTest: keyMode === "test",
        },
      }
    )

    apiKeyValue = result.createBusinessAPIKey.key

    console.log("")
    console.log("  API key created!")
    console.log("")
    console.log(
      "  ============================================================"
    )
    console.log(`  ${apiKeyValue}`)
    console.log(
      "  ============================================================"
    )
    console.log("")
    console.log("  Save this key -- it will not be shown again.")
    console.log("")
  } catch (err) {
    console.error(
      `  Failed to create API key: ${err instanceof Error ? err.message : "Unknown error"}`
    )
    process.exit(1)
  }

  // ------------------------------------------------------------------
  // Step 4: Save config and verify
  // ------------------------------------------------------------------
  await saveAndVerify(apiKeyValue, endpoint.trim())
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function saveAndVerify(apiKey: string, baseUrl?: string): Promise<void> {
  console.log("  Step 4/4: Verify")
  console.log("")

  const env = detectEnvironment(apiKey)
  const restBaseUrl =
    baseUrl && baseUrl.endsWith("/graphql")
      ? baseUrl.replace(/\/graphql$/, "")
      : baseUrl

  saveConfig({
    api_key: apiKey,
    base_url:
      restBaseUrl && restBaseUrl !== "https://api.blaze.money"
        ? restBaseUrl
        : undefined,
    environment: env,
  })
  console.log("  Config saved to ~/.blaze/config.json")

  // Verify the key actually works
  try {
    const client = new BlazeClient({
      apiKey,
      baseUrl: restBaseUrl ?? "https://api.blaze.money",
    })
    const balance = await client.getBalance()
    const balances = balance as unknown as Record<string, unknown>

    // Try to display a human-friendly balance summary
    if (Array.isArray(balances.available) && balances.available.length > 0) {
      const first = balances.available[0] as {
        amount: number
        currency: string
      }
      console.log(`  Balance: ${formatCurrency(first.amount, first.currency)}`)
    } else {
      console.log("  Balance verified.")
    }
  } catch {
    console.log(
      "  Could not verify balance (the key may not have BALANCE_READ scope or the API may be unreachable)."
    )
    console.log(
      "  The key has been saved -- you can test manually with: blaze balance"
    )
  }

  console.log("")
  console.log(`  Setup complete! Environment: ${env}`)
  console.log("")
}

async function verifyExistingKey(
  apiKey: string,
  baseUrl?: string
): Promise<void> {
  console.log("")
  console.log("  Verifying existing key...")

  const shouldContinue = await confirm({
    message: "Run a test call to verify the key works?",
    default: true,
  })

  if (!shouldContinue) {
    console.log("")
    console.log("  Setup complete! Using existing configuration.")
    console.log("")
    return
  }

  try {
    const client = new BlazeClient({
      apiKey,
      baseUrl: baseUrl ?? "https://api.blaze.money",
    })
    await client.getBalance()
    console.log("  Key is valid.")
  } catch {
    console.log(
      "  Could not verify key. Check your config with: blaze auth whoami"
    )
  }

  console.log("")
  console.log("  Setup complete! Using existing configuration.")
  console.log("")
}

function maskKey(key: string): string {
  if (key.length <= 12) return "****"
  return `${key.slice(0, 8)}****${key.slice(-4)}`
}

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount)
  } catch {
    return `${amount} ${currency}`
  }
}

async function runBrowserAuth(): Promise<void> {
  const API_ENDPOINT = resolveBaseUrl()

  const chalk = (await import("chalk")).default
  const ora = (await import("ora")).default
  const open = (await import("open")).default

  const spinner = ora("Requesting device code...").start()

  try {
    // Step 1: Request device code
    const deviceCodeRes = await fetch(`${API_ENDPOINT}/graphql`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `
          mutation GenerateDeviceCode($input: GenerateDeviceCodeInput!) {
            generateDeviceCode(input: $input) {
              device_code
              user_code
              verification_uri
              verification_uri_complete
              expires_in
              interval
            }
          }
        `,
        variables: {
          input: { clientId: "blaze-cli" },
        },
      }),
    })

    if (!deviceCodeRes.ok) {
      throw new Error(
        `HTTP ${deviceCodeRes.status}: ${deviceCodeRes.statusText}`
      )
    }

    interface DeviceCodeResponse {
      device_code: string
      user_code: string
      verification_uri: string
      verification_uri_complete: string
      expires_in: number
      interval: number
    }

    const deviceCodeData = (await deviceCodeRes.json()) as {
      data?: {
        generateDeviceCode?: DeviceCodeResponse
      }
      errors?: Array<{ message: string }>
    }
    if (deviceCodeData.errors) {
      throw new Error(
        deviceCodeData.errors[0]?.message || "Failed to generate device code"
      )
    }

    if (!deviceCodeData.data?.generateDeviceCode) {
      throw new Error("Invalid response from server")
    }

    const deviceCode = deviceCodeData.data.generateDeviceCode

    spinner.stop()

    // Step 2: Display code and open browser
    console.log(`  Visit: ${chalk.cyan(deviceCode.verification_uri)}`)
    console.log(`  `)
    console.log(`  Enter code: ${chalk.yellow.bold(deviceCode.user_code)}`)
    console.log("")

    // Try to open browser automatically
    try {
      await open(deviceCode.verification_uri_complete)
      console.log(chalk.dim("  ✓ Opened browser automatically"))
    } catch (error) {
      console.log(chalk.dim("  (Could not open browser automatically)"))
    }

    console.log("")

    // Step 3: Poll for authorization
    spinner.start("Waiting for authorization...")

    const pollInterval = deviceCode.interval * 1000
    const expiresAt = Date.now() + deviceCode.expires_in * 1000

    while (Date.now() < expiresAt) {
      await sleep(pollInterval)

      const tokenRes = await fetch(`${API_ENDPOINT}/graphql`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `
            mutation PollDeviceToken($input: PollDeviceTokenInput!) {
              pollDeviceToken(input: $input) {
                __typename
                ... on DeviceTokenSuccess {
                  access_token
                  token_type
                  expires_in
                  user {
                    id
                    email
                    blazetag
                  }
                }
                ... on DeviceTokenPending {
                  error
                  interval
                }
                ... on DeviceTokenError {
                  error
                  error_description
                }
              }
            }
          `,
          variables: {
            input: {
              device_code: deviceCode.device_code,
              clientId: "blaze-cli",
            },
          },
        }),
      })

      interface TokenResponse {
        __typename: string
        access_token: string
        token_type: string
        expires_in: number
        user: {
          id: string
          email?: string
          blazetag?: string
        }
        error?: string
        error_description?: string
      }

      const tokenData = (await tokenRes.json()) as {
        data?: { pollDeviceToken?: TokenResponse }
        errors?: Array<{ message: string }>
      }
      const tokenResponse = tokenData.data?.pollDeviceToken

      if (!tokenResponse) {
        throw new Error("Invalid response from server")
      }

      // Handle response
      if (tokenResponse.__typename === "DeviceTokenSuccess") {
        spinner.succeed(chalk.green("Authorization successful!"))

        // Store token
        await saveAuth({
          access_token: tokenResponse.access_token,
          token_type: tokenResponse.token_type,
          expires_in: tokenResponse.expires_in,
          user: tokenResponse.user,
          created_at: Date.now(),
        })

        const user =
          tokenResponse.user.email || tokenResponse.user.blazetag || "user"
        console.log(chalk.green(`  Logged in as ${user}`))
        return
      }

      if (tokenResponse.__typename === "DeviceTokenPending") {
        // Continue polling
        continue
      }

      if (tokenResponse.__typename === "DeviceTokenError") {
        spinner.fail(chalk.red("Authorization failed"))
        throw new Error(tokenResponse.error_description || tokenResponse.error)
      }
    }

    // Timeout
    spinner.fail(chalk.red("Authorization timed out"))
    throw new Error("Device code expired. Please run the setup command again.")
  } catch (error) {
    spinner.fail(chalk.red("Authentication failed"))
    throw error
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
