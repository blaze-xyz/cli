import { TestContext, SKIP_E2E } from "./setup"

const describeE2E = SKIP_E2E ? describe.skip : describe

describeE2E("E2E: Customers", () => {
  let ctx: TestContext
  const testEmail = `cli-test-${Date.now()}@example.com`

  beforeAll(() => {
    ctx = new TestContext()
  })
  afterAll(() => ctx.cleanup())

  it("creates a customer", async () => {
    const customer = await ctx.client.createCustomer({
      email: testEmail,
      first_name: "CLI",
      last_name: "Test",
    })
    ctx.track("customer", customer.id)
    expect(customer.email).toBe(testEmail)
    expect(customer.first_name).toBe("CLI")
  })

  it("lists customers with email filter", async () => {
    const list = await ctx.client.listCustomers({ email: testEmail })
    expect(list.data.length).toBeGreaterThan(0)
    expect(list.data[0].email).toBe(testEmail)
  })

  it("gets customer by ID", async () => {
    const list = await ctx.client.listCustomers({ email: testEmail })
    const customer = await ctx.client.getCustomer(list.data[0].id)
    expect(customer.email).toBe(testEmail)
  })

  it("updates customer", async () => {
    const list = await ctx.client.listCustomers({ email: testEmail })
    const updated = await ctx.client.updateCustomer(list.data[0].id, {
      first_name: "Updated",
    })
    expect(updated.first_name).toBe("Updated")
  })

  it("archives customer", async () => {
    const list = await ctx.client.listCustomers({ email: testEmail })
    await ctx.client.archiveCustomer(list.data[0].id)
    const archived = await ctx.client.listCustomers({
      email: testEmail,
      include_archived: true,
    })
    expect(archived.data[0].archived_at).not.toBeNull()
  })
})
