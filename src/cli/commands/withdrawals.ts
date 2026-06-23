import { confirm, select } from "@inquirer/prompts"
import { Command } from "commander"
import {
  fail,
  getClient,
  getGlobalOpts,
  handleError,
  withSpinner,
} from "../utils"
import { formatOutput } from "../output"
import {
  deriveWithdrawalAmounts,
  formatConnectedPaymentMethodLabel,
  estimateWithdrawalArrival,
  suggestedLocalMinimum,
  humanizeWithdrawIneligibilityReason,
  mapToPaymentMethodType,
  totalFeeCents,
} from "../../constants/withdrawal-format"
import {
  BlazeAuthenticationError,
  BlazePermissionError,
} from "../../sdk/errors"
import type {
  Currency,
  ConnectedPaymentMethod,
  RampTransferStatusResult,
  WithdrawalLimits,
} from "../../sdk/types"

// Builds a friendly, contact-list-style label for a connected method (e.g.
// "Banamex ••3899"). Delegates to the shared formatter so the CLI, agent, and
// MCP all read the same way.
function methodLabel(method: ConnectedPaymentMethod): string {
  return formatConnectedPaymentMethodLabel(method)
}

// Reads the available balance in cents defensively — `balance.available` may be
// a `{ amount }` object or a plain number depending on the API shape.
function availableCentsOf(balance: {
  available: { amount: number } | number
}): number {
  return typeof balance.available === "object"
    ? balance.available.amount
    : balance.available
}

// Formats a RampTransfer status result for the human-readable status output.
// Appends the real fee (summed from FeeCollection rows) when present.
function formatStatusLine(t: RampTransferStatusResult): string {
  const fiat = t.fiatAmount
    ? `${(t.fiatAmount.value / 100).toFixed(2)} ${t.fiatAmount.currency?.code ?? ""}`.trim()
    : "–"
  const fee = totalFeeCents(t.feeCollections)
  const feeNote = fee > 0 ? ` — fee $${(fee / 100).toFixed(2)}` : ""
  return `Withdrawal ${t.id}: ${t.status} (${fiat})${feeNote}`
}

export function registerWithdrawalsCommands(program: Command): void {
  const withdrawals = program
    .command("withdrawals")
    .description(
      "Manage withdrawals. `create` is a business payout to a customer's external account; `methods`/`to-method`/`status` are personal cash-outs to your own connected bank/card."
    )

  // ----------------------------------------
  // withdrawals list (business)
  // ----------------------------------------
  withdrawals
    .command("list")
    .description("List withdrawals")
    .option("--limit <n>", "Number of results", parseInt)
    .action(async (opts: { limit?: number }) => {
      try {
        const globals = getGlobalOpts(program)
        const client = await getClient(globals)
        const result = await withSpinner(
          "Loading withdrawals…",
          () =>
            client.listWithdrawals({
              limit: opts.limit,
            }),
          { format: globals.format }
        )
        formatOutput(result.data, globals.format)
      } catch (err) {
        handleError(err)
      }
    })

  // ----------------------------------------
  // withdrawals get <id> (business)
  // ----------------------------------------
  withdrawals
    .command("get <id>")
    .description("Get a withdrawal by ID")
    .action(async (id: string) => {
      try {
        const globals = getGlobalOpts(program)
        const client = await getClient(globals)
        const withdrawal = await withSpinner(
          `Loading withdrawal ${id}…`,
          () => client.getWithdrawal(id),
          { format: globals.format }
        )
        formatOutput(withdrawal, globals.format)
      } catch (err) {
        handleError(err)
      }
    })

  // ----------------------------------------
  // withdrawals create (business payout to a customer's external account)
  // ----------------------------------------
  withdrawals
    .command("create")
    .description(
      "Create a business withdrawal to a customer's external account (API-key scoped)"
    )
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
          const client = await getClient(globals)
          const withdrawal = await client.createWithdrawal({
            amount: opts.amount,
            external_account_id: opts.externalAccountId,
            currency: opts.currency as Currency | undefined,
            note: opts.note,
          })

          if (globals.format === "json") {
            formatOutput(withdrawal, "json")
          } else {
            const currency = opts.currency || "USD"
            const noteClause = opts.note ? ` with the note "${opts.note}"` : ""
            console.log(
              `\nYour withdrawal of ${opts.amount.toFixed(2)} ${currency} has been initiated and is processing${noteClause}.\n`
            )
          }
        } catch (err) {
          handleError(err)
        }
      }
    )

  // ----------------------------------------
  // withdrawals methods (personal) — list connected withdrawal destinations
  // ----------------------------------------
  withdrawals
    .command("methods")
    .description(
      "List your connected payment methods you can withdraw to (your own banks/cards)"
    )
    .option(
      "--all",
      "Show every connected method, including ones you can't withdraw to"
    )
    .action(async (opts: { all?: boolean }) => {
      try {
        const globals = getGlobalOpts(program)
        // Force personal context: connected methods live on the personal
        // account, never the business one. This "just works" even when an
        // activeBusinessId is configured, without requiring --personal.
        const client = await getClient({ ...globals, personal: true })
        if (client.authContext === "business") {
          console.error(
            "Listing your own connected methods requires a personal login. Run 'blaze auth login' (or pass --personal)."
          )
          process.exit(1)
        }

        const result = await withSpinner(
          "Loading payment methods…",
          () => client.listConnectedPaymentMethods(),
          { format: globals.format }
        )

        const methods = opts.all
          ? result.methods
          : result.methods.filter(m => m.canWithdraw)

        if (globals.format === "json") {
          formatOutput(methods, "json")
          return
        }

        if (methods.length === 0) {
          console.log(
            "\nNo connected methods you can withdraw to. Add a bank or debit card in the Blaze app, then try again.\n"
          )
          return
        }

        const rows = methods.map(m => ({
          id: m.id,
          method: methodLabel(m),
          type: m.type,
          default: m.id === result.defaultWithdrawalMethodId ? "*" : "",
          canWithdraw: m.canWithdraw ? "yes" : "no",
          ...(opts.all
            ? {
                reason: m.canWithdraw
                  ? ""
                  : humanizeWithdrawIneligibilityReason(
                      m.withdrawIneligibilityReason
                    ),
              }
            : {}),
        }))
        formatOutput(rows, globals.format)
      } catch (err) {
        handleError(err)
      }
    })

  // ----------------------------------------
  // withdrawals to-method (personal) — cash out your balance to your own method
  // ----------------------------------------
  withdrawals
    .command("to-method")
    .description(
      "Withdraw your own balance to your own connected payment method (bank/card)"
    )
    .requiredOption("--amount <n>", "Amount to withdraw", parseFloat)
    .option(
      "--payment-method-id <id>",
      "Connected payment method to withdraw to (prompts if multiple)"
    )
    .option("--currency <code>", "Currency code (default: USD)")
    .option("--instant", "Force an instant transfer")
    .option("--no-instant", "Force a standard (non-instant) transfer")
    .option("--watch", "Poll the withdrawal status until it settles")
    .option("-y, --yes", "Skip confirmation prompt")
    .action(
      async (opts: {
        amount: number
        paymentMethodId?: string
        currency?: string
        instant?: boolean
        watch?: boolean
        yes?: boolean
      }) => {
        // Hoisted so the catch can format errors per the requested output mode.
        const globals = getGlobalOpts(program)
        try {
          // Force personal context: the consumer withdraw mutation reads userId
          // from the personal JWT, so it must run in personal context even when
          // an activeBusinessId is configured. Passing --personal stays
          // harmless (it does the same thing).
          const client = await getClient({ ...globals, personal: true })

          // Business-context guard: the consumer mutation reads userId from the
          // JWT — an API-key/business context would be rejected (403). With
          // personal context forced above, this only fires for an
          // api-key-only session. Fail clearly before any money movement.
          if (client.authContext === "business") {
            fail(
              "Withdrawing to your own connected method requires a personal login. Run 'blaze auth login' (or pass --personal).",
              globals.format
            )
          }

          const currency = (opts.currency || "USD").toUpperCase()

          // Amount + currency math is the single source of truth: validates the
          // currency, rejects zero/negative, caps at the Int max, and derives
          // the cents. Runs before method resolution and any money movement.
          const derived = deriveWithdrawalAmounts({
            amount: opts.amount,
            currency,
          })
          if (!derived.ok) {
            fail(derived.error, globals.format)
            return
          }
          const { fiatAmountInCents, usdcAmountInCents, conversionNote } =
            derived.amounts

          // Fetch eligible destinations (and the full list for diagnostics).
          // `countryCode` is the user's residence — used to price the fee
          // preview accurately via `applicableFee`.
          const { methods, defaultWithdrawalMethodId, countryCode } =
            await withSpinner(
              "Loading payment methods…",
              () => client.listConnectedPaymentMethods(),
              { format: globals.format }
            )
          const eligible = methods.filter(m => m.canWithdraw)
          if (eligible.length === 0) {
            fail(
              "No connected methods you can withdraw to. Add a bank or debit card in the Blaze app, then try again.",
              globals.format
            )
            return
          }

          // Resolve the target method.
          let method: ConnectedPaymentMethod
          if (opts.paymentMethodId) {
            const found = eligible.find(m => m.id === opts.paymentMethodId)
            if (!found) {
              // Distinguish "exists but not eligible" (explain why) from an id
              // that isn't one of your methods at all.
              const knownButIneligible = methods.find(
                m => m.id === opts.paymentMethodId
              )
              if (knownButIneligible) {
                fail(
                  `That method (${methodLabel(knownButIneligible)}) can't be withdrawn to: ${humanizeWithdrawIneligibilityReason(knownButIneligible.withdrawIneligibilityReason)}.`,
                  globals.format
                )
                return
              }
              fail(
                `Payment method "${opts.paymentMethodId}" is not one of your withdrawal-eligible methods. Eligible: ${eligible
                  .map(m => `${m.id} (${methodLabel(m)})`)
                  .join(", ")}.`,
                globals.format
              )
              return
            }
            method = found
          } else if (eligible.length === 1) {
            method = eligible[0]
          } else if (opts.yes) {
            const def = eligible.find(m => m.id === defaultWithdrawalMethodId)
            if (def) {
              method = def
              console.log(`Using your default method: ${methodLabel(def)}.`)
            } else {
              fail(
                `You have ${eligible.length} withdrawal-eligible methods and no default set. Pass --payment-method-id <id>: ${eligible.map(m => `${m.id} (${methodLabel(m)})`).join(", ")}.`,
                globals.format
              )
              return
            }
          } else {
            const choice = await select({
              message: "Withdraw to which payment method?",
              default: defaultWithdrawalMethodId ?? undefined,
              choices: eligible.map(m => ({
                name: `${methodLabel(m)}${m.id === defaultWithdrawalMethodId ? " (default)" : ""}`,
                value: m.id,
              })),
            })
            method = eligible.find(m => m.id === choice)!
          }

          // Minimum / limit pre-check via the live `checkLimits` query (the
          // same one the app uses) — best-effort. The minimum is server-sourced
          // (never hardcoded). If the check itself throws, stay silent and
          // continue: the server still enforces minimums/limits on submit.
          // Only the network call is best-effort. The fail()/return paths must
          // stay OUTSIDE the try so an intentional below-minimum exit is never
          // swallowed by the catch.
          let limits: WithdrawalLimits | null = null
          try {
            limits = await client.checkWithdrawalLimits({
              paymentMethodId: method.id,
              fiatAmountInCents,
              currencyCode: currency,
            })
          } catch {
            // Limit check is best-effort; the server enforces minimums/limits on submit.
          }
          if (limits && !limits.meetsMinimum) {
            const minUsd = limits.minimumAmountCents / 100
            let localNote = ""
            if (currency !== "USD") {
              // Best-effort live rate so the suggested local minimum actually
              // clears the USD minimum (the static USD_RATES table lags the
              // live rate). On failure, fall back to the buffered static
              // estimate inside the helper.
              let rate: number | null = null
              try {
                rate = await client.getExchangeRate(currency, "USD")
              } catch {
                // best-effort; fall back to the static estimate inside the helper
              }
              localNote = ` (about ${suggestedLocalMinimum(minUsd, currency, rate)} ${currency})`
            }
            fail(
              `Withdrawals must be at least $${minUsd.toFixed(2)} USD${localNote}. You entered ${opts.amount} ${currency}.`,
              globals.format
            )
            return
          }
          if (limits && !limits.isUnderLimit) {
            const rem =
              limits.remainingUsdCents != null
                ? `$${(limits.remainingUsdCents / 100).toFixed(2)} USD`
                : "none"
            fail(
              `This is over your current withdrawal limit — you have about ${rem} of your limit left right now.`,
              globals.format
            )
            return
          }

          // Fee estimate via the @Public `applicableFee` query (the same one
          // the app uses). Best-effort: a thrown/null fee must never block the
          // withdrawal — the exact fee is written to the transfer at submit.
          // Only the network call is inside the try; nothing here exits.
          //
          // We pass countryCode + paymentMethodType (NOT the card's registered
          // provider). getApplicableWithdrawalFee sends ignoreProvider so the
          // server matches the actual execution-provider config — a card's
          // withdrawal may failover from Coinflow to Bitso, so its registered
          // provider isn't the one that collects the fee.
          let feeCents: number | null = null
          const pmType = mapToPaymentMethodType(method.type)
          if (pmType) {
            try {
              const feeEst = await client.getApplicableWithdrawalFee({
                paymentMethodType: pmType,
                countryCode,
                amountCents: usdcAmountInCents,
              })
              feeCents = feeEst?.totalFeeCents ?? null
            } catch {
              // Fee preview is best-effort; the receipt shows the actual fee after submit.
            }
          }

          // Fee-aware balance pre-check — the real debit is amount + fee.
          const balance = await client.getBalance()
          const availableCents = availableCentsOf(balance)
          const requiredCents = usdcAmountInCents + (feeCents ?? 0)
          if (availableCents < requiredCents) {
            const feeNote = feeCents
              ? ` (including a $${(feeCents / 100).toFixed(2)} fee)`
              : ""
            fail(
              `You don't have enough balance for this withdrawal — it needs about $${(requiredCents / 100).toFixed(2)}${feeNote} but you have $${(availableCents / 100).toFixed(2)} available. Try a smaller amount or add funds first.`,
              globals.format
            )
            return
          }

          // Determine instant: explicit flag wins; else cards default to instant
          // (push-to-card), banks to standard. Commander sets `instant` to false
          // for --no-instant and true for --instant; undefined when neither.
          const instantTransfer =
            opts.instant !== undefined ? opts.instant : method.type === "Card"

          const label = methodLabel(method)

          // Confirmation (skipped with --yes). Spinner is not active here.
          // Surface the accurate fee + total debited from balance when we have
          // a preview; otherwise note that a fee applies (shown on the receipt).
          if (!opts.yes) {
            const feePromptNote =
              feeCents != null
                ? ` You'll pay a $${(feeCents / 100).toFixed(2)} fee — about $${((usdcAmountInCents + feeCents) / 100).toFixed(2)} USDC total from your balance.`
                : ` A withdrawal fee applies.`
            const ok = await confirm({
              message: `Withdraw ${(fiatAmountInCents / 100).toFixed(2)} ${currency}${conversionNote} to ${label}?${feePromptNote} This can't be undone.`,
              default: false,
            })
            if (!ok) {
              console.log("Cancelled.")
              return
            }
          }

          // Submit — irreversible, never retried.
          const result = await withSpinner(
            "Submitting withdrawal…",
            () =>
              client.withdrawToPaymentMethod({
                paymentMethodId: method.id,
                usdcAmountInCents,
                fiatAmountInCents,
                currencyCode: currency,
                instantTransfer,
              }),
            { format: globals.format }
          )

          if (globals.format === "json") {
            formatOutput(result, "json")
          } else {
            // Receipt: fetch the real fee from the submitted RampTransfer, but
            // fall back to the pre-submit estimate. Best-effort — the
            // withdrawal already succeeded, so a failed receipt fetch must NEVER
            // fail the command nor imply the withdrawal failed.
            const eta = estimateWithdrawalArrival({ instantTransfer, currency })
            let receiptFeeCents: number | null = feeCents
            let debitedUsdcCents: number | null = null
            try {
              if (result.rampTransferId) {
                const transfer = await client.getRampTransfer(
                  result.rampTransferId
                )
                if (
                  transfer.feeCollections &&
                  transfer.feeCollections.length > 0
                ) {
                  receiptFeeCents = totalFeeCents(transfer.feeCollections)
                }
                const usdcCents =
                  transfer.usdcAmount?.value ?? usdcAmountInCents
                debitedUsdcCents = usdcCents + (receiptFeeCents ?? 0)
              }
            } catch {
              // Receipt detail is best-effort; the withdrawal was already submitted.
            }
            console.log(
              `\n✓ Done — your withdrawal of ${(fiatAmountInCents / 100).toFixed(2)} ${currency} to ${label} is on its way.`
            )
            if (receiptFeeCents != null && debitedUsdcCents != null) {
              console.log(
                `  We took a $${(receiptFeeCents / 100).toFixed(2)} fee, so $${(debitedUsdcCents / 100).toFixed(2)} USDC left your balance.`
              )
            }
            if (result.rampTransferId) {
              console.log(
                `  ${eta} Track it anytime with: blaze withdrawals status ${result.rampTransferId}`
              )
            } else {
              console.log(`  ${eta}`)
            }
            console.log("")
          }

          // Optional watch: poll until terminal (Completed/Failed) or timeout.
          // All logging is gated behind non-json so json mode stays clean.
          if (opts.watch && result?.rampTransferId) {
            const id = result.rampTransferId
            const isJson = globals.format === "json"
            const deadline = Date.now() + 2 * 60 * 1000 // ~2 min cap
            let lastStatus = ""
            while (Date.now() < deadline) {
              await new Promise(r => setTimeout(r, 5000))
              let status: RampTransferStatusResult
              try {
                status = await client.getRampTransfer(id)
              } catch (watchErr) {
                // Auth/permission errors won't fix themselves — bubble up to the
                // outer catch. Any other transient error: soft-note and retry.
                if (
                  watchErr instanceof BlazeAuthenticationError ||
                  watchErr instanceof BlazePermissionError
                ) {
                  throw watchErr
                }
                if (!isJson) {
                  console.log("Couldn't fetch status this time, retrying…")
                }
                continue
              }
              if (status.status !== lastStatus) {
                lastStatus = status.status
                if (!isJson) {
                  console.log(formatStatusLine(status))
                }
              }
              if (status.status === "Completed" || status.status === "Failed") {
                return
              }
            }
            if (!isJson) {
              console.log(
                "Still pending after 2 minutes — check later with: blaze withdrawals status " +
                  id
              )
            }
          }
        } catch (err) {
          handleError(err, globals.format)
        }
      }
    )

  // ----------------------------------------
  // withdrawals status <rampTransferId> (personal) — poll one withdrawal
  // ----------------------------------------
  withdrawals
    .command("status <rampTransferId>")
    .description("Check the status of a personal withdrawal by its transfer ID")
    .action(async (rampTransferId: string) => {
      try {
        const globals = getGlobalOpts(program)
        // Force personal context: a personal withdrawal's status lives on the
        // personal account, so query it in personal context even when an
        // activeBusinessId is configured.
        const client = await getClient({ ...globals, personal: true })
        if (client.authContext === "business") {
          console.error(
            "Checking your own withdrawal status requires a personal login. Run 'blaze auth login' (or pass --personal)."
          )
          process.exit(1)
        }

        const transfer = await withSpinner(
          `Loading withdrawal ${rampTransferId}…`,
          () => client.getRampTransfer(rampTransferId),
          { format: globals.format }
        )

        if (globals.format === "json") {
          formatOutput(transfer, "json")
        } else {
          console.log(`\n${formatStatusLine(transfer)}\n`)
        }
      } catch (err) {
        handleError(err)
      }
    })
}
