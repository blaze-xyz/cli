import type Anthropic from "@anthropic-ai/sdk"
import type { BlazeClient } from "../sdk/client"
import type { MemoryStore } from "./memory"

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
        "Get the current account balance (available and pending funds).",
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
        "Add a new contact (recipient) — Blaze user, bank account, CLABE, or crypto wallet.",
      input_schema: props(["name"], {
        name: { type: "string", description: "Contact's display name" },
        blazetag: {
          type: "string",
          description: "Blaze blazetag, e.g. @john",
        },
        type: {
          type: "string",
          enum: ["blaze", "bank", "clabe", "crypto"],
          description: "Contact type",
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
          description: "Blockchain network, e.g. stellar, ethereum",
        },
      }),
    },
    execute: async (input, client) => client.createContact(input),
  },
  {
    schema: {
      name: "blaze_pay_contact",
      description:
        "Send a payment to a saved contact. Resolves the first bank account if bank_account_id is not provided.",
      input_schema: props(["contact_id", "amount"], {
        contact_id: { type: "string", description: "Contact ID" },
        bank_account_id: {
          type: "string",
          description:
            "Bank account ID (resolves first bank account if omitted)",
        },
        amount: { type: "number", description: "Amount to send" },
        currency: {
          type: "string",
          description: "Currency code (default USD)",
        },
        note: { type: "string", description: "Payment note" },
      }),
    },
    execute: async (input, client) => {
      const i = input as {
        contact_id: string
        bank_account_id?: string
        amount: number
        currency?: string
        note?: string
      }

      try {
        let bankAccountId = i.bank_account_id
        if (!bankAccountId) {
          const contact = await client.getContact(i.contact_id)
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
      const currency = (i.currency ?? "USD").toUpperCase()
      const needsFx = currency !== "USD" && currency !== "USDC"

      let usdcAmountInCents: number
      let fiatAmountInCents: number | undefined
      let exchangeRate: number | undefined

      if (needsFx) {
        const quote = await client.createFxQuote({
          from_currency: currency,
          to_currency: "USD",
          amount: i.amount,
        })
        usdcAmountInCents = Math.round(quote.converted_amount * 100)
        fiatAmountInCents = Math.round(i.amount * 100)
        exchangeRate = quote.exchange_rate
      } else {
        usdcAmountInCents = Math.round(i.amount * 100)
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
  // Consumer — transactions
  // -------------------------------------------------------------------------
  {
    schema: {
      name: "blaze_list_transactions",
      description:
        "List account transactions with optional type and status filters.",
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
        "Read a summary of the business's bank spending (by category, top merchants) over an optional date range. Read-only insight; amounts are in integer cents.",
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
      return client.getInsightsSummary({
        start_date: i.start_date,
        end_date: i.end_date,
      })
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
  return def.execute(input, client, memory)
}
