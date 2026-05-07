import { Command } from "commander"

import { formatOutput } from "../output"
import {
  getClient,
  getConfig,
  getGlobalOpts,
  handleError,
  writeConfig,
} from "../utils"

export function registerBusinessesCommands(program: Command): void {
  const businesses = program
    .command("businesses")
    .description("Manage business context for CLI requests")

  businesses
    .command("list")
    .description("List businesses you are a member of")
    .action(async () => {
      try {
        const globals = getGlobalOpts(program)
        const client = await getClient(globals)
        const result = await client.get<{
          object: string
          data: Array<{ id: string; name: string; role: string }>
        }>("/v1/me/businesses")
        formatOutput(result.data, globals.format)
      } catch (err) {
        handleError(err)
      }
    })

  businesses
    .command("use [businessId]")
    .description(
      "Switch to a business context (omit to switch back to personal/consumer mode)"
    )
    .action(async (businessId: string | undefined) => {
      try {
        const config = getConfig() ?? { api_key: "" }
        if (businessId) {
          config.activeBusinessId = businessId
          writeConfig(config)
          console.log(`Switched to business context: ${businessId}`)
          console.log(
            "All subsequent CLI requests will include x-business-id: " +
              businessId
          )
        } else {
          delete config.activeBusinessId
          writeConfig(config)
          console.log("Switched to personal (consumer) mode.")
        }
      } catch (err) {
        handleError(err)
      }
    })
}
