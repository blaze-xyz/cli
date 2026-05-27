import * as schemas from "../../mcp/schemas"

describe("customer schemas", () => {
  it("listCustomersSchema accepts empty params", () => {
    const result = schemas.listCustomersSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it("listCustomersSchema accepts limit and email", () => {
    const result = schemas.listCustomersSchema.safeParse({
      limit: 50,
      email: "test@test.com",
    })
    expect(result.success).toBe(true)
  })

  it("listCustomersSchema rejects limit over 100", () => {
    const result = schemas.listCustomersSchema.safeParse({ limit: 200 })
    expect(result.success).toBe(false)
  })

  it("createCustomerSchema requires email field", () => {
    const result = schemas.createCustomerSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it("createCustomerSchema accepts full input with address", () => {
    const result = schemas.createCustomerSchema.safeParse({
      email: "user@example.com",
      first_name: "Jane",
      last_name: "Doe",
      phone: "+15551234567",
      address: {
        line1: "123 Main St",
        city: "Austin",
        state: "TX",
        postal_code: "78701",
        country: "US",
      },
    })
    expect(result.success).toBe(true)
  })
})

describe("transfer schemas", () => {
  it("createTransferSchema requires positive amount", () => {
    const result = schemas.createTransferSchema.safeParse({ amount: 10 })
    expect(result.success).toBe(true)
  })

  it("createTransferSchema rejects negative amount", () => {
    const result = schemas.createTransferSchema.safeParse({ amount: -5 })
    expect(result.success).toBe(false)
  })

  it("createTransferSchema accepts full input with source and destination", () => {
    const result = schemas.createTransferSchema.safeParse({
      amount: 250.5,
      currency: "USD",
      customer_id: "cust_123",
      source_type: "wallet",
      source_id: "wal_abc",
      destination_type: "external_account",
      destination_id: "ext_xyz",
      note: "Monthly payment",
      metadata: { invoice: "INV-001" },
    })
    expect(result.success).toBe(true)
  })
})

describe("webhook schemas", () => {
  it("createWebhookSchema requires url", () => {
    const result = schemas.createWebhookSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it("listWebhooksSchema accepts empty object", () => {
    const result = schemas.listWebhooksSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it("updateWebhookSchema requires id", () => {
    const result = schemas.updateWebhookSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe("FX schemas", () => {
  it("getFxRatesSchema accepts empty object (all optional)", () => {
    const result = schemas.getFxRatesSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it("getFxRatesSchema accepts base currency", () => {
    const result = schemas.getFxRatesSchema.safeParse({ base: "EUR" })
    expect(result.success).toBe(true)
  })

  it("createFxQuoteSchema requires from_currency, to_currency, and amount", () => {
    const result = schemas.createFxQuoteSchema.safeParse({
      from_currency: "USD",
      to_currency: "MXN",
      amount: 100,
    })
    expect(result.success).toBe(true)
  })

  it("createFxQuoteSchema rejects missing amount", () => {
    const result = schemas.createFxQuoteSchema.safeParse({
      from_currency: "USD",
      to_currency: "MXN",
    })
    expect(result.success).toBe(false)
  })
})

describe("invoice schemas", () => {
  it("createInvoiceSchema requires customer_id and line_items", () => {
    const result = schemas.createInvoiceSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it("createInvoiceSchema accepts full input with line items", () => {
    const result = schemas.createInvoiceSchema.safeParse({
      customer_id: "cust_456",
      line_items: [
        { description: "Consulting", unit_price: 150, quantity: 2 },
        { description: "Setup fee", unit_price: 50 },
      ],
      tax: 25,
      description: "January services",
      due_date: "2026-02-01",
      currency_code: "USD",
      metadata: { project: "alpha" },
    })
    expect(result.success).toBe(true)
  })
})

describe("team schemas", () => {
  it("inviteTeamMemberSchema accepts valid role", () => {
    const result = schemas.inviteTeamMemberSchema.safeParse({
      email: "dev@company.com",
      role: "admin",
    })
    expect(result.success).toBe(true)
  })

  it("inviteTeamMemberSchema rejects invalid role", () => {
    const result = schemas.inviteTeamMemberSchema.safeParse({
      email: "dev@company.com",
      role: "superadmin",
    })
    expect(result.success).toBe(false)
  })
})

describe("insights schemas", () => {
  it("getSpendingSummarySchema accepts empty params (all optional)", () => {
    const result = schemas.getSpendingSummarySchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it("getSpendingSummarySchema accepts start_date and end_date", () => {
    const result = schemas.getSpendingSummarySchema.safeParse({
      start_date: "2025-01-01",
      end_date: "2025-01-31",
    })
    expect(result.success).toBe(true)
  })

  it("listBankTransactionsSchema accepts empty params (all optional)", () => {
    const result = schemas.listBankTransactionsSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it("listBankTransactionsSchema accepts full input with date range, account, and pagination", () => {
    const result = schemas.listBankTransactionsSchema.safeParse({
      start_date: "2025-01-01",
      end_date: "2025-01-31",
      plaid_account_data_id: "pad_123",
      limit: 50,
      cursor: "cursor_abc",
    })
    expect(result.success).toBe(true)
  })

  it("listBankTransactionsSchema rejects limit below 1", () => {
    const result = schemas.listBankTransactionsSchema.safeParse({ limit: 0 })
    expect(result.success).toBe(false)
  })

  it("listBankTransactionsSchema rejects limit over 100", () => {
    const result = schemas.listBankTransactionsSchema.safeParse({ limit: 200 })
    expect(result.success).toBe(false)
  })

  it("getBankBalancesSchema accepts empty object (no parameters)", () => {
    const result = schemas.getBankBalancesSchema.safeParse({})
    expect(result.success).toBe(true)
  })
})
