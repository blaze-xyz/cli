import * as fs from "node:fs"
import * as path from "node:path"
import * as os from "node:os"

export interface BlazeConfig {
  api_key: string
  base_url?: string
  environment?: "test" | "live"
}

const CONFIG_DIR = path.join(os.homedir(), ".blaze")
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json")

export function loadConfig(): BlazeConfig | null {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return null
    const raw = fs.readFileSync(CONFIG_FILE, "utf-8")
    return JSON.parse(raw) as BlazeConfig
  } catch {
    return null
  }
}

export function saveConfig(config: BlazeConfig): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true })
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n")
}

export function resolveApiKey(flagValue?: string): string | null {
  // Precedence: flag > env var > config file
  if (flagValue) return flagValue
  if (process.env.BLAZE_API_KEY) return process.env.BLAZE_API_KEY
  const config = loadConfig()
  return config?.api_key ?? null
}

export function resolveBaseUrl(flagValue?: string): string {
  if (flagValue) return flagValue
  if (process.env.BLAZE_BASE_URL) return process.env.BLAZE_BASE_URL
  const config = loadConfig()
  return config?.base_url ?? "https://api.blaze.money"
}

export function detectEnvironment(apiKey: string): "test" | "live" {
  return apiKey.startsWith("sk_test_") ? "test" : "live"
}
