import { Command } from "commander"
import { getClient, getGlobalOpts, handleError } from "../utils"
import { formatOutput } from "../output"

export function registerDisputesCommands(program: Command): void {
  const disputes = program.command("disputes").description("Manage disputes")

  disputes
    .command("list")
    .description("List disputes")
    .option("--limit <n>", "Number of results", parseInt)
    .option("--status <status>", "Filter by status")
    .action(async (opts: { limit?: number; status?: string }) => {
      try {
        const globals = getGlobalOpts(program)
        const client = getClient(globals)
        const result = await client.listDisputes({
          limit: opts.limit,
          status: opts.status,
        })
        formatOutput(result.data, globals.format)
      } catch (err) {
        handleError(err)
      }
    })

  disputes
    .command("get <id>")
    .description("Get a dispute by ID")
    .action(async (id: string) => {
      try {
        const globals = getGlobalOpts(program)
        const client = getClient(globals)
        const result = await client.getDispute(id)
        formatOutput(result, globals.format)
      } catch (err) {
        handleError(err)
      }
    })

  disputes
    .command("submit-evidence <id>")
    .description("Submit evidence for a dispute")
    .requiredOption("--description <desc>", "Evidence description")
    .option("--document-urls <urls>", "Comma-separated document URLs")
    .action(
      async (
        id: string,
        opts: { description: string; documentUrls?: string }
      ) => {
        try {
          const globals = getGlobalOpts(program)
          const client = getClient(globals)
          const result = await client.submitDisputeEvidence(id, {
            description: opts.description,
            document_urls: opts.documentUrls
              ? opts.documentUrls.split(",").map((s: string) => s.trim())
              : undefined,
          })
          formatOutput(result, globals.format)
        } catch (err) {
          handleError(err)
        }
      }
    )

  disputes
    .command("close <id>")
    .description("Close a dispute")
    .action(async (id: string) => {
      try {
        const globals = getGlobalOpts(program)
        const client = getClient(globals)
        const result = await client.closeDispute(id)
        formatOutput(result, globals.format)
      } catch (err) {
        handleError(err)
      }
    })
}
