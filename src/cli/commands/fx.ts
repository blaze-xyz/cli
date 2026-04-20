import { Command } from "commander"
import { getClient, getGlobalOpts, handleError } from "../utils"
import { formatOutput } from "../output"

export function registerFxCommands(program: Command): void {
  const fx = program
    .command("fx")
    .description("Foreign exchange rates and quotes")

  fx.command("rates")
    .description("Get current exchange rates")
    .option("--base <currency>", "Base currency code")
    .action(async (opts: { base?: string }) => {
      try {
        const globals = getGlobalOpts(program)
        const client = getClient(globals)
        const result = await client.getFxRates(opts.base)
        formatOutput(result, globals.format)
      } catch (err) {
        handleError(err)
      }
    })

  fx.command("quote")
    .description("Get an FX quote")
    .requiredOption("--from <currency>", "Source currency")
    .requiredOption("--to <currency>", "Target currency")
    .requiredOption("--amount <n>", "Amount to convert", parseFloat)
    .action(async (opts: { from: string; to: string; amount: number }) => {
      try {
        const globals = getGlobalOpts(program)
        const client = getClient(globals)
        const result = await client.createFxQuote({
          from_currency: opts.from,
          to_currency: opts.to,
          amount: opts.amount,
        })
        formatOutput(result, globals.format)
      } catch (err) {
        handleError(err)
      }
    })
}
