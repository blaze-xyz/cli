import { TestContext, SKIP_E2E } from "./setup"

const describeE2E = SKIP_E2E ? describe.skip : describe

describeE2E("E2E: Balance", () => {
  let ctx: TestContext

  beforeAll(() => {
    ctx = new TestContext()
  })

  it("returns balance with expected fields", async () => {
    const balance = await ctx.client.getBalance()
    expect(balance).toHaveProperty("available")
    expect(balance).toHaveProperty("pending")
    // Balance returns nested CurrencyAmount objects
    const available = balance.available as { amount: number; currency: string }
    const pending = balance.pending as { amount: number; currency: string }
    expect(typeof available.amount).toBe("number")
    expect(typeof available.currency).toBe("string")
    expect(typeof pending.amount).toBe("number")
  })
})
