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
    expect(balance).toHaveProperty("currency")
    expect(typeof balance.available).toBe("number")
    expect(typeof balance.pending).toBe("number")
  })
})
