import { Command } from "commander"
import { confirm, select } from "@inquirer/prompts"

import { getClient, getGlobalOpts, handleError, withSpinner } from "../utils"
import { formatOutput } from "../output"
import { getAuth } from "../auth-utils"
import { estimateUsdAmount } from "../../constants/fx-rates"

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
            const estimatedUsd = estimateUsdAmount(opts.amount, currency)
            usdcAmountInCents = Math.round(estimatedUsd * 100)
            fiatAmountInCents = Math.round(opts.amount * 100)
            exchangeRate = opts.amount / estimatedUsd
            conversionNote = ` (~$${estimatedUsd.toFixed(2)} USD)`
          } else {
            usdcAmountInCents = Math.round(opts.amount * 100)
          }

          let targetBlazetag: string | undefined
          let targetPublicKey: string | undefined
          let displayName: string

          if (recipient.startsWith("@")) {
            // Exact blazetag lookup
            const tag = recipient.slice(1)
            const user = await withSpinner(
              "Looking up recipient…",
              () => client.getUserByBlazetag(tag),
              { format: globals.format }
            )
            targetBlazetag = user.blazetag ?? tag
            targetPublicKey = user.public_key ?? undefined
            displayName =
              user.display_name ||
              `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() ||
              `@${tag}`
          } else {
            // Fuzzy search by name
            const results = await withSpinner(
              "Looking up recipient…",
              () => client.searchUsers(recipient),
              { format: globals.format }
            )
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

          // Self-send validation (use cached auth data to avoid extra API call)
          const auth = await getAuth()
          if (
            auth?.user?.blazetag &&
            targetBlazetag &&
            auth.user.blazetag.toLowerCase() ===
              targetBlazetag.replace(/^@/, "").toLowerCase()
          ) {
            console.error("Cannot send a payment to yourself")
            return
          }

          // Balance pre-check
          const balance = await client.getBalance()
          const availableCents =
            typeof balance.available === "object"
              ? balance.available.amount
              : balance.available
          if (availableCents < usdcAmountInCents) {
            console.error(
              `Insufficient balance. You have $${(availableCents / 100).toFixed(2)} available but this requires ~$${(usdcAmountInCents / 100).toFixed(2)}.`
            )
            return
          }

          if (!opts.yes) {
            // No spinner is active here — inquirer prompt renders cleanly.
            const confirmed = await confirm({
              message: `Send ${opts.amount} ${currency}${conversionNote} to ${displayName}${targetBlazetag ? ` (@${targetBlazetag})` : ""}?`,
            })
            if (!confirmed) {
              console.log("Cancelled.")
              return
            }
          }

          const result = await withSpinner(
            "Sending payment…",
            () =>
              client.sendPayment({
                blazetag: targetBlazetag,
                recipientPublicKey: targetPublicKey,
                usdcAmountInCents,
                fiatAmountInCents,
                currencyCode: currency,
                exchangeRate,
                note: opts.note,
              }),
            { format: globals.format }
          )

          if (globals.format === "json") {
            formatOutput(result, "json")
          } else {
            const noteClause = opts.note ? ` with the note "${opts.note}"` : ""
            console.log(
              `\nYour payment of ${opts.amount} ${currency} to ${displayName} has been sent${noteClause}.\n`
            )
          }
        } catch (err) {
          handleError(err)
        }
      }
    )
}
