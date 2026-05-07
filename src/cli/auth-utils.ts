export interface AuthConfig {
  access_token: string
  token_type: string
  expires_in: number
  user: {
    id: string
    email?: string
    blazetag?: string
  }
  created_at: number
}

interface ConfigStore {
  get(key: string): unknown
  set(key: string, value: unknown): void
  delete(key: string): void
}

let configInstance: ConfigStore | null = null

async function getConfig(): Promise<ConfigStore> {
  if (!configInstance) {
    const ConfModule = (await import("conf")).default
    configInstance = new ConfModule({
      projectName: "blaze-cli",
      configName: "config",
    }) as ConfigStore
  }
  return configInstance
}

export async function getAuth(): Promise<AuthConfig | null> {
  const config = await getConfig()
  return config.get("auth") as AuthConfig | null
}

export async function getAuthToken(): Promise<string | null> {
  const auth = await getAuth()
  if (!auth) return null

  // Check if token is expired
  const expiresAt = auth.created_at + auth.expires_in * 1000
  if (Date.now() > expiresAt) {
    await clearAuth()
    return null
  }

  return auth.access_token
}

export async function clearAuth(): Promise<void> {
  const config = await getConfig()
  config.delete("auth")
}

export async function requireAuth(): Promise<string> {
  const token = await getAuthToken()
  if (!token) {
    const chalk = (await import("chalk")).default
    console.error(
      chalk.red("\n✗ Not authenticated. Run `blaze auth` to log in.\n")
    )
    process.exit(1)
  }
  return token
}

export async function getAuthHeader(): Promise<{ Authorization: string }> {
  const token = await requireAuth()
  return { Authorization: `Bearer ${token}` }
}

export async function saveAuth(auth: AuthConfig): Promise<void> {
  const config = await getConfig()
  config.set("auth", auth)
}
