import type { BlazeClient } from "../../sdk/client"
import type { MemoryStore } from "../../agent/memory"
import { buildTools, executeTool } from "../../agent/tools"

/**
 * Mock BlazeClient: every method is a jest.fn resolving to a stub. A few
 * methods need richer return shapes so the tool bodies that read fields
 * (balance, contact bank accounts, profile blazetag) execute fully.
 */
function createMockClient(): BlazeClient {
  const cache = new Map<string, jest.Mock>()
  const defaults: Record<string, unknown> = {
    getBalance: { available: { amount: 1_000_000 } },
    getMe: { blazetag: "me" },
    getContact: { bank_accounts: [{ id: "ba_1" }] },
    payContact: { id: "tr_1", status: "PENDING" },
    sendPayment: { id: "pay_1", status: "PENDING" },
    createJournalEntry: { id: "je_1" },
    listConnectedPaymentMethods: {
      methods: [
        {
          id: "pm_1",
          type: "Card",
          displayName: "Test Card",
          maskedAccountNumber: "1234",
          canDeposit: true,
          canWithdraw: true,
          isDefault: true,
          rampVerificationStatus: "Completed",
        },
      ],
      defaultWithdrawalMethodId: "pm_1",
      countryCode: "US",
    },
    withdrawToPaymentMethod: {
      status: "PENDING",
      rampTransferId: "rt_1",
    },
    checkWithdrawalLimits: {
      meetsMinimum: true,
      isUnderLimit: true,
      minimumAmountCents: 500,
    },
    getRampTransfer: { id: "rt_1", feeCollections: [] },
    getExchangeRate: 0.0567,
    getApplicableWithdrawalFee: {
      totalFeeCents: 200,
      displayName: "Card Withdrawal Fee",
      flatFeeCents: 0,
      percentageFeeCents: 0,
      percentageRate: 0.02,
      minFeeCents: 200,
      configId: "c",
    },
  }
  return new Proxy(
    {},
    {
      get: (_t, prop: string) => {
        if (!cache.has(prop)) {
          cache.set(
            prop,
            jest
              .fn()
              .mockResolvedValue(defaults[prop] ?? { ok: true, method: prop })
          )
        }
        return cache.get(prop)
      },
    }
  ) as unknown as BlazeClient
}

function createMockMemory(): MemoryStore {
  return {
    read: jest.fn().mockReturnValue({ patterns: {}, payments: [] }),
    savePattern: jest.fn(),
    logPayment: jest.fn(),
  } as unknown as MemoryStore
}

// Representative valid inputs per tool so each execute body runs to completion.
const TOOL_INPUTS: Record<string, Record<string, unknown>> = {
  blaze_read_memory: {},
  blaze_save_pattern: { trigger: "pay rent", amount: 100, currency: "USD" },
  blaze_log_payment: {
    amount: 50,
    currency: "USD",
    to: "@bob",
    note: "lunch",
    payment_id: "pay_1",
  },
  blaze_get_me: {},
  blaze_get_balance: {},
  blaze_list_contacts: { search: "bob", limit: 10 },
  blaze_add_contact: {
    name: "Bob Smith",
    phone: "+15551234567",
    type: "crypto",
    wallet_address: "0x0000000000000000000000000000000000000000",
    network: "ethereum",
  },
  blaze_pay_contact: { contact_id: "c_1", amount: 100, currency: "USD" },
  blaze_list_connected_payment_methods: {},
  blaze_withdraw: { payment_method_id: "pm_1", amount: 50, currency: "USD" },
  blaze_estimate_withdrawal_fee: {
    payment_method_id: "pm_1",
    amount: 50,
    currency: "USD",
  },
  blaze_delete_contact: { id: "c_1" },
  blaze_search_users: { query: "bob", limit: 5 },
  blaze_send_payment: { blazetag: "@bob", amount: 100, currency: "USD" },
  blaze_list_payments: { limit: 5 },
  blaze_get_payment: { id: "pay_1" },
  blaze_list_transactions: { limit: 5, type: "payment", status: "completed" },
  blaze_get_transaction: { id: "tx_1" },
  blaze_fx_quote: { from: "USD", to: "MXN", amount: 100 },
  blaze_fx_rates: { base: "USD" },
  blaze_get_spending_summary: {
    start_date: "2026-01-01",
    end_date: "2026-01-31",
  },
  blaze_list_bank_transactions: { limit: 10 },
  blaze_get_bank_balances: {},
  blaze_get_business_balance: {},
  blaze_list_customers: { limit: 5, email: "a@b.com" },
  blaze_get_customer: { id: "cust_1" },
  blaze_create_customer: { email: "a@b.com", first_name: "A", last_name: "B" },
  blaze_list_transfers: { limit: 5, status: "pending" },
  blaze_create_transfer: {
    amount: 100,
    currency: "USD",
    destination_id: "d_1",
  },
  blaze_list_payment_links: { limit: 5 },
  blaze_create_payment_link: { amount: 100, currency: "USD", name: "Link" },
  blaze_list_bills: { status: "READY_TO_PAY", limit: 5 },
  blaze_get_bill: { id: "bill_1" },
  blaze_quote_bill_payment: { bill_id: "bill_1", expedite_option: "auto" },
  blaze_pay_bill: { bill_id: "bill_1", quote_id: "q_1", confirm: true },
  blaze_list_pending_bill_approvals: {},
  blaze_connect_gmail_start: {},
  blaze_connect_gmail_finalize: { session_id: "sess_1" },
  blaze_cfo_duplicates: { window_days: 30 },
  blaze_cfo_check_duplicate: { vendor_name: "Acme", amount_cents: 10000 },
  blaze_cfo_forecast: { horizon_days: 30 },
  blaze_cfo_scenario: {
    name: "Hire 2 engineers",
    adjustments: [
      {
        type: "new_recurring_expense",
        amount_cents: 2400000,
        frequency: "monthly",
      },
    ],
    horizon_days: 30,
  },
  blaze_cfo_reconcile: {
    period_start: "2026-01-01",
    period_end: "2026-01-31",
  },
  blaze_get_profit_and_loss: {
    start_date: "2026-01-01",
    end_date: "2026-06-30",
  },
  blaze_get_balance_sheet: { as_of: "2026-06-01" },
  blaze_get_chart_of_accounts: {},
  blaze_get_trial_balance: {
    start_date: "2026-01-01",
    end_date: "2026-06-30",
    basis: "accrual",
  },
  blaze_get_cash_activity: {
    start_date: "2026-01-01",
    end_date: "2026-06-30",
  },
  blaze_get_vendor_spending: {
    start_date: "2026-01-01",
    end_date: "2026-06-30",
  },
  blaze_list_accounting_transactions: { limit: 10, offset: 0 },
  blaze_list_accounting_bills: { status: "OPEN", limit: 10 },
  blaze_list_accounting_invoices: { status: "OPEN", limit: 10 },
  blaze_list_voice_calls: { limit: 5 },
  blaze_propose_voice_call: {
    customer_id: "cust_1",
    invoice_id: "inv_1",
    reason: "overdue",
  },
  blaze_schedule_voice_call: { job_id: "job_1", execute: false },
  blaze_sync_bills_from_accounting: { provider: "puzzle" },
  blaze_sync_invoices_from_accounting: { provider: "puzzle" },
  blaze_sync_vendors: { provider: "puzzle" },
  blaze_sync_customers: { provider: "puzzle" },
  blaze_reconcile_accounts: {
    period_start: "2026-01-01",
    period_end: "2026-01-31",
    provider: "puzzle",
  },
  blaze_accounting_close_status: {
    start: "2026-01-01",
    end: "2026-01-31",
    provider: "puzzle",
  },
  blaze_push_bill_to_accounting: { bill_id: "bb_1", confirm: true },
  blaze_push_invoice_to_accounting: { invoice_id: "bi_1", confirm: true },
  blaze_sync_transaction_to_accounting: {
    date: "2026-06-01",
    confirm: true,
    lines: [
      { account_id: "a1", amount: "100.00", type: "debit" },
      { account_id: "a2", amount: "100.00", type: "credit" },
    ],
  },
  blaze_cfo_payroll: { window_days: 180 },
}

describe("agent buildTools", () => {
  it("builds a unique, non-trivial set of tool schemas", () => {
    const tools = buildTools(createMockClient(), createMockMemory())
    const names = tools.map(t => t.name)

    expect(names.length).toBeGreaterThan(40)
    expect(new Set(names).size).toBe(names.length)
    expect(names).toContain("blaze_cfo_forecast")
  })
})

describe("agent executeTool — every tool", () => {
  it("executes every registered tool body without throwing", async () => {
    const client = createMockClient()
    const memory = createMockMemory()
    const tools = buildTools(client, memory)

    for (const tool of tools) {
      const input = TOOL_INPUTS[tool.name]
      expect(input).toBeDefined()
      const result = await executeTool(tool.name, input, client, memory)
      expect(result).toBeDefined()
    }
  })

  it("throws for an unknown tool name", async () => {
    const client = createMockClient()
    const memory = createMockMemory()

    await expect(
      executeTool("blaze_not_a_tool", {}, client, memory)
    ).rejects.toThrow("Unknown tool: blaze_not_a_tool")
  })
})

describe("agent executeTool — branch behaviours", () => {
  it("blaze_cfo_forecast defaults horizon_days to 90 when omitted", async () => {
    const client = createMockClient()
    const memory = createMockMemory()

    await executeTool("blaze_cfo_forecast", {}, client, memory)

    expect(
      (client as unknown as { getCashFlowForecast: jest.Mock })
        .getCashFlowForecast
    ).toHaveBeenCalledWith({ horizon_days: 90 })
  })

  it("blaze_send_payment rejects a self-send", async () => {
    const client = createMockClient()
    const memory = createMockMemory()
    ;(client as unknown as { getMe: jest.Mock }).getMe.mockResolvedValue({
      blazetag: "bob",
    })

    const result = (await executeTool(
      "blaze_send_payment",
      { blazetag: "@bob", amount: 10 },
      client,
      memory
    )) as { success: boolean; error: string }

    expect(result.success).toBe(false)
    expect(result.error).toContain("yourself")
  })

  it("blaze_send_payment rejects when balance is insufficient", async () => {
    const client = createMockClient()
    const memory = createMockMemory()
    ;(
      client as unknown as { getBalance: jest.Mock }
    ).getBalance.mockResolvedValue({ available: { amount: 100 } })

    const result = (await executeTool(
      "blaze_send_payment",
      { blazetag: "@alice", amount: 1000 },
      client,
      memory
    )) as { success: boolean; error: string }

    expect(result.success).toBe(false)
    expect(result.error).toContain("Insufficient balance")
  })

  it("blaze_send_payment converts non-USD amounts via FX estimate", async () => {
    const client = createMockClient()
    const memory = createMockMemory()

    await executeTool(
      "blaze_send_payment",
      { blazetag: "@alice", amount: 1715, currency: "MXN" },
      client,
      memory
    )

    const sendPayment = (client as unknown as { sendPayment: jest.Mock })
      .sendPayment
    expect(sendPayment).toHaveBeenCalled()
    const arg = sendPayment.mock.calls[0][0]
    expect(arg.currencyCode).toBe("MXN")
    expect(arg.fiatAmountInCents).toBe(171500)
  })

  it("blaze_pay_contact rejects an amount below the currency minimum", async () => {
    const client = createMockClient()
    const memory = createMockMemory()

    const result = (await executeTool(
      "blaze_pay_contact",
      { contact_id: "c_1", amount: 1, currency: "MXN" },
      client,
      memory
    )) as { success: boolean; error: string }

    expect(result.success).toBe(false)
    expect(result.error).toContain("Minimum transfer amount")
  })

  it("blaze_pay_contact reports when a contact has no bank accounts", async () => {
    const client = createMockClient()
    const memory = createMockMemory()
    ;(
      client as unknown as { getContact: jest.Mock }
    ).getContact.mockResolvedValue({ bank_accounts: [] })

    const result = (await executeTool(
      "blaze_pay_contact",
      { contact_id: "c_1", amount: 100 },
      client,
      memory
    )) as { success: boolean; error: string }

    expect(result.success).toBe(false)
    expect(result.error).toContain("no bank accounts")
  })

  it("blaze_pay_contact returns a structured error when the client throws", async () => {
    const client = createMockClient()
    const memory = createMockMemory()
    ;(
      client as unknown as { payContact: jest.Mock }
    ).payContact.mockRejectedValue({
      message: "provider down",
      statusCode: 502,
    })

    const result = (await executeTool(
      "blaze_pay_contact",
      { contact_id: "c_1", bank_account_id: "ba_1", amount: 100 },
      client,
      memory
    )) as { success: boolean; error: string; code: number }

    expect(result.success).toBe(false)
    expect(result.error).toBe("provider down")
    expect(result.code).toBe(502)
  })

  it("blaze_pay_contact routes a Stablecoin contact to payContactCrypto and flags irreversibility", async () => {
    const client = createMockClient()
    const memory = createMockMemory()
    ;(
      client as unknown as { getContact: jest.Mock }
    ).getContact.mockResolvedValue({
      type: "Stablecoin",
      bank_accounts: [],
      crypto_addresses: [
        { id: "addr_1", network: "Ethereum", address: "0xAbC0000000000000" },
      ],
    })
    const payCrypto = (client as unknown as { payContactCrypto: jest.Mock })
      .payContactCrypto
    payCrypto.mockResolvedValue({ id: "tr_crypto_1", status: "PENDING" })

    const result = (await executeTool(
      "blaze_pay_contact",
      { contact_id: "c_1", amount: 25 },
      client,
      memory
    )) as {
      success: boolean
      transferId: string
      network: string
      irreversible: boolean
      warning: string
    }

    expect(payCrypto).toHaveBeenCalledWith("c_1", "addr_1", {
      usdcAmountInCents: 2500,
      amount: 25,
      note: undefined,
    })
    expect(result.success).toBe(true)
    expect(result.transferId).toBe("tr_crypto_1")
    expect(result.network).toBe("Ethereum")
    expect(result.irreversible).toBe(true)
    expect(result.warning).toContain("irreversible")
  })

  it("blaze_pay_contact rejects a crypto send below the $1 USDC minimum", async () => {
    const client = createMockClient()
    const memory = createMockMemory()
    ;(
      client as unknown as { getContact: jest.Mock }
    ).getContact.mockResolvedValue({
      type: "Stablecoin",
      bank_accounts: [],
      crypto_addresses: [
        { id: "addr_1", network: "Ethereum", address: "0xAbC0000000000000" },
      ],
    })
    const payCrypto = (client as unknown as { payContactCrypto: jest.Mock })
      .payContactCrypto

    const result = (await executeTool(
      "blaze_pay_contact",
      { contact_id: "c_1", amount: 0.5 },
      client,
      memory
    )) as { success: boolean; error: string }

    expect(result.success).toBe(false)
    expect(result.error).toContain("Minimum crypto send")
    expect(payCrypto).not.toHaveBeenCalled()
  })

  it("blaze_pay_contact blocks a $5,000 crypto send ($3,000 or more) when beneficiary data is missing", async () => {
    const client = createMockClient()
    const memory = createMockMemory()
    ;(
      client as unknown as { getContact: jest.Mock }
    ).getContact.mockResolvedValue({
      type: "Stablecoin",
      bank_accounts: [],
      crypto_addresses: [
        { id: "addr_1", network: "Ethereum", address: "0xAbC0000000000000" },
      ],
    })
    const payCrypto = (client as unknown as { payContactCrypto: jest.Mock })
      .payContactCrypto

    const result = (await executeTool(
      "blaze_pay_contact",
      { contact_id: "c_1", amount: 5000 },
      client,
      memory
    )) as { success: boolean; error: string }

    expect(result.success).toBe(false)
    expect(result.error).toContain("beneficiary details")
    expect(payCrypto).not.toHaveBeenCalled()
  })

  it("blaze_pay_contact blocks a crypto send of exactly $3,000 (at the threshold) when beneficiary data is missing", async () => {
    const client = createMockClient()
    const memory = createMockMemory()
    ;(
      client as unknown as { getContact: jest.Mock }
    ).getContact.mockResolvedValue({
      type: "Stablecoin",
      bank_accounts: [],
      crypto_addresses: [
        { id: "addr_1", network: "Ethereum", address: "0xAbC0000000000000" },
      ],
    })
    const payCrypto = (client as unknown as { payContactCrypto: jest.Mock })
      .payContactCrypto

    const result = (await executeTool(
      "blaze_pay_contact",
      { contact_id: "c_1", amount: 3000 },
      client,
      memory
    )) as { success: boolean; error: string }

    expect(result.success).toBe(false)
    expect(result.error).toContain("beneficiary details")
    expect(payCrypto).not.toHaveBeenCalled()
  })

  it("blaze_pay_contact allows a crypto send just below $3,000 without beneficiary data", async () => {
    const client = createMockClient()
    const memory = createMockMemory()
    ;(
      client as unknown as { getContact: jest.Mock }
    ).getContact.mockResolvedValue({
      type: "Stablecoin",
      bank_accounts: [],
      crypto_addresses: [
        { id: "addr_1", network: "Ethereum", address: "0xAbC0000000000000" },
      ],
    })
    const payCrypto = (client as unknown as { payContactCrypto: jest.Mock })
      .payContactCrypto
    payCrypto.mockResolvedValue({ id: "tr_crypto_2", status: "PENDING" })

    const result = (await executeTool(
      "blaze_pay_contact",
      { contact_id: "c_1", amount: 2999 },
      client,
      memory
    )) as { success: boolean; transferId: string }

    expect(payCrypto).toHaveBeenCalledWith("c_1", "addr_1", {
      usdcAmountInCents: 299900,
      amount: 2999,
      note: undefined,
    })
    expect(result.success).toBe(true)
    expect(result.transferId).toBe("tr_crypto_2")
  })

  it("blaze_sync_transaction_to_accounting requires confirm=true", async () => {
    const client = createMockClient()
    const memory = createMockMemory()

    const result = (await executeTool(
      "blaze_sync_transaction_to_accounting",
      {
        date: "2026-06-01",
        confirm: false,
        lines: [{ account_id: "a", amount: "1.00", type: "debit" }],
      },
      client,
      memory
    )) as { success: boolean; error: string }

    expect(result.success).toBe(false)
    expect(result.error).toContain("confirm")
  })

  it("blaze_push_bill_to_accounting requires confirm=true before calling the client", async () => {
    const client = createMockClient()
    const memory = createMockMemory()

    const result = (await executeTool(
      "blaze_push_bill_to_accounting",
      { bill_id: "bb_1", confirm: false },
      client,
      memory
    )) as { success: boolean; error: string }

    expect(result.success).toBe(false)
    expect(result.error).toContain("confirm")
    expect(
      (client as unknown as { pushBillToAccounting: jest.Mock })
        .pushBillToAccounting
    ).not.toHaveBeenCalled()
  })

  it("blaze_push_bill_to_accounting forwards the bill id and provider when confirmed", async () => {
    // Arrange
    const client = createMockClient()
    const memory = createMockMemory()

    // Act
    await executeTool(
      "blaze_push_bill_to_accounting",
      { bill_id: "bb_1", provider: "puzzle", confirm: true },
      client,
      memory
    )

    // Assert
    expect(
      (client as unknown as { pushBillToAccounting: jest.Mock })
        .pushBillToAccounting
    ).toHaveBeenCalledWith("bb_1", "puzzle")
  })

  it("blaze_sync_transaction_to_accounting rejects unbalanced entries", async () => {
    const client = createMockClient()
    const memory = createMockMemory()

    const result = (await executeTool(
      "blaze_sync_transaction_to_accounting",
      {
        date: "2026-06-01",
        confirm: true,
        lines: [
          { account_id: "a1", amount: "100.00", type: "debit" },
          { account_id: "a2", amount: "50.00", type: "credit" },
        ],
      },
      client,
      memory
    )) as { success: boolean; error: string }

    expect(result.success).toBe(false)
    expect(result.error).toContain("must balance")
  })

  it("blaze_get_trial_balance execute calls client.getTrialBalance with the basis and provider args", async () => {
    // Arrange
    const client = createMockClient()
    const memory = createMockMemory()

    // Act
    await executeTool(
      "blaze_get_trial_balance",
      {
        start_date: "2026-01-01",
        end_date: "2026-06-30",
        basis: "cash",
        provider: "puzzle",
      },
      client,
      memory
    )

    // Assert
    expect(
      (client as unknown as { getTrialBalance: jest.Mock }).getTrialBalance
    ).toHaveBeenCalledWith({
      start_date: "2026-01-01",
      end_date: "2026-06-30",
      basis: "cash",
      provider: "puzzle",
    })
  })

  it("blaze_sync_bills_from_accounting execute calls client.syncBillsFromAccounting with the provider arg", async () => {
    // Arrange
    const client = createMockClient()
    const memory = createMockMemory()

    // Act
    await executeTool(
      "blaze_sync_bills_from_accounting",
      { provider: "puzzle" },
      client,
      memory
    )

    // Assert
    expect(
      (client as unknown as { syncBillsFromAccounting: jest.Mock })
        .syncBillsFromAccounting
    ).toHaveBeenCalledWith({ provider: "puzzle" })
  })

  it("blaze_reconcile_accounts execute calls client.reconcileAccounts with the period and provider args", async () => {
    // Arrange
    const client = createMockClient()
    const memory = createMockMemory()

    // Act
    await executeTool(
      "blaze_reconcile_accounts",
      {
        period_start: "2026-01-01",
        period_end: "2026-01-31",
        provider: "puzzle",
      },
      client,
      memory
    )

    // Assert
    expect(
      (client as unknown as { reconcileAccounts: jest.Mock }).reconcileAccounts
    ).toHaveBeenCalledWith({
      period_start: "2026-01-01",
      period_end: "2026-01-31",
      provider: "puzzle",
    })
  })
})
