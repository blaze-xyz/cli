import { Command } from "commander"
import {
  getClient,
  getGlobalOpts,
  handleError,
  personalAccountLabel,
  withSpinner,
} from "../utils"
import { formatOutput } from "../output"
import { CurrencyAmount } from "../../sdk/types"
import { getAuth } from "../auth-utils"
import { resolveAccountContext } from "../auth-context"

function extractAmount(value: CurrencyAmount | number): number {
  return typeof value === "object" && value !== null ? value.amount : value
}

function extractCurrency(
  value: CurrencyAmount | number,
  fallback: string
): string {
  return typeof value === "object" && value !== null ? value.currency : fallback
}

export function registerBalanceCommand(program: Command): void {
  program
    .command("balance")
    .description("Get account balance")
    .action(async () => {
      try {
        const globals = getGlobalOpts(program)
        const client = await getClient(globals)
        const balance = await withSpinner(
          "Fetching balance…",
          () => client.getBalance(),
          { format: globals.format }
        )

        if (globals.format === "json") {
          formatOutput(balance, "json")
          return
        }

        const availableCents = extractAmount(balance.available)
        const pendingCents = extractAmount(balance.pending)
        const currency = extractCurrency(
          balance.available,
          balance.currency || "USD"
        )

        const availableFmt = (availableCents / 100).toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
        const pendingFmt = (pendingCents / 100).toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })

        // Determine context label — mirror exactly what getClient sends, honoring
        // --personal / --business / BLAZE_PERSONAL / BLAZE_BUSINESS_ID / config.
        const accountCtx = resolveAccountContext(globals)
        const isPersonal = accountCtx.personal || !accountCtx.businessId
        let accountLabel: string
        let hint: string

        if (isPersonal) {
          const auth = await getAuth()
          const name = auth?.user?.blazetag || auth?.user?.email
          accountLabel = personalAccountLabel(name)
          hint =
            "Showing personal balance. Use --business to see a business balance."
        } else {
          // Try to resolve business name
          const businessId = accountCtx.businessId
          let businessName = businessId || "Business"
          try {
            const result = await client.get<{
              object: string
              data: Array<{ id: string; name: string; role: string }>
            }>("/v1/me/businesses")
            const match = result.data.find(
              (b: { id: string; name: string; role: string }) =>
                b.id === businessId
            )
            if (match) businessName = match.name
          } catch {
            // Use ID as fallback
          }
          accountLabel = businessName
          hint =
            "Showing business balance. Use --personal for your personal balance."
        }

        console.log("")
        console.log(`  ${accountLabel}`)
        console.log("")
        console.log(`  Available:  $${availableFmt} ${currency}`)
        if (pendingCents > 0) {
          console.log(`  Pending:    $${pendingFmt} ${currency}`)
        }
        console.log("")
        console.log(`  ⌁ ${hint}`)
        console.log("")
      } catch (err) {
        handleError(err)
      }
    })
}
