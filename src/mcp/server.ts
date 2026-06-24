import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { BlazeClient } from "../sdk/client"
import { resolveBaseUrl } from "../sdk/config"
import { resolveCredential, resolveContextHeaders } from "../cli/auth-context"
import { registerTools } from "./tools"

async function main() {
  const credential = await resolveCredential()

  if (!credential) {
    process.stderr.write(
      "Not authenticated. Run `blaze auth` to log in, or set BLAZE_TOKEN (personal) " +
        "or BLAZE_API_KEY (business).\n"
    )
    process.exit(1)
  }

  const baseUrl = resolveBaseUrl()
  const defaultHeaders = resolveContextHeaders()

  const client =
    credential.kind === "bearer"
      ? new BlazeClient({
          bearerToken: credential.token,
          baseUrl,
          defaultHeaders,
        })
      : new BlazeClient({ apiKey: credential.apiKey, baseUrl, defaultHeaders })

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
