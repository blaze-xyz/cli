import { Command } from "commander"
import { confirm } from "@inquirer/prompts"
import { getClient, getGlobalOpts, handleError } from "../utils"
import { formatOutput } from "../output"

export function registerSendCommand(program: Command): void {
  program
    .command("send <blazetag>")
    .description("Send a P2P payment to a Blaze user")
    .requiredOption("--amount <n>", "Amount to send", parseFloat)
    .option("--currency <code>", "Currency code (default: USDC)", "USDC")
    .option("--note <note>", "Optional payment note")
    .option("-y, --yes", "Skip confirmation prompt")
    .action(
      async (
        blazetag: string,
        opts: {
          amount: number
          currency: string
          note?: string
          yes?: boolean
        }
      ) => {
        try {
          const globals = getGlobalOpts(program)
          const client = await getClient(globals)

          const balance = await client.getBalance()
          console.log(`Current balance:`)
          formatOutput(balance, globals.format)

          if (!opts.yes) {
            const confirmed = await confirm({
              message: `Send ${opts.currency} ${opts.amount} to @${blazetag}?`,
            })
            if (!confirmed) {
              console.log("Cancelled.")
              return
            }
          }

          const result = await client.sendPayment({
            blazetag,
            amount: opts.amount,
            currency: opts.currency,
            note: opts.note,
          })
          formatOutput(result, globals.format)
        } catch (err) {
          handleError(err)
        }
      }
    )
}
