import { TestContext, SKIP_E2E } from "./setup"

const describeE2E = SKIP_E2E ? describe.skip : describe

describeE2E("E2E: FX Rates & Quotes", () => {
  let ctx: TestContext

  beforeAll(() => {
    ctx = new TestContext()
  })

  it("gets FX rates", async () => {
    const rates = await ctx.client.getFxRates("USD")
    expect(rates).toHaveProperty("rates")
    expect(typeof rates.rates).toBe("object")
  })

  it("creates an FX quote", async () => {
    const quote = await ctx.client.createFxQuote({
      from_currency: "USD",
      to_currency: "MXN",
      amount: 100,
    })
    expect(quote.from_currency).toBe("USD")
    expect(quote.to_currency).toBe("MXN")
    expect(quote.exchange_rate).toBeGreaterThan(0)
    expect(quote.converted_amount).toBeGreaterThan(0)
  })
})
