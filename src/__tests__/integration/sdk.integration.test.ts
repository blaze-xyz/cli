/**
 * SDK Integration Tests
 *
 * Tests the BlazeClient SDK against a real Blaze API instance.
 *
 * Setup:
 *   1. Set BLAZE_TEST_API_KEY environment variable
 *   2. Optionally set BLAZE_TEST_BASE_URL (defaults to https://api.blaze.money)
 *   3. Run: yarn test:integration
 *
 * These tests make real API calls. They are skipped when BLAZE_TEST_API_KEY
 * is not set, using the same SKIP_E2E / TestContext pattern as the E2E suite.
 */

import { TestContext, SKIP_E2E } from "../e2e/setup"
import { BlazeAuthenticationError, BlazeNotFoundError } from "../../sdk/errors"
import { BlazeClient } from "../../sdk/client"

const describeIntegration = SKIP_E2E ? describe.skip : describe

// ---------------------------------------------------------------------------
// Read-only tests -- these never create or mutate resources
// ---------------------------------------------------------------------------

describeIntegration("Integration: Balance", () => {
  let ctx: TestContext

  beforeAll(() => {
    ctx = new TestContext()
  })

  it("returns balance with expected shape", async () => {
    const balance = await ctx.client.getBalance()
    expect(balance).toHaveProperty("available")
    expect(balance).toHaveProperty("pending")
    expect(balance).toHaveProperty("currency")
    expect(typeof balance.available).toBe("number")
    expect(typeof balance.pending).toBe("number")
    expect(typeof balance.currency).toBe("string")
  })
})

describeIntegration("Integration: Transfers (read-only)", () => {
  let ctx: TestContext

  beforeAll(() => {
    ctx = new TestContext()
  })

  it("lists transfers", async () => {
    const list = await ctx.client.listTransfers()
    expect(list).toHaveProperty("object", "list")
    expect(Array.isArray(list.data)).toBe(true)
    expect(list).toHaveProperty("has_more")
    expect(list).toHaveProperty("next_cursor")
  })

  it("lists transfers with limit", async () => {
    const list = await ctx.client.listTransfers({ limit: 2 })
    expect(list.data.length).toBeLessThanOrEqual(2)
  })

  it("gets a transfer by ID when data exists", async () => {
    const list = await ctx.client.listTransfers({ limit: 1 })
    if (list.data.length === 0) return

    const transfer = await ctx.client.getTransfer(list.data[0].id)
    expect(transfer).toHaveProperty("id", list.data[0].id)
    expect(transfer).toHaveProperty("object", "transfer")
    expect(transfer).toHaveProperty("status")
    expect(transfer).toHaveProperty("amount")
    expect(transfer).toHaveProperty("currency")
  })
})

describeIntegration("Integration: Withdrawals (read-only)", () => {
  let ctx: TestContext

  beforeAll(() => {
    ctx = new TestContext()
  })

  it("lists withdrawals", async () => {
    const list = await ctx.client.listWithdrawals()
    expect(list).toHaveProperty("object", "list")
    expect(Array.isArray(list.data)).toBe(true)
    expect(list).toHaveProperty("has_more")
    expect(list).toHaveProperty("next_cursor")
  })

  it("lists withdrawals with limit", async () => {
    const list = await ctx.client.listWithdrawals({ limit: 2 })
    expect(list.data.length).toBeLessThanOrEqual(2)
  })
})

describeIntegration("Integration: Transactions (read-only)", () => {
  let ctx: TestContext

  beforeAll(() => {
    ctx = new TestContext()
  })

  it("lists transactions", async () => {
    const list = await ctx.client.listTransactions()
    expect(list).toHaveProperty("object", "list")
    expect(Array.isArray(list.data)).toBe(true)
    expect(list).toHaveProperty("has_more")
    expect(list).toHaveProperty("next_cursor")
  })

  it("lists transactions with limit", async () => {
    const list = await ctx.client.listTransactions({ limit: 3 })
    expect(list.data.length).toBeLessThanOrEqual(3)
  })

  it("filters transactions by status", async () => {
    const list = await ctx.client.listTransactions({ status: "completed" })
    for (const tx of list.data) {
      expect(tx.status).toBe("completed")
    }
  })

  it("filters transactions by type", async () => {
    const list = await ctx.client.listTransactions({ type: "deposit" })
    for (const tx of list.data) {
      expect(tx.type).toBe("deposit")
    }
  })
})

describeIntegration("Integration: API Keys (read-only)", () => {
  let ctx: TestContext

  beforeAll(() => {
    ctx = new TestContext()
  })

  it("lists API keys", async () => {
    const result = await ctx.client.listApiKeys()
    expect(result).toHaveProperty("object", "list")
    expect(Array.isArray(result.data)).toBe(true)
    if (result.data.length > 0) {
      expect(result.data[0]).toHaveProperty("id")
      expect(result.data[0]).toHaveProperty("name")
      expect(result.data[0]).toHaveProperty("key_prefix")
      expect(result.data[0]).toHaveProperty("scopes")
    }
  })
})

describeIntegration("Integration: Team Members (read-only)", () => {
  let ctx: TestContext

  beforeAll(() => {
    ctx = new TestContext()
  })

  it("lists team members", async () => {
    const result = await ctx.client.listTeamMembers()
    expect(result).toHaveProperty("object", "list")
    expect(Array.isArray(result.data)).toBe(true)
    if (result.data.length > 0) {
      expect(result.data[0]).toHaveProperty("id")
      expect(result.data[0]).toHaveProperty("role")
      expect(result.data[0]).toHaveProperty("email")
    }
  })
})

describeIntegration("Integration: Webhooks (read-only)", () => {
  let ctx: TestContext

  beforeAll(() => {
    ctx = new TestContext()
  })

  it("lists webhooks", async () => {
    const list = await ctx.client.listWebhooks()
    expect(list).toHaveProperty("object", "list")
    expect(Array.isArray(list.data)).toBe(true)
    expect(list).toHaveProperty("has_more")
    expect(list).toHaveProperty("next_cursor")
  })
})

describeIntegration("Integration: Analytics (read-only)", () => {
  let ctx: TestContext

  beforeAll(() => {
    ctx = new TestContext()
  })

  it("gets analytics overview with default period", async () => {
    const overview = await ctx.client.getAnalyticsOverview()
    expect(overview).toHaveProperty("object", "analytics_overview")
    expect(overview).toHaveProperty("total_volume")
    expect(overview).toHaveProperty("transaction_count")
    expect(overview).toHaveProperty("successful_count")
    expect(overview).toHaveProperty("failed_count")
    expect(overview).toHaveProperty("period_start")
    expect(overview).toHaveProperty("period_end")
  })

  it("gets analytics overview for LAST_7_DAYS", async () => {
    const overview = await ctx.client.getAnalyticsOverview("LAST_7_DAYS")
    expect(overview).toHaveProperty("object", "analytics_overview")
    expect(typeof overview.transaction_count).toBe("number")
  })

  it("gets analytics overview for LAST_30_DAYS", async () => {
    const overview = await ctx.client.getAnalyticsOverview("LAST_30_DAYS")
    expect(overview).toHaveProperty("object", "analytics_overview")
    expect(typeof overview.total_volume).toBe("number")
  })
})

describeIntegration("Integration: Disputes (read-only)", () => {
  let ctx: TestContext

  beforeAll(() => {
    ctx = new TestContext()
  })

  it("lists disputes", async () => {
    const list = await ctx.client.listDisputes()
    expect(list).toHaveProperty("object", "list")
    expect(Array.isArray(list.data)).toBe(true)
    expect(list).toHaveProperty("has_more")
    expect(list).toHaveProperty("next_cursor")
  })

  it("lists disputes with status filter", async () => {
    const list = await ctx.client.listDisputes({ status: "open" })
    for (const dispute of list.data) {
      expect(dispute.status).toBe("open")
    }
  })
})

describeIntegration("Integration: Invoices (read-only)", () => {
  let ctx: TestContext

  beforeAll(() => {
    ctx = new TestContext()
  })

  it("lists invoices", async () => {
    const list = await ctx.client.listInvoices()
    expect(list).toHaveProperty("object", "list")
    expect(Array.isArray(list.data)).toBe(true)
    expect(list).toHaveProperty("has_more")
    expect(list).toHaveProperty("next_cursor")
  })

  it("lists invoices with status filter", async () => {
    const list = await ctx.client.listInvoices({ status: "paid" })
    for (const invoice of list.data) {
      expect(invoice.status).toBe("paid")
    }
  })
})

describeIntegration("Integration: Subscriptions (read-only)", () => {
  let ctx: TestContext

  beforeAll(() => {
    ctx = new TestContext()
  })

  it("lists subscriptions", async () => {
    const list = await ctx.client.listSubscriptions()
    expect(list).toHaveProperty("object", "list")
    expect(Array.isArray(list.data)).toBe(true)
    expect(list).toHaveProperty("has_more")
    expect(list).toHaveProperty("next_cursor")
  })

  it("lists subscriptions with status filter", async () => {
    const list = await ctx.client.listSubscriptions({ status: "active" })
    for (const sub of list.data) {
      expect(sub.status).toBe("active")
    }
  })
})

describeIntegration("Integration: FX Rates & Quotes (read-only)", () => {
  let ctx: TestContext

  beforeAll(() => {
    ctx = new TestContext()
  })

  it("gets FX rates with default base", async () => {
    const rates = await ctx.client.getFxRates()
    expect(rates).toHaveProperty("object", "fx_rates")
    expect(rates).toHaveProperty("base")
    expect(rates).toHaveProperty("rates")
    expect(typeof rates.rates).toBe("object")
  })

  it("gets FX rates with explicit base currency", async () => {
    const rates = await ctx.client.getFxRates("USD")
    expect(rates).toHaveProperty("object", "fx_rates")
    expect(rates.base).toBe("USD")
    expect(typeof rates.rates).toBe("object")
  })

  it("creates an FX quote", async () => {
    const quote = await ctx.client.createFxQuote({
      from_currency: "USD",
      to_currency: "MXN",
      amount: 100,
    })
    expect(quote).toHaveProperty("object", "fx_quote")
    expect(quote).toHaveProperty("id")
    expect(quote.from_currency).toBe("USD")
    expect(quote.to_currency).toBe("MXN")
    expect(quote.amount).toBe(100)
    expect(quote.exchange_rate).toBeGreaterThan(0)
    expect(quote.converted_amount).toBeGreaterThan(0)
    expect(quote).toHaveProperty("expires_at")
  })
})

// ---------------------------------------------------------------------------
// Pagination tests
// ---------------------------------------------------------------------------

describeIntegration("Integration: Pagination", () => {
  let ctx: TestContext

  beforeAll(() => {
    ctx = new TestContext()
  })

  it("paginates transfers using cursor", async () => {
    const firstPage = await ctx.client.listTransfers({ limit: 2 })
    expect(firstPage).toHaveProperty("has_more")
    expect(firstPage).toHaveProperty("next_cursor")

    if (!firstPage.has_more || !firstPage.next_cursor) return

    const secondPage = await ctx.client.listTransfers({
      limit: 2,
      cursor: firstPage.next_cursor,
    })

    expect(secondPage).toHaveProperty("object", "list")
    expect(Array.isArray(secondPage.data)).toBe(true)

    // Pages should not overlap
    const firstIds = new Set(firstPage.data.map(t => t.id))
    for (const item of secondPage.data) {
      expect(firstIds.has(item.id)).toBe(false)
    }
  })

  it("paginates transactions using cursor", async () => {
    const firstPage = await ctx.client.listTransactions({ limit: 2 })

    if (!firstPage.has_more || !firstPage.next_cursor) return

    const secondPage = await ctx.client.listTransactions({
      limit: 2,
      cursor: firstPage.next_cursor,
    })

    const firstIds = new Set(firstPage.data.map(t => t.id))
    for (const item of secondPage.data) {
      expect(firstIds.has(item.id)).toBe(false)
    }
  })

  it("returns empty data when cursor is exhausted", async () => {
    // Fetch with large limit to likely exhaust results
    const page = await ctx.client.listTransfers({ limit: 100 })
    if (!page.has_more) {
      expect(page.next_cursor).toBeNull()
    }
  })
})

// ---------------------------------------------------------------------------
// Write tests -- these create, update, and archive resources
// ---------------------------------------------------------------------------

describeIntegration("Integration: Customers (CRUD)", () => {
  let ctx: TestContext
  const testEmail = `cli-integ-${Date.now()}@example.com`
  let customerId: string

  beforeAll(() => {
    ctx = new TestContext()
  })
  afterAll(() => ctx.cleanup())

  it("creates a customer", async () => {
    const customer = await ctx.client.createCustomer({
      email: testEmail,
      first_name: "Integration",
      last_name: "Test",
    })
    customerId = customer.id
    ctx.track("customer", customer.id)

    expect(customer).toHaveProperty("id")
    expect(customer).toHaveProperty("object", "customer")
    expect(customer.email).toBe(testEmail)
    expect(customer.first_name).toBe("Integration")
    expect(customer.last_name).toBe("Test")
    expect(customer).toHaveProperty("created_at")
  })

  it("lists customers with email filter", async () => {
    const list = await ctx.client.listCustomers({ email: testEmail })
    expect(list).toHaveProperty("object", "list")
    expect(list.data.length).toBeGreaterThan(0)
    expect(list.data[0].email).toBe(testEmail)
  })

  it("gets customer by ID", async () => {
    const customer = await ctx.client.getCustomer(customerId)
    expect(customer).toHaveProperty("id", customerId)
    expect(customer.email).toBe(testEmail)
  })

  it("updates customer", async () => {
    const updated = await ctx.client.updateCustomer(customerId, {
      first_name: "Updated",
      last_name: "Name",
    })
    expect(updated.first_name).toBe("Updated")
    expect(updated.last_name).toBe("Name")
  })

  it("archives customer", async () => {
    await ctx.client.archiveCustomer(customerId)
    const archived = await ctx.client.listCustomers({
      email: testEmail,
      include_archived: true,
    })
    expect(archived.data.length).toBeGreaterThan(0)
    expect(archived.data[0].archived_at).not.toBeNull()
  })
})

describeIntegration("Integration: Payment Links (CRUD)", () => {
  let ctx: TestContext
  let linkId: string

  beforeAll(() => {
    ctx = new TestContext()
  })
  afterAll(() => ctx.cleanup())

  it("creates a payment link", async () => {
    const link = await ctx.client.createPaymentLink({
      amount: 50,
      currency: "USD",
      name: `CLI Integ ${Date.now()}`,
    })
    linkId = link.id
    ctx.track("payment_link", link.id)

    expect(link).toHaveProperty("id")
    expect(link).toHaveProperty("object", "payment_link")
    expect(link).toHaveProperty("url")
    expect(link).toHaveProperty("short_code")
    expect(link.amount).toBe(50)
  })

  it("lists payment links", async () => {
    const list = await ctx.client.listPaymentLinks({ limit: 5 })
    expect(list).toHaveProperty("object", "list")
    expect(list.data.length).toBeGreaterThan(0)
  })

  it("gets payment link by ID", async () => {
    const link = await ctx.client.getPaymentLink(linkId)
    expect(link).toHaveProperty("id", linkId)
    expect(link).toHaveProperty("object", "payment_link")
  })

  it("updates payment link", async () => {
    const updated = await ctx.client.updatePaymentLink(linkId, {
      name: "Updated Integ Link",
    })
    expect(updated.name).toBe("Updated Integ Link")
  })

  it("cancels payment link", async () => {
    await ctx.client.cancelPaymentLink(linkId)
    const link = await ctx.client.getPaymentLink(linkId)
    expect(link.status.toLowerCase()).toContain("cancel")
  })
})

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describeIntegration("Integration: Error Handling", () => {
  let ctx: TestContext

  beforeAll(() => {
    ctx = new TestContext()
  })

  it("throws BlazeAuthenticationError for invalid API key", async () => {
    const badClient = new BlazeClient({
      apiKey: "sk_test_invalid_key_12345",
      baseUrl: process.env.BLAZE_TEST_BASE_URL ?? "https://api.blaze.money",
    })

    await expect(badClient.getBalance()).rejects.toThrow(
      BlazeAuthenticationError
    )
  })

  it("throws BlazeNotFoundError for non-existent customer", async () => {
    await expect(
      ctx.client.getCustomer("cust_nonexistent_000000")
    ).rejects.toThrow(BlazeNotFoundError)
  })

  it("throws BlazeNotFoundError for non-existent transfer", async () => {
    await expect(
      ctx.client.getTransfer("tr_nonexistent_000000")
    ).rejects.toThrow(BlazeNotFoundError)
  })

  it("throws BlazeNotFoundError for non-existent payment link", async () => {
    await expect(
      ctx.client.getPaymentLink("pl_nonexistent_000000")
    ).rejects.toThrow(BlazeNotFoundError)
  })
})
