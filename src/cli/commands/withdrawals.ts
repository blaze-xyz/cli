import { Command } from "commander"
import { getClient, getGlobalOpts, handleError } from "../utils"
import { formatOutput } from "../output"
import type { Currency } from "../../sdk/types"

export function registerWithdrawalsCommands(program: Command): void {
  const withdrawals = program
    .command("withdrawals")
    .description("Manage withdrawals")

  withdrawals
    .command("list")
    .description("List withdrawals")
    .option("--limit <n>", "Number of results", parseInt)
    .action(async (opts: { limit?: number }) => {
      try {
        const globals = getGlobalOpts(program)
        const client = getClient(globals)
        const result = await client.listWithdrawals({
          limit: opts.limit,
        })
        formatOutput(result.data, globals.format)
      } catch (err) {
        handleError(err)
      }
    })

  withdrawals
    .command("get <id>")
    .description("Get a withdrawal by ID")
    .action(async (id: string) => {
      try {
        const globals = getGlobalOpts(program)
        const client = getClient(globals)
        const withdrawal = await client.getWithdrawal(id)
        formatOutput(withdrawal, globals.format)
      } catch (err) {
        handleError(err)
      }
    })

  withdrawals
    .command("create")
    .description("Create a new withdrawal")
    .requiredOption("--amount <n>", "Withdrawal amount", parseFloat)
    .requiredOption(
      "--external-account-id <id>",
      "External account ID to withdraw to"
    )
    .option("--currency <code>", "Currency code (default: USD)")
    .option("--note <note>", "Withdrawal note")
    .action(
      async (opts: {
        amount: number
        externalAccountId: string
        currency?: string
        note?: string
      }) => {
        try {
          const globals = getGlobalOpts(program)
          const client = getClient(globals)
          const withdrawal = await client.createWithdrawal({
            amount: opts.amount,
            external_account_id: opts.externalAccountId,
            currency: opts.currency as Currency | undefined,
            note: opts.note,
          })
          formatOutput(withdrawal, globals.format)
        } catch (err) {
          handleError(err)
        }
      }
    )
}
