import { TestContext, SKIP_E2E } from "./setup"

const describeE2E = SKIP_E2E ? describe.skip : describe

describeE2E("E2E: Insights", () => {
  let ctx: TestContext

  beforeAll(() => {
    ctx = new TestContext()
  })

  it("returns spending summary with expected fields", async () => {
    const summary = await ctx.client.getInsightsSummary()
    expect(summary).toHaveProperty("object", "spending_summary")
    expect(summary).toHaveProperty("total_spending_cents")
    expect(summary).toHaveProperty("currency")
    expect(summary).toHaveProperty("by_category")
    expect(summary).toHaveProperty("top_merchants")
    expect(summary).toHaveProperty("period_start")
    expect(summary).toHaveProperty("period_end")
    expect(typeof summary.total_spending_cents).toBe("number")
    expect(typeof summary.currency).toBe("string")
    expect(Array.isArray(summary.by_category)).toBe(true)
    expect(Array.isArray(summary.top_merchants)).toBe(true)
  })

  it("returns bank transactions list wrapper with expected fields", async () => {
    const result = await ctx.client.listBankTransactions({ limit: 5 })
    expect(result).toHaveProperty("object", "list")
    expect(result).toHaveProperty("data")
    expect(result).toHaveProperty("has_more")
    expect(result).toHaveProperty("total_count")
    expect(Array.isArray(result.data)).toBe(true)
    expect(typeof result.has_more).toBe("boolean")
    expect(typeof result.total_count).toBe("number")
    // Shape-check the first transaction only if any exist (tolerates no data)
    if (result.data.length > 0) {
      const tx = result.data[0]
      expect(tx).toHaveProperty("id")
      expect(tx).toHaveProperty("object", "bank_transaction")
      expect(tx).toHaveProperty("amount")
      expect(tx).toHaveProperty("is_outflow")
      expect(tx).toHaveProperty("date")
      expect(typeof tx.amount).toBe("number")
      expect(typeof tx.is_outflow).toBe("boolean")
    }
  })

  it("returns bank balances with expected fields", async () => {
    const balances = await ctx.client.getBankBalances()
    expect(balances).toHaveProperty("object", "bank_balances")
    expect(balances).toHaveProperty("accounts")
    expect(balances).toHaveProperty("total_available")
    expect(balances).toHaveProperty("currency")
    expect(balances).toHaveProperty("accounts_unavailable")
    expect(Array.isArray(balances.accounts)).toBe(true)
    expect(typeof balances.accounts_unavailable).toBe("number")
    // Shape-check the first account only if any exist (tolerates no data)
    if (balances.accounts.length > 0) {
      const account = balances.accounts[0]
      expect(account).toHaveProperty("plaid_account_data_id")
      expect(account).toHaveProperty("available")
      expect(account).toHaveProperty("current")
      expect(account).toHaveProperty("currency")
    }
  })
})
