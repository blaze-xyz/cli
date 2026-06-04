import { Command } from "commander"
import { getClient, getGlobalOpts, handleError, withSpinner } from "../utils"
import { formatOutput } from "../output"

export function registerFxCommands(program: Command): void {
  const fx = program
    .command("fx")
    .description("Foreign exchange rates and quotes")

  fx.command("rates")
    .description("Get current exchange rates")
    .option("--base <currency>", "Base currency code")
    .option("--from <currency>", "Source currency (alias for --base)")
    .option("--to <currency>", "Filter to a specific target currency")
    .action(async (opts: { base?: string; from?: string; to?: string }) => {
      try {
        const globals = getGlobalOpts(program)
        const client = await getClient(globals)
        const baseCurrency = opts.from || opts.base
        const result = await withSpinner(
          "Loading FX rates…",
          () => client.getFxRates(baseCurrency),
          { format: globals.format }
        )

        const r = result as unknown as Record<string, unknown>
        const base = (r.base as string) || baseCurrency || "USD"
        const rates = (r.rates || r) as Record<string, unknown>

        // Filter to specific target currency if --to is provided
        if (opts.to) {
          const targetCode = opts.to.toUpperCase()
          // Lookup case-insensitively since API may return lowercase keys
          const rateEntry = Object.entries(rates).find(
            ([k]) => k.toUpperCase() === targetCode
          )
          if (!rateEntry) {
            handleError(
              new Error(
                `No rate found for ${targetCode} from base ${base.toUpperCase()}`
              )
            )
          }

          const [, rate] = rateEntry!

          if (globals.format === "json") {
            formatOutput({ base, rates: { [targetCode]: rate } }, "json")
            return
          }

          console.log("")
          console.log(`  Base: ${base.toUpperCase()}`)
          console.log("")
          console.log(
            `  ${targetCode.padEnd(5)} ${typeof rate === "number" ? rate.toFixed(4) : rate}`
          )
          console.log("")
          return
        }

        if (globals.format === "json") {
          formatOutput(result, "json")
          return
        }

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
        const result = await withSpinner(
          "Fetching FX quote…",
          () =>
            client.createFxQuote({
              from_currency: opts.from,
              to_currency: opts.to,
              amount: opts.amount,
            }),
          { format: globals.format }
        )

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
