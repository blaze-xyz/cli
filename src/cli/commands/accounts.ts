import { Command } from "commander"
import { getClient, getGlobalOpts, handleError } from "../utils"
import { formatOutput } from "../output"

export function registerAccountsCommands(program: Command): void {
  const accounts = program
    .command("accounts")
    .description("Manage virtual accounts")

  accounts
    .command("list")
    .description("List virtual accounts for a customer")
    .requiredOption("--customer-id <id>", "Customer ID")
    .action(async (opts: { customerId: string }) => {
      try {
        const globals = getGlobalOpts(program)
        const client = getClient(globals)
        const result = await client.listVirtualAccounts(opts.customerId)
        formatOutput(result.data, globals.format)
      } catch (err) {
        handleError(err)
      }
    })

  accounts
    .command("get")
    .description("Get a virtual account")
    .requiredOption("--customer-id <id>", "Customer ID")
    .requiredOption("--va-id <id>", "Virtual account ID")
    .action(async (opts: { customerId: string; vaId: string }) => {
      try {
        const globals = getGlobalOpts(program)
        const client = getClient(globals)
        const account = await client.getVirtualAccount(
          opts.customerId,
          opts.vaId
        )
        formatOutput(account, globals.format)
      } catch (err) {
        handleError(err)
      }
    })

  accounts
    .command("create")
    .description("Create a virtual account for a customer")
    .requiredOption("--customer-id <id>", "Customer ID")
    .option("--nickname <name>", "Account nickname")
    .action(async (opts: { customerId: string; nickname?: string }) => {
      try {
        const globals = getGlobalOpts(program)
        const client = getClient(globals)
        const account = await client.createVirtualAccount(opts.customerId, {
          nickname: opts.nickname,
        })
        formatOutput(account, globals.format)
      } catch (err) {
        handleError(err)
      }
    })
}
