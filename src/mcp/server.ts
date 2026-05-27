import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { BlazeClient } from "../sdk/client"
import { resolveApiKey, resolveBaseUrl, loadConfig } from "../sdk/config"
import { getAuthToken } from "../cli/auth-utils"
import { registerTools } from "./tools"

async function main() {
  const apiKey = resolveApiKey()
  const bearerToken = await getAuthToken()
  const config = loadConfig()
  const activeBusinessId = config?.activeBusinessId

  if (!apiKey && !bearerToken) {
    process.stderr.write(
      "Not authenticated. Run `blaze auth` to log in, or set BLAZE_API_KEY environment variable.\n"
    )
    process.exit(1)
  }

  const contextHeaders: Record<string, string> = {}
  if (activeBusinessId) {
    contextHeaders["x-business-id"] = activeBusinessId
  }

  const client = apiKey
    ? new BlazeClient({
        apiKey,
        baseUrl: resolveBaseUrl(),
        defaultHeaders:
          Object.keys(contextHeaders).length > 0 ? contextHeaders : undefined,
      })
    : new BlazeClient({
        bearerToken: bearerToken!,
        baseUrl: resolveBaseUrl(),
        defaultHeaders:
          Object.keys(contextHeaders).length > 0 ? contextHeaders : undefined,
      })

  const server = new McpServer({
    name: "blaze",
    version: "0.1.0",
  })

  registerTools(server, client)

  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch(err => {
  process.stderr.write(`Fatal error: ${err}\n`)
  process.exit(1)
})
