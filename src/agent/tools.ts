import type Anthropic from "@anthropic-ai/sdk"
import type { AgentContactInput } from "../sdk/contact-payload"
import type { BlazeClient } from "../sdk/client"
import type { ScenarioAdjustment } from "../sdk/types"
import type { MemoryStore } from "./memory"
import { buildCreateContactPayload } from "../sdk/contact-payload"
import { USD_RATES, estimateUsdAmount } from "../constants/fx-rates"
import {
  deriveWithdrawalAmounts,
  formatConnectedPaymentMethodLabel,
  estimateWithdrawalArrival,
  humanizeWithdrawIneligibilityReason,
  mapToPaymentMethodType,
  suggestedLocalMinimum,
  totalFeeCents,
} from "../constants/withdrawal-format"
import {
  annotateAmounts,
  annotateRecordCounts,
  annotateSpendingSummary,
} from "./utils/format.utils"

type ToolInput = Record<string, unknown>

interface ToolDef {
  schema: Anthropic.Tool
  execute: (
    input: ToolInput,
    client: BlazeClient,
    memory: MemoryStore
  ) => Promise<unknown>
}

// ---------------------------------------------------------------------------
// Helper to build a JSON Schema property list concisely
// ---------------------------------------------------------------------------
function props(
  required: string[],
  properties: Record<string, Anthropic.Tool["input_schema"]["properties"]>
): Anthropic.Tool["input_schema"] {
  return {
    type: "object" as const,
    properties: properties as Record<
      string,
      { type: string; description?: string }
    >,
    required,
  }
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------
const toolDefs: ToolDef[] = [
  // -------------------------------------------------------------------------
  // Memory tools
  // -------------------------------------------------------------------------
  {
    schema: {
      name: "blaze_read_memory",
      description:
        "Read the agent's persistent memory: recurring payment patterns, contact aliases, and recent payment history.",
      input_schema: { type: "object", properties: {}, required: [] },
    },
    execute: async (_input, _client, memory) => memory.read(),
  },
  {
    schema: {
      name: "blaze_save_pattern",
      description:
        "Save a recurring payment pattern so it can be recalled next time the user says something like 'pay my rent'.",
      input_schema: props(["trigger"], {
        trigger: {
          type: "string",
          description:
            "The natural-language trigger phrase, e.g. 'pay my rent'",
        },
        contact_id: { type: "string", description: "Blaze contact ID" },
        contact_name: { type: "string", description: "Human-readable name" },
        blazetag: { type: "string", description: "Recipient blazetag" },
        amount: { type: "number", description: "Default payment amount" },
        currency: {
          type: "string",
          description: "Currency code, e.g. USDC or USD",
        },
        note_template: {
          type: "string",
          description:
            "Note template with optional {month}/{year} placeholders",
        },
      }),
    },
    execute: async (input, _client, memory) => {
      const { trigger, ...rest } = input as {
        trigger: string
        contact_id?: string
        contact_name?: string
        blazetag?: string
        amount?: number
        currency?: string
        note_template?: string
      }
      memory.savePattern(trigger, {
        contactId: rest.contact_id,
        contactName: rest.contact_name,
        blazetag: rest.blazetag,
        amount: rest.amount,
        currency: rest.currency,
        noteTemplate: rest.note_template,
      })
      return { success: true }
    },
  },
  {
    schema: {
      name: "blaze_log_payment",
      description:
        "Log a completed payment to agent memory for deduplication and history.",
      input_schema: props(["amount", "currency", "to", "note", "payment_id"], {
        amount: { type: "number", description: "Amount paid" },
        currency: { type: "string", description: "Currency code" },
        to: { type: "string", description: "Recipient blazetag or name" },
        note: { type: "string", description: "Payment note" },
        payment_id: { type: "string", description: "Payment ID from the API" },
      }),
    },
    execute: async (input, _client, memory) => {
      const i = input as {
        amount: number
        currency: string
        to: string
        note: string
        payment_id: string
      }
      memory.logPayment({
        date: new Date().toISOString(),
        amount: i.amount,
        currency: i.currency,
        to: i.to,
        note: i.note,
        paymentId: i.payment_id,
      })
      return { success: true }
    },
  },

  // -------------------------------------------------------------------------
  // Consumer — profile
  // -------------------------------------------------------------------------
  {
    schema: {
      name: "blaze_get_me",
      description:
        "Get the current user's profile (blazetag, name, email, etc.)",
      input_schema: { type: "object", properties: {}, required: [] },
    },
    execute: async (_input, client) => client.getMe(),
  },

  // -------------------------------------------------------------------------
  // Consumer — balance
  // -------------------------------------------------------------------------
  {
    schema: {
      name: "blaze_get_balance",
      description:
        'Get the current account balance (available and pending funds). Amounts are integer minor units (cents); each available/pending/reserved figure includes a pre-formatted `amount_display` string (e.g. "$0.60") — report `amount_display` verbatim and never divide or convert amounts yourself.',
      input_schema: { type: "object", properties: {}, required: [] },
    },
    execute: async (_input, client) => client.getBalance(),
  },

  // -------------------------------------------------------------------------
  // Consumer — contacts
  // -------------------------------------------------------------------------
  {
    schema: {
      name: "blaze_list_contacts",
      description:
        "List saved contacts (recipients) with optional search by name or blazetag.",
      input_schema: props([], {
        search: {
          type: "string",
          description: "Search term to filter contacts by name or blazetag",
        },
        limit: {
          type: "number",
          description: "Maximum number of results (default 20)",
        },
      }),
    },
    execute: async (input, client) => {
      const i = input as { search?: string; limit?: number }
      return client.listContacts({ search: i.search, limit: i.limit })
    },
  },
  {
    schema: {
      name: "blaze_add_contact",
      description:
        "Add a new contact (recipient) — bank account, CLABE, or crypto wallet. A full name (first and last) and a phone number are always required. Adding a Blaze user by blazetag is NOT supported here yet.",
      input_schema: props(["name", "phone", "type"], {
        name: {
          type: "string",
          description:
            "Contact's full name (first and last, e.g. 'Ada Lovelace'). A single name is not accepted — ask the user for the full name.",
        },
        phone: {
          type: "string",
          description:
            "Contact's phone number in E.164 format, e.g. +14155550123. Required for every contact.",
        },
        category: {
          type: "string",
          enum: ["Personal", "Business"],
          description: "Contact category (default Personal)",
        },
        email: { type: "string", description: "Contact's email address" },
        blazetag: {
          type: "string",
          description:
            "Blaze blazetag, e.g. @john. NOT supported for agent-created contacts yet.",
        },
        type: {
          type: "string",
          enum: ["bank", "clabe", "crypto"],
          description:
            "Contact type: bank (US bank account), clabe (Mexican CLABE), or crypto (stablecoin wallet)",
        },
        routing_number: {
          type: "string",
          description: "US bank routing number",
        },
        account_number: {
          type: "string",
          description: "US bank account number",
        },
        clabe: { type: "string", description: "Mexican CLABE number" },
        wallet_address: {
          type: "string",
          description: "Crypto wallet address",
        },
        network: {
          type: "string",
          enum: [
            "stellar",
            "ethereum",
            "polygon",
            "solana",
            "base",
            "arbitrum",
            "optimism",
            "avalanche",
          ],
          description:
            "Blockchain network for a crypto contact (one of: stellar, ethereum, polygon, solana, base, arbitrum, optimism, avalanche)",
        },
        memo: {
          type: "string",
          description:
            "Destination memo for the crypto address. REQUIRED when network is stellar — a Stellar contact cannot receive USDC without it. The user gets the memo from the recipient's deposit details or exchange. Optional/unused for other networks.",
        },
      }),
    },
    execute: async (input, client) => {
      // Transform the flat agent input into the nested REST shape POST
      // /v1/recipients expects. buildCreateContactPayload THROWS on invalid
      // input (no memo for Stellar, single-name, missing phone, blaze type,
      // unsupported network) — surface that message to the model so it can ask
      // the user for what's missing instead of silently creating a malformed
      // contact.
      const payload = buildCreateContactPayload(
        input as unknown as AgentContactInput
      )
      return client.createContact(payload)
    },
  },
  {
    schema: {
      name: "blaze_pay_contact",
      description:
        "Send a payment to a saved contact. Works for both bank contacts (fiat payout) and Stablecoin contacts (USDC sent on-chain to their crypto wallet). For a bank contact, resolves the first bank account if bank_account_id is omitted. For a Stablecoin contact, resolves the first crypto address if crypto_address_id is omitted. IMPORTANT: crypto (Stablecoin) sends are irreversible once submitted on-chain and cannot be cancelled or refunded — always confirm with the user before sending. Sends of $3,000 or more to a crypto wallet require beneficiary details (legal name, address, wallet type) saved on the recipient.",
      input_schema: props(["contact_id", "amount"], {
        contact_id: { type: "string", description: "Contact ID" },
        bank_account_id: {
          type: "string",
          description:
            "Bank account ID for a bank contact (resolves first bank account if omitted)",
        },
        crypto_address_id: {
          type: "string",
          description:
            "Crypto address ID for a Stablecoin contact (resolves first crypto address if omitted)",
        },
        amount: {
          type: "number",
          description:
            "Amount to send (USDC for crypto contacts; fiat in the given currency for bank contacts)",
        },
        currency: {
          type: "string",
          description:
            "Currency code for a bank contact (default USD). Ignored for crypto sends, which are always USDC.",
        },
        note: { type: "string", description: "Payment note" },
      }),
    },
    execute: async (input, client) => {
      const i = input as {
        contact_id: string
        bank_account_id?: string
        crypto_address_id?: string
        amount: number
        currency?: string
        note?: string
      }

      try {
        const contact = await client.getContact(i.contact_id)
        const contactType = (contact.type || "").toLowerCase()
        const hasCrypto = (contact.crypto_addresses || []).length > 0
        const hasBank = (contact.bank_accounts || []).length > 0
        const isCryptoContact =
          contactType === "stablecoin" ||
          contactType === "crypto" ||
          (hasCrypto && !hasBank)

        // Balance pre-check is shared by both paths.
        const balance = await client.getBalance()
        const availableCents =
          typeof balance.available === "object"
            ? (balance.available as { amount: number }).amount
            : (balance.available as number)

        if (isCryptoContact) {
          // ---- Crypto (Stablecoin) send: irreversible USDC payout ----
          const CRYPTO_MINIMUM_CENTS = 100
          const TRAVEL_RULE_THRESHOLD_CENTS = 300_000

          let cryptoAddressId = i.crypto_address_id
          let cryptoAddress = (contact.crypto_addresses || []).find(
            ca => ca.id === cryptoAddressId
          )
          if (!cryptoAddressId) {
            if (!contact.crypto_addresses?.length) {
              return {
                success: false,
                error: "Contact has no crypto addresses on file.",
              }
            }
            cryptoAddress = contact.crypto_addresses[0]
            cryptoAddressId = cryptoAddress.id
          } else if (!cryptoAddress) {
            return {
              success: false,
              error: `Crypto address ID "${cryptoAddressId}" not found on this contact.`,
            }
          }

          const usdcAmountInCents = Math.round(i.amount * 100)

          if (usdcAmountInCents < CRYPTO_MINIMUM_CENTS) {
            return {
              success: false,
              error: `Minimum crypto send is $${(CRYPTO_MINIMUM_CENTS / 100).toFixed(2)} USDC. You requested $${i.amount.toFixed(2)} USDC — amounts below the minimum are lost on-chain.`,
            }
          }

          if (usdcAmountInCents >= TRAVEL_RULE_THRESHOLD_CENTS) {
            const hasBeneficiaryData = Boolean(
              cryptoAddress?.wallet_type &&
              cryptoAddress?.beneficiary_street_line1 &&
              cryptoAddress?.beneficiary_city &&
              cryptoAddress?.beneficiary_postal_code &&
              cryptoAddress?.beneficiary_country_code
            )
            if (!hasBeneficiaryData) {
              return {
                success: false,
                error:
                  "This recipient needs beneficiary details to send $3,000 or more: add legal name, address, and wallet type to the crypto address.",
              }
            }
          }

          if (availableCents < usdcAmountInCents) {
            return {
              success: false,
              error: `Insufficient balance. You have $${(availableCents / 100).toFixed(2)} available but this requires $${(usdcAmountInCents / 100).toFixed(2)}.`,
            }
          }

          const result = await client.payContactCrypto(
            i.contact_id,
            cryptoAddressId,
            {
              usdcAmountInCents,
              amount: i.amount,
              note: i.note,
            }
          )
          return {
            success: true,
            transferId: result.id,
            status: result.status,
            network: cryptoAddress?.network,
            irreversible: true,
            // Crypto sends are 1:1 USDC — the recipient receives the sent amount.
            finalAmount: `$${(usdcAmountInCents / 100).toFixed(2)} USDC`,
            warning:
              "Crypto sends are irreversible once submitted on-chain and cannot be cancelled or refunded.",
          }
        }

        // ---- Bank contact: fiat payout ----
        let bankAccountId = i.bank_account_id
        if (!bankAccountId) {
          if (!contact.bank_accounts.length) {
            return {
              success: false,
              error: "Contact has no bank accounts on file.",
            }
          }
          bankAccountId = contact.bank_accounts[0].id
        }

        const currencyId = i.currency ?? "USD"
        const MINIMUMS: Record<string, number> = {
          USD: 1,
          MXN: 50,
          BRL: 10,
          EUR: 5,
          GBP: 5,
        }
        const minimum = MINIMUMS[currencyId.toUpperCase()] || 5
        if (i.amount < minimum) {
          return {
            success: false,
            error: `Minimum transfer amount for ${currencyId} is ${minimum} ${currencyId}. You requested ${i.amount} ${currencyId}.`,
          }
        }

        const usdcAmountInCents = Math.round(i.amount * 100)

        if (availableCents < usdcAmountInCents) {
          return {
            success: false,
            error: `Insufficient balance. You have $${(availableCents / 100).toFixed(2)} available but this requires ~$${(usdcAmountInCents / 100).toFixed(2)}.`,
          }
        }

        const result = await client.payContact(i.contact_id, bankAccountId, {
          amount: i.amount,
          currencyId,
          usdcAmountInCents,
          note: i.note,
        })
        return {
          success: true,
          transferId: result.id,
          status: result.status,
        }
      } catch (err: unknown) {
        const error = err as {
          message?: string
          statusCode?: number
          status?: number
        }
        return {
          success: false,
          error: error?.message || String(err),
          code: error?.statusCode || error?.status,
        }
      }
    },
  },
  {
    schema: {
      name: "blaze_delete_contact",
      description: "Delete a saved contact by ID.",
      input_schema: props(["id"], {
        id: { type: "string", description: "Contact ID to delete" },
      }),
    },
    execute: async (input, client) => {
      const i = input as { id: string }
      return client.deleteContact(i.id)
    },
  },

  // -------------------------------------------------------------------------
  // Consumer — P2P user search
  // -------------------------------------------------------------------------
  {
    schema: {
      name: "blaze_search_users",
      description:
        "Search for Blaze users by name or blazetag (P2P network). Returns matching users with their blazetags and public keys.",
      input_schema: props(["query"], {
        query: {
          type: "string",
          description: "Search query (name or blazetag)",
        },
        limit: {
          type: "number",
          description: "Maximum number of results (default 10)",
        },
      }),
    },
    execute: async (input, client) => {
      const i = input as { query: string; limit?: number }
      return client.searchUsers(i.query, i.limit)
    },
  },

  // -------------------------------------------------------------------------
  // Consumer — P2P payments
  // -------------------------------------------------------------------------
  {
    schema: {
      name: "blaze_send_payment",
      description: "Send a P2P payment to another Blaze user by blazetag.",
      input_schema: props(["blazetag", "amount"], {
        blazetag: {
          type: "string",
          description: "Recipient's blazetag, e.g. @john",
        },
        amount: { type: "number", description: "Amount to send in dollars" },
        currency: {
          type: "string",
          description: "Currency code (default USD)",
        },
        note: { type: "string", description: "Payment note or memo" },
      }),
    },
    execute: async (input, client) => {
      const i = input as {
        blazetag: string
        amount: number
        currency?: string
        note?: string
      }

      // Self-send validation
      const me = (await client.getMe()) as { blazetag?: string | null }
      const recipientTag = i.blazetag.replace(/^@/, "").toLowerCase()
      if (me.blazetag && me.blazetag.toLowerCase() === recipientTag) {
        return {
          success: false,
          error:
            "Cannot send a payment to yourself. Please specify a different recipient.",
        }
      }

      const currency = (i.currency ?? "USD").toUpperCase()
      const needsFx = currency !== "USD" && currency !== "USDC"

      let usdcAmountInCents: number
      let fiatAmountInCents: number | undefined
      let exchangeRate: number | undefined

      if (needsFx) {
        const estimatedUsd = estimateUsdAmount(i.amount, currency)
        usdcAmountInCents = Math.round(estimatedUsd * 100)
        fiatAmountInCents = Math.round(i.amount * 100)
        exchangeRate = USD_RATES[currency] || 1
      } else {
        usdcAmountInCents = Math.round(i.amount * 100)
      }

      // Balance pre-check
      const sendBalance = await client.getBalance()
      const sendAvailableCents =
        typeof sendBalance.available === "object"
          ? (sendBalance.available as { amount: number }).amount
          : (sendBalance.available as number)
      if (sendAvailableCents < usdcAmountInCents) {
        return {
          success: false,
          error: `Insufficient balance. You have $${(sendAvailableCents / 100).toFixed(2)} available but this requires ~$${(usdcAmountInCents / 100).toFixed(2)}.`,
        }
      }

      return client.sendPayment({
        blazetag: i.blazetag,
        usdcAmountInCents,
        fiatAmountInCents,
        currencyCode: currency,
        exchangeRate,
        note: i.note,
      })
    },
  },
  {
    schema: {
      name: "blaze_list_payments",
      description: "List recent P2P payments.",
      input_schema: props([], {
        limit: { type: "number", description: "Maximum number of results" },
      }),
    },
    execute: async (input, client) => {
      const i = input as { limit?: number }
      return client.listPayments({ limit: i.limit })
    },
  },
  {
    schema: {
      name: "blaze_get_payment",
      description: "Get details of a specific P2P payment by ID.",
      input_schema: props(["id"], {
        id: { type: "string", description: "Payment ID" },
      }),
    },
    execute: async (input, client) => {
      const i = input as { id: string }
      return client.getPayment(i.id)
    },
  },

  // -------------------------------------------------------------------------
  // Consumer — withdraw your own balance to your own connected method
  // -------------------------------------------------------------------------
  {
    schema: {
      name: "blaze_list_connected_payment_methods",
      description:
        "List the user's OWN connected payment methods (banks/debit cards) they can withdraw their balance to. By default returns only withdrawal-eligible methods; pass all:true to include ineligible ones with the reason. Use this to find a destination before blaze_withdraw.",
      input_schema: props([], {
        all: {
          type: "boolean",
          description:
            "Include methods the user can't withdraw to (default: only eligible)",
        },
      }),
    },
    execute: async (input, client) => {
      const i = input as { all?: boolean }
      if (client.authContext === "business") {
        return {
          success: false,
          error:
            "Listing your own connected methods requires a personal session (bearer token), not an API key.",
        }
      }
      const result = await client.listConnectedPaymentMethods()
      const methods = i.all
        ? result.methods
        : result.methods.filter(m => m.canWithdraw)
      return {
        methods: methods.map(m => ({
          id: m.id,
          label: formatConnectedPaymentMethodLabel(m),
          type: m.type,
          isDefault: m.id === result.defaultWithdrawalMethodId,
          canWithdraw: m.canWithdraw,
          ...(i.all && m.withdrawIneligibilityReason
            ? {
                ineligibleReason: humanizeWithdrawIneligibilityReason(
                  m.withdrawIneligibilityReason
                ),
              }
            : {}),
        })),
        defaultWithdrawalMethodId: result.defaultWithdrawalMethodId,
      }
    },
  },
  {
    schema: {
      name: "blaze_withdraw",
      description:
        "Withdraw the user's OWN balance to their OWN connected payment method (bank/debit card). IRREVERSIBLE once submitted — always confirm the amount AND destination with the user before calling. Resolves the destination from their withdrawal-eligible methods (uses the only one if there's exactly one; otherwise requires payment_method_id). For USD the USDC drawn from balance equals the fiat amount; for other currencies it's an FX estimate. Defaults to instant for cards, standard for banks.",
      input_schema: props(["amount"], {
        amount: {
          type: "number",
          description:
            "Amount to withdraw (major units, in the given currency)",
        },
        payment_method_id: {
          type: "string",
          description:
            "Connected payment method ID to withdraw to (required if the user has more than one eligible method)",
        },
        currency: {
          type: "string",
          description: "Currency code (default USD)",
        },
        instant_transfer: {
          type: "boolean",
          description:
            "Force instant (true) or standard (false). Defaults to instant for cards, standard for banks.",
        },
      }),
    },
    execute: async (input, client) => {
      const i = input as {
        amount: number
        payment_method_id?: string
        currency?: string
        instant_transfer?: boolean
      }

      try {
        if (client.authContext === "business") {
          return {
            success: false,
            error:
              "Withdrawing to your own connected method requires a personal session (bearer token), not an API key.",
          }
        }

        const currency = (i.currency ?? "USD").toUpperCase()

        // Amount + currency math via the single source of truth: validates the
        // currency, rejects zero/negative, caps at the Int max, derives cents.
        const derived = deriveWithdrawalAmounts({ amount: i.amount, currency })
        if (!derived.ok) {
          return { success: false, error: derived.error }
        }
        const { fiatAmountInCents, usdcAmountInCents } = derived.amounts

        // Resolve a withdrawal-eligible destination.
        const { methods, defaultWithdrawalMethodId } =
          await client.listConnectedPaymentMethods()
        const eligible = methods.filter(m => m.canWithdraw)
        if (eligible.length === 0) {
          return {
            success: false,
            error:
              "You have no connected methods you can withdraw to. Add a bank or debit card in the Blaze app first.",
          }
        }

        let method = eligible.find(m => m.id === i.payment_method_id)
        if (i.payment_method_id && !method) {
          // Distinguish "exists but ineligible" (explain why) from an unknown id.
          const knownButIneligible = methods.find(
            m => m.id === i.payment_method_id
          )
          if (knownButIneligible) {
            return {
              success: false,
              error: `That method (${formatConnectedPaymentMethodLabel(knownButIneligible)}) can't be withdrawn to: ${humanizeWithdrawIneligibilityReason(knownButIneligible.withdrawIneligibilityReason)}.`,
            }
          }
          return {
            success: false,
            error: `Payment method "${i.payment_method_id}" is not one of your withdrawal-eligible methods.`,
          }
        }
        if (!method) {
          if (eligible.length > 1) {
            return {
              success: false,
              error: `You have ${eligible.length} withdrawal-eligible methods. Ask the user which one, then pass payment_method_id. Default is ${defaultWithdrawalMethodId ?? "none"}.`,
              methods: eligible.map(m => ({
                id: m.id,
                type: m.type,
                displayName: m.displayName,
              })),
            }
          }
          method = eligible[0]
        }

        // Minimum / limit pre-check via the live `checkLimits` query — the
        // minimum is server-sourced (never hardcoded). Best-effort: if the
        // check itself throws, continue (the server enforces on submit).
        try {
          const limits = await client.checkWithdrawalLimits({
            paymentMethodId: method.id,
            fiatAmountInCents,
            currencyCode: currency,
          })
          if (!limits.meetsMinimum) {
            const minUsd = limits.minimumAmountCents / 100
            let localNote = ""
            if (currency !== "USD") {
              // Best-effort live rate so the suggested local minimum actually
              // clears the USD minimum (the static USD_RATES table lags).
              let rate: number | null = null
              try {
                rate = await client.getExchangeRate(currency, "USD")
              } catch {
                // best-effort; fall back to the static estimate inside the helper
              }
              localNote = ` (about ${suggestedLocalMinimum(minUsd, currency, rate)} ${currency})`
            }
            return {
              success: false,
              error: `Withdrawals must be at least $${minUsd.toFixed(2)} USD${localNote}. You entered ${i.amount} ${currency}.`,
            }
          }
          if (!limits.isUnderLimit) {
            const rem =
              limits.remainingUsdCents != null
                ? `$${(limits.remainingUsdCents / 100).toFixed(2)} USD`
                : "none"
            return {
              success: false,
              error: `This is over your current withdrawal limit — you have about ${rem} of your limit left right now.`,
            }
          }
        } catch {
          // Limit check is best-effort; the server enforces minimums/limits on submit.
        }

        // Balance pre-check (against the USDC amount drawn from balance).
        const balance = await client.getBalance()
        const availableCents =
          typeof balance.available === "object"
            ? (balance.available as { amount: number }).amount
            : (balance.available as number)
        if (availableCents < usdcAmountInCents) {
          return {
            success: false,
            error: `You don't have enough balance for this withdrawal — it needs about $${(usdcAmountInCents / 100).toFixed(2)} but you have $${(availableCents / 100).toFixed(2)} available. Try a smaller amount or add funds first.`,
          }
        }

        const instantTransfer =
          i.instant_transfer !== undefined
            ? i.instant_transfer
            : method.type === "Card"

        const result = await client.withdrawToPaymentMethod({
          paymentMethodId: method.id,
          usdcAmountInCents,
          fiatAmountInCents,
          currencyCode: currency,
          instantTransfer,
        })
        const eta = estimateWithdrawalArrival({ instantTransfer, currency })
        // Best-effort: fetch the real fee from the submitted transfer. The
        // withdrawal already succeeded, so a failed fetch must NOT error out.
        let fee: string | undefined
        try {
          if (result.rampTransferId) {
            const t = await client.getRampTransfer(result.rampTransferId)
            const fc = totalFeeCents(t.feeCollections)
            if (fc > 0) fee = `$${(fc / 100).toFixed(2)}`
          }
        } catch {
          /* best-effort */
        }
        return {
          success: true,
          status: result.status,
          rampTransferId: result.rampTransferId,
          fee, // e.g. "$2.00" (undefined if unknown)
          estimatedArrival: eta,
          summary: `Your withdrawal of ${i.amount} ${currency} to ${formatConnectedPaymentMethodLabel(method)} is on its way${fee ? ` (fee ${fee})` : ""}. ${eta}`,
          irreversible: true,
        }
      } catch (err: unknown) {
        const error = err as {
          message?: string
          statusCode?: number
          status?: number
        }
        return {
          success: false,
          error: error?.message || String(err),
          code: error?.statusCode || error?.status,
        }
      }
    },
  },
  {
    schema: {
      name: "blaze_estimate_withdrawal_fee",
      description:
        "Preview the EXACT withdrawal fee for one of the user's connected payment methods BEFORE withdrawing (read-only; no money moves). Use this to tell the user the fee and total debited before they confirm an irreversible withdrawal. Uses the same applicableFee calculation the app shows.",
      input_schema: props(["payment_method_id", "amount"], {
        payment_method_id: {
          type: "string",
          description: "Connected payment method ID to estimate the fee for",
        },
        amount: {
          type: "number",
          description:
            "Amount to withdraw (major units, in the given currency)",
        },
        currency: {
          type: "string",
          description: "Currency code (default USD)",
        },
      }),
    },
    execute: async (input, client) => {
      const i = input as {
        payment_method_id: string
        amount: number
        currency?: string
      }
      try {
        const { methods, countryCode } =
          await client.listConnectedPaymentMethods()
        const method = methods.find(m => m.id === i.payment_method_id)
        if (!method || !method.canWithdraw) {
          return {
            success: false,
            error: `Payment method "${i.payment_method_id}" is not one of your withdrawal-eligible methods.`,
          }
        }

        const currency = (i.currency ?? "USD").toUpperCase()
        const derived = deriveWithdrawalAmounts({ amount: i.amount, currency })
        if (!derived.ok) {
          return { success: false, error: derived.error }
        }
        const { usdcAmountInCents } = derived.amounts

        const pmType = mapToPaymentMethodType(method.type)
        const feeEst = pmType
          ? await client.getApplicableWithdrawalFee({
              paymentMethodType: pmType,
              providerId: method.provider?.id,
              countryCode,
              amountCents: usdcAmountInCents,
            })
          : null
        const feeCents = feeEst?.totalFeeCents ?? null

        return {
          success: true,
          feeCents,
          feeUsd: feeCents != null ? `$${(feeCents / 100).toFixed(2)}` : null,
          displayName: feeEst?.displayName ?? null,
          totalDebitedUsdc: `$${((usdcAmountInCents + (feeCents ?? 0)) / 100).toFixed(2)}`,
          note: "Estimate; the exact fee is confirmed at withdrawal.",
        }
      } catch (err: unknown) {
        const error = err as {
          message?: string
          statusCode?: number
          status?: number
        }
        return {
          success: false,
          error: error?.message || String(err),
          code: error?.statusCode || error?.status,
        }
      }
    },
  },

  // -------------------------------------------------------------------------
  // Consumer — transactions
  // -------------------------------------------------------------------------
  {
    schema: {
      name: "blaze_list_transactions",
      description:
        "List account transactions with optional type and status filters. Each transaction's `amount` is in integer minor units (cents) with a pre-formatted `amount_display` string — report `amount_display` verbatim and never convert amounts yourself. Report each transaction's `status` exactly as returned; never relabel or infer it. The result also includes a `summary` with `count` and `by_status` — report those counts verbatim; never tally the list yourself, and never show more rows than the tool returned.",
      input_schema: props([], {
        limit: { type: "number", description: "Maximum number of results" },
        type: {
          type: "string",
          description: "Transaction type filter, e.g. payment, transfer",
        },
        status: {
          type: "string",
          description: "Transaction status filter, e.g. completed, pending",
        },
      }),
    },
    execute: async (input, client) => {
      const i = input as { limit?: number; type?: string; status?: string }
      return client.listTransactions({
        limit: i.limit,
        type: i.type,
        status: i.status,
      })
    },
  },
  {
    schema: {
      name: "blaze_get_transaction",
      description: "Get details of a specific transaction by ID.",
      input_schema: props(["id"], {
        id: { type: "string", description: "Transaction ID" },
      }),
    },
    execute: async (input, client) => {
      const i = input as { id: string }
      return client.getTransaction(i.id)
    },
  },

  // -------------------------------------------------------------------------
  // FX
  // -------------------------------------------------------------------------
  {
    schema: {
      name: "blaze_fx_quote",
      description:
        "Get a foreign exchange quote for converting between currencies. Always show this to the user before executing a cross-border payment.",
      input_schema: props(["from", "to", "amount"], {
        from: { type: "string", description: "Source currency code, e.g. USD" },
        to: { type: "string", description: "Target currency code, e.g. MXN" },
        amount: {
          type: "number",
          description: "Amount in the source currency",
        },
      }),
    },
    execute: async (input, client) => {
      const i = input as { from: string; to: string; amount: number }
      return client.createFxQuote({
        from_currency: i.from,
        to_currency: i.to,
        amount: i.amount,
      })
    },
  },
  {
    schema: {
      name: "blaze_fx_rates",
      description:
        "Get current FX exchange rates for all currencies, optionally relative to a base currency.",
      input_schema: props([], {
        base: {
          type: "string",
          description: "Base currency code, e.g. USD (default)",
        },
      }),
    },
    execute: async (input, client) => {
      const i = input as { base?: string }
      return client.getFxRates(i.base)
    },
  },

  // -------------------------------------------------------------------------
  // Insights (Plaid-derived bank spend, read-only)
  // -------------------------------------------------------------------------
  {
    schema: {
      name: "blaze_get_spending_summary",
      description:
        "Read a summary of the business's bank spending (by category, top merchants) over an optional date range. Read-only insight; amounts are provided both as integer cents (`*_cents`/`totalCents`) and as pre-formatted USD strings (`total_spending`, per-entry `total`) — report the formatted dollar values; do not recompute totals.",
      input_schema: props([], {
        start_date: {
          type: "string",
          description: "Start of the date range (ISO 8601, e.g. 2025-01-01)",
        },
        end_date: {
          type: "string",
          description: "End of the date range (ISO 8601, e.g. 2025-01-31)",
        },
      }),
    },
    execute: async (input, client) => {
      const i = input as { start_date?: string; end_date?: string }
      const res = await client.getInsightsSummary({
        start_date: i.start_date,
        end_date: i.end_date,
      })
      return annotateSpendingSummary(res)
    },
  },
  {
    schema: {
      name: "blaze_list_bank_transactions",
      description:
        "List the business's bank transactions (from connected Plaid accounts) with optional date range, account filter, and pagination. Read-only insight; amounts are in integer cents.",
      input_schema: props([], {
        start_date: {
          type: "string",
          description: "Start of the date range (ISO 8601, e.g. 2025-01-01)",
        },
        end_date: {
          type: "string",
          description: "End of the date range (ISO 8601, e.g. 2025-01-31)",
        },
        plaid_account_data_id: {
          type: "string",
          description: "Filter to a single connected Plaid account",
        },
        limit: {
          type: "number",
          description: "Maximum number of results (1-100)",
        },
        cursor: { type: "string", description: "Pagination cursor" },
      }),
    },
    execute: async (input, client) => {
      const i = input as {
        start_date?: string
        end_date?: string
        plaid_account_data_id?: string
        limit?: number
        cursor?: string
      }
      return client.listBankTransactions({
        start_date: i.start_date,
        end_date: i.end_date,
        plaid_account_data_id: i.plaid_account_data_id,
        limit: i.limit,
        cursor: i.cursor,
      })
    },
  },
  {
    schema: {
      name: "blaze_get_bank_balances",
      description:
        "Read live available/current balances of the business's connected bank accounts (how much cash the business has). Read-only insight; balances are in major units (e.g. dollars).",
      input_schema: { type: "object", properties: {}, required: [] },
    },
    execute: async (_input, client) => client.getBankBalances(),
  },

  // -------------------------------------------------------------------------
  // Business — balance
  // -------------------------------------------------------------------------
  {
    schema: {
      name: "blaze_get_business_balance",
      description:
        "Get the business account balance (for API key users). Same as blaze_get_balance but semantically labelled for business context.",
      input_schema: { type: "object", properties: {}, required: [] },
    },
    execute: async (_input, client) => client.getBalance(),
  },

  // -------------------------------------------------------------------------
  // Business — customers
  // -------------------------------------------------------------------------
  {
    schema: {
      name: "blaze_list_customers",
      description:
        "List business customers with optional email filter and pagination.",
      input_schema: props([], {
        limit: { type: "number", description: "Maximum number of results" },
        email: {
          type: "string",
          description: "Filter customers by exact email address",
        },
      }),
    },
    execute: async (input, client) => {
      const i = input as { limit?: number; email?: string }
      return client.listCustomers({ limit: i.limit, email: i.email })
    },
  },
  {
    schema: {
      name: "blaze_get_customer",
      description: "Get a single business customer by ID.",
      input_schema: props(["id"], {
        id: { type: "string", description: "Customer ID" },
      }),
    },
    execute: async (input, client) => {
      const i = input as { id: string }
      return client.getCustomer(i.id)
    },
  },
  {
    schema: {
      name: "blaze_create_customer",
      description: "Create a new business customer.",
      input_schema: props(["email"], {
        email: { type: "string", description: "Customer's email address" },
        first_name: { type: "string", description: "First name" },
        last_name: { type: "string", description: "Last name" },
        phone: { type: "string", description: "Phone number" },
        type: { type: "string", description: "Customer type" },
      }),
    },
    execute: async (input, client) => {
      const i = input as {
        email: string
        first_name?: string
        last_name?: string
        phone?: string
        type?: string
      }
      return client.createCustomer({
        email: i.email,
        first_name: i.first_name,
        last_name: i.last_name,
        phone: i.phone,
      })
    },
  },

  // -------------------------------------------------------------------------
  // Business — transfers
  // -------------------------------------------------------------------------
  {
    schema: {
      name: "blaze_list_transfers",
      description: "List business transfers with optional status filter.",
      input_schema: props([], {
        limit: { type: "number", description: "Maximum number of results" },
        status: {
          type: "string",
          description: "Filter by status: pending, completed, failed",
        },
      }),
    },
    execute: async (input, client) => {
      const i = input as { limit?: number; status?: string }
      return client.listTransfers({ limit: i.limit, status: i.status })
    },
  },
  {
    schema: {
      name: "blaze_create_transfer",
      description:
        "Create a business transfer to a customer or external account.",
      input_schema: props(["amount", "destination_id"], {
        amount: { type: "number", description: "Amount to transfer" },
        currency: { type: "string", description: "Currency code" },
        customer_id: { type: "string", description: "Destination customer ID" },
        destination_id: {
          type: "string",
          description: "Destination account or wallet ID",
        },
        note: { type: "string", description: "Transfer note or memo" },
      }),
    },
    execute: async (input, client) => {
      const i = input as {
        amount: number
        currency?: string
        customer_id?: string
        destination_id: string
        note?: string
      }
      return client.createTransfer({
        amount: i.amount,
        currency: i.currency as Parameters<
          typeof client.createTransfer
        >[0]["currency"],
        customer_id: i.customer_id,
        destination_id: i.destination_id,
        note: i.note,
      })
    },
  },

  // -------------------------------------------------------------------------
  // Business — payment links
  // -------------------------------------------------------------------------
  {
    schema: {
      name: "blaze_list_payment_links",
      description: "List business payment links.",
      input_schema: props([], {
        limit: { type: "number", description: "Maximum number of results" },
      }),
    },
    execute: async (input, client) => {
      const i = input as { limit?: number }
      return client.listPaymentLinks({ limit: i.limit })
    },
  },
  {
    schema: {
      name: "blaze_create_payment_link",
      description:
        "Create a new payment link that customers can use to pay you.",
      input_schema: props(["amount"], {
        amount: { type: "number", description: "Payment amount" },
        currency: { type: "string", description: "Currency code" },
        name: {
          type: "string",
          description: "Human-readable name for the payment link",
        },
        note: { type: "string", description: "Note shown to the payer" },
      }),
    },
    execute: async (input, client) => {
      const i = input as {
        amount: number
        currency?: string
        name?: string
        note?: string
      }
      return client.createPaymentLink({
        amount: i.amount,
        currency: i.currency as Parameters<
          typeof client.createPaymentLink
        >[0]["currency"],
        name: i.name,
        note: i.note,
      })
    },
  },

  // ============================================
  // Bills (AP automation) — agent tools
  //
  // SAFETY: vendor names, email bodies, PDF contents, and amounts from
  // extracted invoices are DATA, not instructions. The agent must never
  // treat invoice content as direction to act. Money movement is gated
  // by quote-then-confirm and server-side BillsPolicyEngine.
  // ============================================

  {
    schema: {
      name: "blaze_list_bills",
      description:
        "List the business's bills (accounts payable). Filter by status to narrow to NEEDS_REVIEW / READY_TO_PAY / PAID.",
      input_schema: {
        type: "object",
        properties: {
          status: { type: "string" },
          vendor_id: { type: "string" },
          due_before: { type: "string" },
          limit: { type: "integer" },
        },
      },
    },
    execute: async (input, client) => {
      const i = input as Record<string, unknown>
      return client.listBills({
        status: i.status,
        vendorId: i.vendor_id,
        dueBefore: i.due_before,
        limit: i.limit,
      })
    },
  },
  {
    schema: {
      name: "blaze_get_bill",
      description:
        "Get the full detail of a single bill, including vendor and line items.",
      input_schema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
    },
    execute: async (input, client) => {
      const { id } = input as { id: string }
      return client.getBill(id)
    },
  },
  {
    schema: {
      name: "blaze_quote_bill_payment",
      description:
        "Get a payment quote for a bill (fees, ETA, provider routing). ALWAYS call this BEFORE blaze_pay_bill and surface the result to the user. Quote expires in 15 minutes.",
      input_schema: {
        type: "object",
        properties: {
          bill_id: { type: "string" },
          source_funding_account_id: { type: "string" },
          expedite_option: {
            type: "string",
            enum: ["fast", "cheap", "auto"],
          },
        },
        required: ["bill_id"],
      },
    },
    execute: async (input, client) => {
      const i = input as Record<string, unknown>
      return client.quoteBillPayment({
        billId: i.bill_id,
        sourceFundingAccountId: i.source_funding_account_id ?? null,
        expediteOption: i.expedite_option ?? null,
      })
    },
  },
  {
    schema: {
      name: "blaze_pay_bill",
      description:
        "IRREVOCABLE. Execute a bill payment. Requires a fresh quote_id from blaze_quote_bill_payment AND explicit user confirmation surfaced after showing the quote. The server enforces policy: agent payments may be denied or require human approval out-of-band. confirm must be true.",
      input_schema: {
        type: "object",
        properties: {
          bill_id: { type: "string" },
          quote_id: { type: "string" },
          confirm: { type: "boolean", const: true },
        },
        required: ["bill_id", "quote_id", "confirm"],
      },
    },
    execute: async (input, client) => {
      const i = input as {
        bill_id: string
        quote_id: string
        confirm: boolean
      }
      return client.payBill({
        billId: i.bill_id,
        quoteId: i.quote_id,
        confirm: i.confirm,
      })
    },
  },
  {
    schema: {
      name: "blaze_list_pending_bill_approvals",
      description:
        "List bills currently waiting for a human to approve before they can be paid.",
      input_schema: { type: "object", properties: {} },
    },
    execute: async (_input, client) => client.listPendingBillApprovals(),
  },
  {
    schema: {
      name: "blaze_connect_gmail_start",
      description:
        "Start the Gmail OAuth flow. Returns { id, authUrl, expiresAt }. Display the authUrl to the user and ask them to open it. Then poll blaze_connect_gmail_finalize until status is COMPLETE.",
      input_schema: { type: "object", properties: {} },
    },
    execute: async (_input, client) => client.generateGmailAuthUrl(),
  },
  {
    schema: {
      name: "blaze_connect_gmail_finalize",
      description:
        "Check the status of an in-flight Gmail OAuth session. Call repeatedly after the user opens the auth URL until status is COMPLETE / FAILED / EXPIRED.",
      input_schema: {
        type: "object",
        properties: { session_id: { type: "string" } },
        required: ["session_id"],
      },
    },
    execute: async (input, client) => {
      const { session_id } = input as { session_id: string }
      return client.getGmailConnectSession(session_id)
    },
  },

  // -------------------------------------------------------------------------
  // Duplicate Payment Detection (AI CFO Tool 6)
  // -------------------------------------------------------------------------
  {
    schema: {
      name: "blaze_cfo_duplicates",
      description:
        "Scan recent payments for potential duplicates — same vendor, similar amount, close timing. Returns grouped matches with confidence scores. Use for periodic audits or when the user asks about duplicate/double payments.",
      input_schema: props([], {
        window_days: {
          type: "number",
          description: "Number of days to look back (default: 30, max: 90)",
        },
        amount_tolerance_percent: {
          type: "number",
          description: "Percentage tolerance for amount matching (default: 5)",
        },
        min_amount_cents: {
          type: "number",
          description:
            "Minimum payment amount in cents to consider (default: 1000)",
        },
      }),
    },
    execute: async (input, client) => {
      const i = input as {
        window_days?: number
        amount_tolerance_percent?: number
        min_amount_cents?: number
      }
      return client.scanDuplicates(i)
    },
  },
  {
    schema: {
      name: "blaze_cfo_check_duplicate",
      description:
        "Check if a payment about to be made looks like a duplicate of a recent payment to the same vendor. Call BEFORE executing a transfer or bill payment to warn the user about potential duplicates.",
      input_schema: props(["vendor_name", "amount_cents"], {
        vendor_name: {
          type: "string",
          description: "Vendor/recipient name for the payment",
        },
        amount_cents: {
          type: "number",
          description: "Payment amount in cents",
        },
      }),
    },
    execute: async (input, client) => {
      const i = input as { vendor_name: string; amount_cents: number }
      return client.checkDuplicate(i)
    },
  },

  // -------------------------------------------------------------------------
  // Cash Flow Forecast (AI CFO Tool 1)
  // -------------------------------------------------------------------------
  {
    schema: {
      name: "blaze_cfo_forecast",
      description:
        'Project cash flow and runway from recurring Plaid bank activity plus upcoming invoices and bills. READ-ONLY. Use to answer "what\'s my runway / cash flow forecast / when do I run out of cash".',
      input_schema: props([], {
        horizon_days: {
          type: "number",
          description: "Number of days to project forward (default: 90)",
        },
      }),
    },
    execute: async (input, client) => {
      const i = input as { horizon_days?: number }
      return client.getCashFlowForecast({ horizon_days: i.horizon_days ?? 90 })
    },
  },

  // -------------------------------------------------------------------------
  // Payroll Intelligence (AI CFO Tool 8)
  // -------------------------------------------------------------------------
  {
    schema: {
      name: "blaze_cfo_payroll",
      description:
        "Analyze payroll patterns from linked bank accounts. Detects providers (Gusto, ADP, Rippling, etc.), pay frequency, monthly cost, headcount estimate, and contractor payments needing 1099 reporting. READ-ONLY.",
      input_schema: props([], {
        window_days: {
          type: "number",
          description:
            "Number of days to look back for payroll patterns (default: 180, max: 365)",
        },
      }),
    },
    execute: async (input, client) => {
      const i = input as { window_days?: number }
      return client.getPayrollAnalysis({ window_days: i.window_days })
    },
  },

  // -------------------------------------------------------------------------
  // Scenario Modeling (AI CFO Tool 4)
  // -------------------------------------------------------------------------
  {
    schema: {
      name: "blaze_cfo_scenario",
      description:
        'Model a "what if" financial scenario by applying adjustments (hiring, revenue change, big purchase, delayed receivable) to the cash flow forecast baseline. Returns monthly projections, runway, break-even date, and a comparison to baseline. READ-ONLY. Use to answer "what if we hire 2 engineers / revenue drops 20% / we lose our biggest client".',
      input_schema: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "A descriptive name for this scenario",
          },
          adjustments: {
            type: "array",
            description:
              "List of adjustments to apply to the baseline forecast",
            items: {
              type: "object",
              properties: {
                type: {
                  type: "string",
                  enum: [
                    "revenue_change_percent",
                    "new_recurring_expense",
                    "remove_recurring_expense",
                    "one_time_cost",
                    "one_time_income",
                    "delay_receivable",
                  ],
                },
                percentage: { type: "number" },
                amount_cents: { type: "number" },
                frequency: {
                  type: "string",
                  enum: [
                    "weekly",
                    "biweekly",
                    "monthly",
                    "quarterly",
                    "one_time",
                  ],
                },
                start_date: { type: "string" },
                end_date: { type: "string" },
                description: { type: "string" },
              },
              required: ["type"],
            },
          },
          horizon_days: {
            type: "number",
            description: "Number of days to project forward (default: 90)",
          },
        },
        required: ["name", "adjustments"],
      },
    },
    execute: async (input, client) => {
      const i = input as {
        name: string
        adjustments: ScenarioAdjustment[]
        horizon_days?: number
      }
      return client.modelScenario({
        name: i.name,
        adjustments: i.adjustments ?? [],
        horizon_days: i.horizon_days ?? 90,
      })
    },
  },

  // -------------------------------------------------------------------------
  // Bank Reconciliation (AI CFO Tool 3)
  // -------------------------------------------------------------------------
  {
    schema: {
      name: "blaze_cfo_reconcile",
      description:
        'Reconcile Plaid bank transactions against internal payment records for a period. Returns matched pairs, unmatched bank/internal items, discrepancies, and the reconciliation rate. READ-ONLY. Use to answer "reconcile my bank account", "match my transactions", or "what transactions are missing from my records".',
      input_schema: props(["period_start", "period_end"], {
        period_start: {
          type: "string",
          description:
            "Start of the reconciliation period (ISO 8601, e.g. 2025-01-01)",
        },
        period_end: {
          type: "string",
          description:
            "End of the reconciliation period (ISO 8601, e.g. 2025-01-31)",
        },
        account_id: {
          type: "string",
          description:
            "Specific bank account ID to reconcile (default: all accounts)",
        },
      }),
    },
    execute: async (input, client) => {
      const i = input as {
        period_start: string
        period_end: string
        account_id?: string
      }
      return client.reconcileBankAccounts({
        period_start: i.period_start,
        period_end: i.period_end,
        account_id: i.account_id,
      })
    },
  },

  // -------------------------------------------------------------------------
  // Accounting (QuickBooks / Xero / Puzzle integration)
  // -------------------------------------------------------------------------
  {
    schema: {
      name: "blaze_get_profit_and_loss",
      description:
        "Get a Profit & Loss (income statement) report from the connected accounting system (QuickBooks, Xero, or Puzzle). Shows revenue, expenses, and net income for a date range.",
      input_schema: props(["start_date", "end_date"], {
        start_date: {
          type: "string",
          description: "Start date (ISO 8601, e.g. 2026-01-01)",
        },
        end_date: {
          type: "string",
          description: "End date (ISO 8601, e.g. 2026-06-30)",
        },
        basis: {
          type: "string",
          enum: ["cash", "accrual"],
          description: "Accounting basis (default: accrual).",
        },
        provider: {
          type: "string",
          description:
            "Provider (quickbooks, xero, or puzzle). Omit if only one is connected.",
        },
      }),
    },
    execute: async (input, client) => {
      const i = input as {
        start_date: string
        end_date: string
        basis?: "cash" | "accrual"
        provider?: string
      }
      return client.getProfitAndLoss(i)
    },
  },
  {
    schema: {
      name: "blaze_get_balance_sheet",
      description:
        "Get a Balance Sheet report showing assets, liabilities, and equity as of a specific date from the connected accounting system (QuickBooks, Xero, or Puzzle).",
      input_schema: props([], {
        as_of: {
          type: "string",
          description: "Report date (ISO 8601). Defaults to today.",
        },
        basis: {
          type: "string",
          enum: ["cash", "accrual"],
          description: "Accounting basis (default: accrual).",
        },
        provider: {
          type: "string",
          description:
            "Provider (quickbooks, xero, or puzzle). Omit if only one is connected.",
        },
      }),
    },
    execute: async (input, client) => {
      const i = input as {
        as_of?: string
        basis?: "cash" | "accrual"
        provider?: string
      }
      return client.getBalanceSheet(i)
    },
  },
  {
    schema: {
      name: "blaze_get_chart_of_accounts",
      description:
        "List all accounts from the connected accounting system (QuickBooks, Xero, or Puzzle) — revenue, expense, asset, liability, equity accounts. Useful for finding account IDs before creating journal entries.",
      input_schema: props([], {
        provider: {
          type: "string",
          description:
            "Provider (quickbooks, xero, or puzzle). Omit if only one is connected.",
        },
      }),
    },
    execute: async (input, client) => {
      const i = input as { provider?: string }
      return client.getChartOfAccounts(i)
    },
  },
  {
    schema: {
      name: "blaze_get_trial_balance",
      description:
        "Get a Trial Balance report from the connected accounting system (QuickBooks, Xero, or Puzzle). Shows debit and credit totals per account for a date range and whether the books balance.",
      input_schema: props(["start_date", "end_date"], {
        start_date: {
          type: "string",
          description: "Start date (ISO 8601, e.g. 2026-01-01)",
        },
        end_date: {
          type: "string",
          description: "End date (ISO 8601, e.g. 2026-06-30)",
        },
        basis: {
          type: "string",
          enum: ["cash", "accrual"],
          description: "Accounting basis (default: accrual).",
        },
        provider: {
          type: "string",
          description:
            "Provider (quickbooks, xero, or puzzle). Omit if only one is connected.",
        },
      }),
    },
    execute: async (input, client) => {
      const i = input as {
        start_date: string
        end_date: string
        basis?: "cash" | "accrual"
        provider?: string
      }
      return client.getTrialBalance(i)
    },
  },
  {
    schema: {
      name: "blaze_get_cash_activity",
      description:
        "Get a Cash Activity Statement from the connected accounting system (QuickBooks, Xero, or Puzzle). Shows cash inflows and outflows for a date range.",
      input_schema: props(["start_date", "end_date"], {
        start_date: {
          type: "string",
          description: "Start date (ISO 8601, e.g. 2026-01-01)",
        },
        end_date: {
          type: "string",
          description: "End date (ISO 8601, e.g. 2026-06-30)",
        },
        provider: {
          type: "string",
          description:
            "Provider (quickbooks, xero, or puzzle). Omit if only one is connected.",
        },
      }),
    },
    execute: async (input, client) => {
      const i = input as {
        start_date: string
        end_date: string
        provider?: string
      }
      return client.getCashActivity(i)
    },
  },
  {
    schema: {
      name: "blaze_get_vendor_spending",
      description:
        "Get a Vendor Spending report from the connected accounting system (QuickBooks, Xero, or Puzzle). Shows spending grouped by vendor for a date range.",
      input_schema: props(["start_date", "end_date"], {
        start_date: {
          type: "string",
          description: "Start date (ISO 8601, e.g. 2026-01-01)",
        },
        end_date: {
          type: "string",
          description: "End date (ISO 8601, e.g. 2026-06-30)",
        },
        provider: {
          type: "string",
          description:
            "Provider (quickbooks, xero, or puzzle). Omit if only one is connected.",
        },
      }),
    },
    execute: async (input, client) => {
      const i = input as {
        start_date: string
        end_date: string
        provider?: string
      }
      return client.getVendorSpending(i)
    },
  },
  {
    schema: {
      name: "blaze_list_accounting_transactions",
      description:
        "List transaction history from the connected accounting system (QuickBooks, Xero, or Puzzle). Read-only; supports date range and pagination.",
      input_schema: props([], {
        start_date: {
          type: "string",
          description: "Start date (ISO 8601, e.g. 2026-01-01)",
        },
        end_date: {
          type: "string",
          description: "End date (ISO 8601, e.g. 2026-06-30)",
        },
        limit: { type: "number", description: "Maximum number of results" },
        offset: { type: "number", description: "Pagination offset" },
        provider: {
          type: "string",
          description:
            "Provider (quickbooks, xero, or puzzle). Omit if only one is connected.",
        },
      }),
    },
    execute: async (input, client) => {
      const i = input as {
        start_date?: string
        end_date?: string
        limit?: number
        offset?: number
        provider?: string
      }
      return client.getAccountingTransactions(i)
    },
  },
  {
    schema: {
      name: "blaze_list_accounting_bills",
      description:
        "List bill (accounts payable) history from the connected accounting system (QuickBooks, Xero, or Puzzle). Read-only; supports status filter, date range, and pagination.",
      input_schema: props([], {
        status: {
          type: "string",
          description: "Filter by bill status",
        },
        start_date: {
          type: "string",
          description: "Start date (ISO 8601, e.g. 2026-01-01)",
        },
        end_date: {
          type: "string",
          description: "End date (ISO 8601, e.g. 2026-06-30)",
        },
        limit: { type: "number", description: "Maximum number of results" },
        offset: { type: "number", description: "Pagination offset" },
        provider: {
          type: "string",
          description:
            "Provider (quickbooks, xero, or puzzle). Omit if only one is connected.",
        },
      }),
    },
    execute: async (input, client) => {
      const i = input as {
        status?: string
        start_date?: string
        end_date?: string
        limit?: number
        offset?: number
        provider?: string
      }
      return client.getAccountingBills(i)
    },
  },
  {
    schema: {
      name: "blaze_list_accounting_invoices",
      description:
        "List invoice (accounts receivable) history from the connected accounting system (QuickBooks, Xero, or Puzzle). Read-only; supports status filter, date range, and pagination.",
      input_schema: props([], {
        status: {
          type: "string",
          description: "Filter by invoice status",
        },
        start_date: {
          type: "string",
          description: "Start date (ISO 8601, e.g. 2026-01-01)",
        },
        end_date: {
          type: "string",
          description: "End date (ISO 8601, e.g. 2026-06-30)",
        },
        limit: { type: "number", description: "Maximum number of results" },
        offset: { type: "number", description: "Pagination offset" },
        provider: {
          type: "string",
          description:
            "Provider (quickbooks, xero, or puzzle). Omit if only one is connected.",
        },
      }),
    },
    execute: async (input, client) => {
      const i = input as {
        status?: string
        start_date?: string
        end_date?: string
        limit?: number
        offset?: number
        provider?: string
      }
      return client.getAccountingInvoices(i)
    },
  },
  {
    schema: {
      name: "blaze_sync_bills_from_accounting",
      description:
        "Pull bills (accounts payable) from the connected accounting system (QuickBooks, Xero, or Puzzle) into Blaze's bills module. This syncs data with the connected accounting provider. Idempotent — already-pulled bills are skipped. Returns a { processed, created, skipped } summary.",
      input_schema: props([], {
        provider: {
          type: "string",
          description:
            "Provider (quickbooks, xero, or puzzle). Omit if only one is connected.",
        },
      }),
    },
    execute: async (input, client) => {
      const i = input as { provider?: string }
      return client.syncBillsFromAccounting({ provider: i.provider })
    },
  },
  {
    schema: {
      name: "blaze_sync_invoices_from_accounting",
      description:
        "Pull invoices (accounts receivable) from the connected accounting system (QuickBooks, Xero, or Puzzle) into Blaze. This syncs data with the connected accounting provider. Idempotent — already-pulled invoices are skipped. Returns a { processed, created, skipped } summary.",
      input_schema: props([], {
        provider: {
          type: "string",
          description:
            "Provider (quickbooks, xero, or puzzle). Omit if only one is connected.",
        },
      }),
    },
    execute: async (input, client) => {
      const i = input as { provider?: string }
      return client.syncInvoicesFromAccounting({ provider: i.provider })
    },
  },
  {
    schema: {
      name: "blaze_sync_vendors",
      description:
        "Reconcile vendor master data with the connected accounting system (QuickBooks, Xero, or Puzzle). This syncs data with the connected accounting provider, creating any missing vendors. Idempotent — existing vendors are skipped. Returns a { processed, created, skipped } summary.",
      input_schema: props([], {
        provider: {
          type: "string",
          description:
            "Provider (quickbooks, xero, or puzzle). Omit if only one is connected.",
        },
      }),
    },
    execute: async (input, client) => {
      const i = input as { provider?: string }
      return client.syncVendors({ provider: i.provider })
    },
  },
  {
    schema: {
      name: "blaze_sync_customers",
      description:
        "Reconcile customer master data with the connected accounting system (QuickBooks, Xero, or Puzzle). This syncs data with the connected accounting provider, creating any missing customers. Idempotent — existing customers are skipped. Returns a { processed, created, skipped } summary.",
      input_schema: props([], {
        provider: {
          type: "string",
          description:
            "Provider (quickbooks, xero, or puzzle). Omit if only one is connected.",
        },
      }),
    },
    execute: async (input, client) => {
      const i = input as { provider?: string }
      return client.syncCustomers({ provider: i.provider })
    },
  },
  {
    schema: {
      name: "blaze_reconcile_accounts",
      description:
        'Reconcile the connected accounting provider\'s books (QuickBooks, Xero, or Puzzle) against Blaze\'s internal ledger for a period. Returns matched pairs, unmatched Blaze/provider records, amount discrepancies, and the reconciliation rate. READ-ONLY. Only Puzzle is supported today — QuickBooks/Xero return a not-supported error. Use to answer "do my books match Blaze?", "reconcile Puzzle against Blaze", or "what is missing from the books?".',
      input_schema: props(["period_start", "period_end"], {
        period_start: {
          type: "string",
          description:
            "Start of the reconciliation period (ISO 8601, e.g. 2026-01-01)",
        },
        period_end: {
          type: "string",
          description:
            "End of the reconciliation period (ISO 8601, e.g. 2026-01-31)",
        },
        provider: {
          type: "string",
          description:
            "Provider (quickbooks, xero, or puzzle). Omit if only one is connected.",
        },
      }),
    },
    execute: async (input, client) => {
      const i = input as {
        period_start: string
        period_end: string
        provider?: string
      }
      return client.reconcileAccounts({
        period_start: i.period_start,
        period_end: i.period_end,
        provider: i.provider,
      })
    },
  },
  {
    schema: {
      name: "blaze_accounting_close_status",
      description:
        'Get the month-end close status for a period from the connected accounting provider (QuickBooks, Xero, or Puzzle). Returns the reconciliation rate, whether the books are reconciled against Blaze, and whether the trial balance balances. READ-ONLY. Only Puzzle is supported today — QuickBooks/Xero return a not-supported error. Use to answer "can I close the books for last month?" or "is the period reconciled?".',
      input_schema: props(["start", "end"], {
        start: {
          type: "string",
          description: "Start of the close period (ISO 8601, e.g. 2026-01-01)",
        },
        end: {
          type: "string",
          description: "End of the close period (ISO 8601, e.g. 2026-01-31)",
        },
        provider: {
          type: "string",
          description:
            "Provider (quickbooks, xero, or puzzle). Omit if only one is connected.",
        },
      }),
    },
    execute: async (input, client) => {
      const i = input as { start: string; end: string; provider?: string }
      return client.getCloseStatus({
        start: i.start,
        end: i.end,
        provider: i.provider,
      })
    },
  },
  {
    schema: {
      name: "blaze_push_bill_to_accounting",
      description:
        "IRREVOCABLE — Push a Blaze bill to the connected accounting system's books (QuickBooks, Xero, or Puzzle). This creates a real bill entry in the customer's books. ALWAYS show the bill details (vendor, amount, line items) to the user and get explicit confirmation before calling this tool. Only Puzzle is supported today — QuickBooks/Xero return a not-supported error. confirm must be true.",
      input_schema: props(["bill_id", "confirm"], {
        bill_id: { type: "string", description: "Blaze bill id to push" },
        provider: {
          type: "string",
          description:
            "Provider (quickbooks, xero, or puzzle). Omit if only one is connected.",
        },
        confirm: {
          type: "boolean",
          description:
            "Must be true. Set only after showing bill details to the user and receiving explicit confirmation.",
        },
      }),
    },
    execute: async (input, client) => {
      const i = input as {
        bill_id: string
        provider?: string
        confirm?: boolean
      }
      if (!i.confirm) {
        return {
          success: false,
          error:
            "You must show the bill details to the user and get confirmation before calling this tool. Set confirm=true only after the user confirms.",
        }
      }
      return client.pushBillToAccounting(i.bill_id, i.provider)
    },
  },
  {
    schema: {
      name: "blaze_push_invoice_to_accounting",
      description:
        "IRREVOCABLE — Push a Blaze invoice to the connected accounting system's books (QuickBooks, Xero, or Puzzle). This creates a real invoice entry in the customer's books. ALWAYS show the invoice details (customer, amount, line items) to the user and get explicit confirmation before calling this tool. Only Puzzle is supported today — QuickBooks/Xero return a not-supported error. confirm must be true.",
      input_schema: props(["invoice_id", "confirm"], {
        invoice_id: {
          type: "string",
          description: "Blaze invoice id to push",
        },
        provider: {
          type: "string",
          description:
            "Provider (quickbooks, xero, or puzzle). Omit if only one is connected.",
        },
        confirm: {
          type: "boolean",
          description:
            "Must be true. Set only after showing invoice details to the user and receiving explicit confirmation.",
        },
      }),
    },
    execute: async (input, client) => {
      const i = input as {
        invoice_id: string
        provider?: string
        confirm?: boolean
      }
      if (!i.confirm) {
        return {
          success: false,
          error:
            "You must show the invoice details to the user and get confirmation before calling this tool. Set confirm=true only after the user confirms.",
        }
      }
      return client.pushInvoiceToAccounting(i.invoice_id, i.provider)
    },
  },
  {
    schema: {
      name: "blaze_sync_transaction_to_accounting",
      description:
        "IRREVOCABLE — Push a journal entry to the connected accounting system (QuickBooks, Xero, or Puzzle). This creates a real entry in the customer's books. ALWAYS show the full entry details (accounts, amounts, debit/credit) to the user and get explicit confirmation before calling this tool. Requires account IDs from blaze_get_chart_of_accounts. For Puzzle, journal entries are immutable — a correction creates a reversal plus a new entry, never an in-place edit.",
      input_schema: props(["date", "lines", "confirm"], {
        date: { type: "string", description: "Journal entry date (ISO 8601)" },
        memo: { type: "string", description: "Description/memo for the entry" },
        lines: {
          type: "array",
          description:
            "Array of debit/credit lines. Total debits MUST equal total credits.",
          items: {
            type: "object",
            properties: {
              account_id: { type: "string" },
              amount: {
                type: "string",
                description: 'Amount as string for precision (e.g. "150.00")',
              },
              type: { type: "string", enum: ["debit", "credit"] },
              description: { type: "string" },
            },
            required: ["account_id", "amount", "type"],
          },
        },
        idempotency_key: {
          type: "string",
          description:
            "Unique key to prevent duplicates on retry (UUID recommended)",
        },
        provider: {
          type: "string",
          description: "Provider (quickbooks, xero, or puzzle)",
        },
        confirm: {
          type: "boolean",
          description:
            "Must be true. Set only after showing entry details to user and receiving explicit confirmation.",
        },
      }),
    },
    execute: async (input, client) => {
      const i = input as {
        date: string
        memo?: string
        lines: any[]
        idempotency_key?: string
        provider?: string
        confirm?: boolean
      }
      if (!i.confirm) {
        return {
          success: false,
          error:
            "You must show the journal entry details to the user and get confirmation before calling this tool. Set confirm=true only after user confirms.",
        }
      }
      const totalDebits = i.lines
        .filter(l => l.type === "debit")
        .reduce((sum, l) => sum + parseFloat(l.amount), 0)
      const totalCredits = i.lines
        .filter(l => l.type === "credit")
        .reduce((sum, l) => sum + parseFloat(l.amount), 0)
      if (Math.abs(totalDebits - totalCredits) > 0.01) {
        return {
          success: false,
          error: `Journal entry must balance. Debits: ${totalDebits}, Credits: ${totalCredits}`,
        }
      }
      return client.createJournalEntry({
        date: i.date,
        memo: i.memo,
        idempotency_key: i.idempotency_key,
        lines: i.lines.map(l => ({
          accountId: l.account_id,
          amount: l.amount,
          type: l.type,
          description: l.description,
        })),
      })
    },
  },
]

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function buildTools(
  _client: BlazeClient,
  _memory: MemoryStore
): Anthropic.Tool[] {
  return toolDefs.map(t => t.schema)
}

export async function executeTool(
  name: string,
  input: ToolInput,
  client: BlazeClient,
  memory: MemoryStore
): Promise<unknown> {
  const def = toolDefs.find(t => t.schema.name === name)
  if (!def) throw new Error(`Unknown tool: ${name}`)
  // Centrally pre-format tool results so the agent reports verbatim instead of
  // computing: `amount_display` strings for every { amount, currency } (no
  // dividing by 100 / unit guessing), and a `summary` { count, by_status } for
  // list results (no tallying long lists / miscounting). Both are derived from
  // the returned data, so they behave identically on any backend.
  const result = await def.execute(input, client, memory)
  return annotateAmounts(annotateRecordCounts(result))
}
