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
        const client = await getClient(globals)
        const result = await client.getFxRates(opts.base)

        if (globals.format === "json") {
          formatOutput(result, "json")
          return
        }

        const r = result as unknown as Record<string, unknown>
        const base = (r.base as string) || opts.base || "USD"
        const rates = (r.rates || r) as Record<string, unknown>

        console.log("")
        console.log(`  Base: ${base}`)
        console.log("")
        for (const [code, rate] of Object.entries(rates)) {
          if (code === "base" || code === "object" || code === "timestamp")
            continue
          if (typeof rate === "number") {
            console.log(`  ${code.padEnd(5)} ${rate.toFixed(4)}`)
          }
        }
        console.log("")
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
        const client = await getClient(globals)
        const result = await client.createFxQuote({
          from_currency: opts.from,
          to_currency: opts.to,
          amount: opts.amount,
        })

        if (globals.format === "json") {
          formatOutput(result, "json")
          return
        }

        const q = result as unknown as Record<string, unknown>
        const rate = q.exchange_rate || q.exchangeRate
        const converted = q.converted_amount || q.convertedAmount

        console.log("")
        console.log(
          `  ${opts.amount} ${opts.from.toUpperCase()} = ${typeof converted === "number" ? converted.toFixed(2) : converted} ${opts.to.toUpperCase()}`
        )
        if (rate) console.log(`  Rate: ${rate}`)
        console.log("")
      } catch (err) {
        handleError(err)
      }
    })
}
