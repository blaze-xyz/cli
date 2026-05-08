import { Command } from "commander"
import { confirm, select } from "@inquirer/prompts"

import { getClient, getGlobalOpts, handleError } from "../utils"
import { formatOutput } from "../output"

export function registerSendCommand(program: Command): void {
  program
    .command("send <recipient>")
    .description("Send a P2P payment to a Blaze user (blazetag or name)")
    .requiredOption("--amount <n>", "Amount to send (e.g. 5.00)", parseFloat)
    .option("--currency <code>", "Currency code", "USD")
    .option("--note <note>", "Optional payment note")
    .option("-y, --yes", "Skip confirmation prompt")
    .action(
      async (
        recipient: string,
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

          const currency = opts.currency.toUpperCase()
          const needsFxConversion = currency !== "USD" && currency !== "USDC"

          let usdcAmountInCents: number
          let fiatAmountInCents: number | undefined
          let exchangeRate: number | undefined
          let conversionNote = ""

          if (needsFxConversion) {
            const quote = await client.createFxQuote({
              from_currency: currency,
              to_currency: "USD",
              amount: opts.amount,
            })
            usdcAmountInCents = Math.round(quote.converted_amount * 100)
            fiatAmountInCents = Math.round(opts.amount * 100)
            exchangeRate = quote.exchange_rate
            conversionNote = ` (~$${quote.converted_amount.toFixed(2)} USD)`
          } else {
            usdcAmountInCents = Math.round(opts.amount * 100)
          }

          let targetBlazetag: string | undefined
          let targetPublicKey: string | undefined
          let displayName: string

          if (recipient.startsWith("@")) {
            // Exact blazetag lookup
            const tag = recipient.slice(1)
            const user = await client.getUserByBlazetag(tag)
            targetBlazetag = user.blazetag ?? tag
            targetPublicKey = user.public_key ?? undefined
            displayName =
              user.display_name ||
              `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() ||
              `@${tag}`
          } else {
            // Fuzzy search by name
            const results = await client.searchUsers(recipient)
            const users = results.data

            if (users.length === 0) {
              console.log(`No users found matching "${recipient}"`)
              return
            }

            let selected: (typeof users)[0]

            if (users.length === 1) {
              selected = users[0]
            } else {
              const choice = await select({
                message: `Multiple users match "${recipient}":`,
                choices: users.map(u => ({
                  name: `@${u.blazetag ?? "?"} (${u.first_name ?? ""} ${u.last_name ?? ""})`.trim(),
                  value: u.id,
                })),
              })
              selected = users.find(u => u.id === choice)!
            }

            targetBlazetag = selected.blazetag ?? undefined
            targetPublicKey = selected.public_key ?? undefined
            displayName =
              selected.display_name ||
              `${selected.first_name ?? ""} ${selected.last_name ?? ""}`.trim() ||
              `@${targetBlazetag}`
          }

          if (!targetBlazetag && !targetPublicKey) {
            console.error("Could not resolve recipient's wallet address")
            return
          }

          if (!opts.yes) {
            const confirmed = await confirm({
              message: `Send ${opts.amount} ${currency}${conversionNote} to ${displayName}${targetBlazetag ? ` (@${targetBlazetag})` : ""}?`,
            })
            if (!confirmed) {
              console.log("Cancelled.")
              return
            }
          }

          const result = await client.sendPayment({
            blazetag: targetBlazetag,
            recipientPublicKey: targetPublicKey,
            usdcAmountInCents,
            fiatAmountInCents,
            currencyCode: currency,
            exchangeRate,
            note: opts.note,
          })

          console.log(
            `Payment sent! ID: ${result.id}, Status: ${result.status}`
          )
          formatOutput(result, globals.format)
        } catch (err) {
          handleError(err)
        }
      }
    )
}
