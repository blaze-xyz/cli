import { TestContext, SKIP_E2E } from "./setup"

const describeE2E = SKIP_E2E ? describe.skip : describe

describeE2E("E2E: Payment Links", () => {
  let ctx: TestContext
  let linkId: string

  beforeAll(() => {
    ctx = new TestContext()
  })
  afterAll(() => ctx.cleanup())

  it("creates a payment link", async () => {
    const link = await ctx.client.createPaymentLink({
      amount: 100,
      currency: "USD",
      name: "CLI Test Link",
    })
    linkId = link.id
    ctx.track("payment_link", link.id)
    expect(link.url).toBeTruthy()
    expect(link.short_code).toBeTruthy()
    expect(link.amount).toBe(100)
  })

  it("lists payment links", async () => {
    const list = await ctx.client.listPaymentLinks({ limit: 5 })
    expect(list.data.length).toBeGreaterThan(0)
  })

  it("gets payment link by ID", async () => {
    const link = await ctx.client.getPaymentLink(linkId)
    expect(link.id).toBe(linkId)
    expect(link.name).toBe("CLI Test Link")
  })

  it("updates payment link", async () => {
    const updated = await ctx.client.updatePaymentLink(linkId, {
      name: "Updated Link",
    })
    expect(updated.name).toBe("Updated Link")
  })

  it("cancels payment link", async () => {
    await ctx.client.cancelPaymentLink(linkId)
    const link = await ctx.client.getPaymentLink(linkId)
    expect(link.status.toLowerCase()).toContain("cancel")
  })
})
