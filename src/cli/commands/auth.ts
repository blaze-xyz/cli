import { Command } from "commander"
import { BlazeClient } from "../../sdk/client"
import { resolveBaseUrl, saveConfig, detectEnvironment } from "../../sdk/config"
import { getClient, getConfig, handleError, writeConfig } from "../utils"
import { getAuth, clearAuth, saveAuth, requireAuth } from "../auth-utils"

const API_ENDPOINT = process.env.BLAZE_API_URL || "https://api.blaze.money"

interface DeviceCodeResponse {
  device_code: string
  user_code: string
  verification_uri: string
  verification_uri_complete: string
  expires_in: number
  interval: number
}

interface TokenResponse {
  __typename: string
  access_token?: string
  token_type?: string
  expires_in?: number
  user?: {
    id: string
    email?: string
    blazetag?: string
  }
  error?: string
  error_description?: string
  interval?: number
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function browserLogin(): Promise<void> {
  const chalk = (await import("chalk")).default
  const ora = (await import("ora")).default
  const open = (await import("open")).default

  // Check if already authenticated
  const existingAuth = await getAuth()
  if (existingAuth) {
    const user = existingAuth.user.email || existingAuth.user.blazetag
    console.log(
      chalk.yellow(
        `\n⚠ Already logged in as ${user}\n\nRun \`blaze logout\` to log out first.\n`
      )
    )
    return
  }

  const spinner = ora("Requesting device code...").start()

  try {
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

    const deviceCode: DeviceCodeResponse =
      deviceCodeData.data.generateDeviceCode

    spinner.stop()

    console.log(chalk.bold("\n🔐 Authorize Blaze CLI\n"))
    console.log(`Visit: ${chalk.cyan(deviceCode.verification_uri)}`)
    console.log(`\nEnter code: ${chalk.yellow.bold(deviceCode.user_code)}\n`)

    try {
      await open(deviceCode.verification_uri_complete)
      console.log(chalk.dim("✓ Opened browser automatically\n"))
    } catch {
      console.log(chalk.dim("(Could not open browser automatically)\n"))
    }

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

      if (!tokenRes.ok) {
        throw new Error(`HTTP ${tokenRes.status}: ${tokenRes.statusText}`)
      }

      const tokenData = (await tokenRes.json()) as {
        data?: { pollDeviceToken?: TokenResponse }
        errors?: Array<{ message: string }>
      }
      if (tokenData.errors) {
        throw new Error(tokenData.errors[0]?.message || "Polling failed")
      }

      if (!tokenData.data?.pollDeviceToken) {
        throw new Error("Invalid response from server")
      }

      const tokenResponse: TokenResponse = tokenData.data.pollDeviceToken

      if (tokenResponse.__typename === "DeviceTokenSuccess") {
        spinner.succeed(chalk.green("Authorization successful!"))

        await saveAuth({
          access_token: tokenResponse.access_token!,
          token_type: tokenResponse.token_type!,
          expires_in: tokenResponse.expires_in!,
          user: tokenResponse.user!,
          created_at: Date.now(),
        })

        try {
          const client = await getClient({})
          const businessesResult = await client.get<{
            object: string
            data: Array<{ id: string; name: string; role: string }>
          }>("/v1/me/businesses")
          const businesses = businessesResult.data

          if (businesses.length === 1) {
            const only = businesses[0]!
            const config = getConfig() ?? { api_key: "" }
            config.activeBusinessId = only.id
            writeConfig(config)
            console.log(
              chalk.green(
                `\n✓ Active business set: ${only.name} (${only.role})`
              )
            )
          } else if (businesses.length > 1) {
            console.log(`\nYou belong to ${businesses.length} businesses:`)
            for (const b of businesses) {
              console.log(
                `  - ${b.name} (${b.role})  -> blaze businesses use ${b.id}`
              )
            }
            console.log(chalk.dim("Run blaze businesses use <id> to pick one."))
          }
        } catch (businessFetchError) {
          if (process.env.DEBUG) {
            console.error(
              chalk.dim(
                `[debug] Failed to fetch businesses: ${
                  businessFetchError instanceof Error
                    ? businessFetchError.message
                    : String(businessFetchError)
                }`
              )
            )
          }
        }

        const user = tokenResponse.user!.email || tokenResponse.user!.blazetag
        console.log(chalk.green(`\n✓ Logged in as ${user}\n`))
        return
      }

      if (tokenResponse.__typename === "DeviceTokenPending") {
        continue
      }

      if (tokenResponse.__typename === "DeviceTokenError") {
        spinner.fail(chalk.red("Authorization failed"))
        console.error(
          chalk.red(
            `\n✗ ${tokenResponse.error_description || tokenResponse.error}\n`
          )
        )
        process.exit(1)
      }
    }

    spinner.fail(chalk.red("Authorization timed out"))
    console.error(
      chalk.red("\n✗ Device code expired. Please run `blaze auth` again.\n")
    )
    process.exit(1)
  } catch (error) {
    spinner.fail(chalk.red("Authentication failed"))
    console.error(
      chalk.red(
        `\n✗ ${error instanceof Error ? error.message : String(error)}\n`
      )
    )
    process.exit(1)
  }
}

export function registerAuthCommands(program: Command): void {
  // Top-level `blaze login` alias
  program
    .command("login")
    .description("Authenticate with Blaze (opens browser)")
    .action(async () => {
      await browserLogin()
    })

  // Top-level `blaze logout` alias
  program
    .command("logout")
    .description("Log out of Blaze CLI")
    .action(async () => {
      const chalk = (await import("chalk")).default
      const authData = await getAuth()

      if (!authData) {
        console.log(chalk.yellow("\n⚠ Not currently logged in\n"))
        return
      }

      await clearAuth()
      console.log(chalk.green("\n✓ Logged out successfully\n"))
    })

  const auth = program
    .command("auth")
    .description("Authenticate with Blaze via browser")
    .action(async () => {
      await browserLogin()
    })

  auth
    .command("login")
    .description(
      "Authenticate with Blaze (opens browser, or use --api-key for legacy)"
    )
    .option("--api-key <key>", "Authenticate with API key instead of browser")
    .action(async (opts: { apiKey?: string }) => {
      if (!opts.apiKey) {
        await browserLogin()
        return
      }

      try {
        const baseUrl = resolveBaseUrl(program.opts().baseUrl as string)
        const client = new BlazeClient({
          apiKey: opts.apiKey,
          baseUrl,
        })

        // Validate the key by making an API call
        console.log("Validating API key...")
        await client.getBalance()

        const env = detectEnvironment(opts.apiKey)
        saveConfig({
          api_key: opts.apiKey,
          base_url: baseUrl !== "https://api.blaze.money" ? baseUrl : undefined,
          environment: env,
        })

        console.log(`Authenticated successfully (${env} mode)`)
        console.log("API key saved to ~/.blaze/config.json")
      } catch (err) {
        handleError(err)
      }
    })

  auth
    .command("whoami")
    .description("Display current authenticated user")
    .action(async () => {
      const chalk = (await import("chalk")).default
      await requireAuth()

      const authData = await getAuth()
      if (!authData) {
        console.error(
          chalk.red("\n✗ Not authenticated. Run `blaze auth` to log in.\n")
        )
        process.exit(1)
      }

      console.log(chalk.bold("\nAuthenticated User:\n"))
      console.log(`Email:    ${authData.user.email || "N/A"}`)
      console.log(`Blazetag: ${authData.user.blazetag || "N/A"}`)
      console.log(`User ID:  ${authData.user.id}`)
      console.log()
    })

  auth
    .command("logout")
    .description("Log out of Blaze CLI")
    .action(async () => {
      const chalk = (await import("chalk")).default
      const authData = await getAuth()

      if (!authData) {
        console.log(chalk.yellow("\n⚠ Not currently logged in\n"))
        return
      }

      await clearAuth()
      console.log(chalk.green("\n✓ Logged out successfully\n"))
    })
}
