import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { BlazeClient } from "../sdk/client"
import { resolveApiKey, resolveBaseUrl } from "../sdk/config"
import { registerTools } from "./tools"

async function main() {
  const apiKey = resolveApiKey()
  if (!apiKey) {
    process.stderr.write(
      "No API key configured. Set BLAZE_API_KEY environment variable or run `blaze config set-key <key>`.\n"
    )
    process.exit(1)
  }

  const client = new BlazeClient({ apiKey, baseUrl: resolveBaseUrl() })

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
