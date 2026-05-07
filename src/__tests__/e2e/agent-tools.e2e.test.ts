import { TestContext, SKIP_E2E } from "./setup"
import { buildTools, executeTool } from "../../agent/tools"
import { MemoryStore } from "../../agent/memory"
import * as path from "path"
import * as os from "os"
import * as fs from "fs"

const describeE2E = SKIP_E2E ? describe.skip : describe

describeE2E("E2E: Agent Tools", () => {
  let ctx: TestContext
  let memory: MemoryStore
  const testMemoryPath = path.join(
    os.tmpdir(),
    `blaze-test-tools-${Date.now()}`
  )

  beforeAll(() => {
    ctx = new TestContext()
    // Override memory path for testing
    process.env.HOME = testMemoryPath
    fs.mkdirSync(path.join(testMemoryPath, ".blaze"), { recursive: true })
    memory = new MemoryStore()
  })

  afterAll(async () => {
    await ctx.cleanup()
    try {
      fs.rmSync(testMemoryPath, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe("Tool Schema Generation", () => {
    it("generates valid Anthropic tool schemas", () => {
      const tools = buildTools(ctx.client, memory)
      expect(tools.length).toBeGreaterThan(0)

      // Verify each tool has required fields
      tools.forEach(tool => {
        expect(tool).toHaveProperty("name")
        expect(tool).toHaveProperty("description")
        expect(tool).toHaveProperty("input_schema")
        expect(tool.input_schema).toHaveProperty("type")
        expect(tool.input_schema.type).toBe("object")
      })
    })

    it("includes memory management tools", () => {
      const tools = buildTools(ctx.client, memory)
      const toolNames = tools.map(t => t.name)

      expect(toolNames).toContain("blaze_read_memory")
      expect(toolNames).toContain("blaze_save_pattern")
      expect(toolNames).toContain("blaze_log_payment")
    })

    it("includes consumer tools", () => {
      const tools = buildTools(ctx.client, memory)
      const toolNames = tools.map(t => t.name)

      expect(toolNames).toContain("blaze_get_me")
      expect(toolNames).toContain("blaze_get_balance")
      expect(toolNames).toContain("blaze_send_payment")
      expect(toolNames).toContain("blaze_list_contacts")
      expect(toolNames).toContain("blaze_add_contact")
    })

    it("includes business tools", () => {
      const tools = buildTools(ctx.client, memory)
      const toolNames = tools.map(t => t.name)

      expect(toolNames).toContain("blaze_list_customers")
      expect(toolNames).toContain("blaze_create_customer")
      expect(toolNames).toContain("blaze_list_transfers")
      expect(toolNames).toContain("blaze_create_transfer")
      expect(toolNames).toContain("blaze_list_payment_links")
      expect(toolNames).toContain("blaze_create_payment_link")
    })

    it("includes FX tools", () => {
      const tools = buildTools(ctx.client, memory)
      const toolNames = tools.map(t => t.name)

      expect(toolNames).toContain("blaze_fx_quote")
      expect(toolNames).toContain("blaze_fx_rates")
    })
  })

  describe("Memory Tools Execution", () => {
    it("executes blaze_read_memory", async () => {
      const result = await executeTool(
        "blaze_read_memory",
        {},
        ctx.client,
        memory
      )
      expect(result).toHaveProperty("patterns")
      expect(result).toHaveProperty("aliases")
      expect(result).toHaveProperty("recentPayments")
    })

    it("executes blaze_save_pattern", async () => {
      const result = await executeTool(
        "blaze_save_pattern",
        {
          trigger: "test rent payment",
          contact_id: "cust_test",
          amount: 1000,
          currency: "USD",
          note_template: "Rent {month}",
        },
        ctx.client,
        memory
      )
      expect(result).toEqual({ success: true })

      // Verify pattern was saved
      const pattern = memory.findPattern("test rent payment")
      expect(pattern).not.toBeNull()
      expect(pattern?.amount).toBe(1000)
    })

    it("executes blaze_log_payment", async () => {
      const result = await executeTool(
        "blaze_log_payment",
        {
          amount: 100,
          currency: "USD",
          to: "@test_user",
          note: "Test payment",
          payment_id: "pay_test_tools",
        },
        ctx.client,
        memory
      )
      expect(result).toEqual({ success: true })

      // Verify payment was logged
      const memoryData = memory.read()
      const logged = memoryData.recentPayments.find(
        p => p.paymentId === "pay_test_tools"
      )
      expect(logged).toBeDefined()
    })
  })

  describe("Balance Tools Execution", () => {
    it("executes blaze_get_balance", async () => {
      const result = await executeTool(
        "blaze_get_balance",
        {},
        ctx.client,
        memory
      )
      expect(result).toHaveProperty("available")
      expect(result).toHaveProperty("pending")
      expect(result).toHaveProperty("currency")
    })

    it("executes blaze_get_business_balance (alias)", async () => {
      const result = await executeTool(
        "blaze_get_business_balance",
        {},
        ctx.client,
        memory
      )
      expect(result).toHaveProperty("available")
      expect(result).toHaveProperty("currency")
    })
  })

  describe("Customer Tools Execution", () => {
    const testEmail = `tool-test-${Date.now()}@example.com`
    let customerId: string

    it("executes blaze_create_customer", async () => {
      const result = (await executeTool(
        "blaze_create_customer",
        {
          email: testEmail,
          first_name: "Tool",
          last_name: "Test",
        },
        ctx.client,
        memory
      )) as { id: string; email: string }

      expect(result).toHaveProperty("id")
      expect(result.email).toBe(testEmail)
      customerId = result.id
      ctx.track("customer", customerId)
    })

    it("executes blaze_list_customers with email filter", async () => {
      const result = (await executeTool(
        "blaze_list_customers",
        { email: testEmail },
        ctx.client,
        memory
      )) as { data: Array<{ email: string }> }

      expect(result.data.length).toBeGreaterThan(0)
      expect(result.data[0].email).toBe(testEmail)
    })

    it("executes blaze_get_customer", async () => {
      const result = (await executeTool(
        "blaze_get_customer",
        { id: customerId },
        ctx.client,
        memory
      )) as { id: string; email: string }

      expect(result.id).toBe(customerId)
      expect(result.email).toBe(testEmail)
    })
  })

  describe("FX Tools Execution", () => {
    it("executes blaze_fx_rates", async () => {
      const result = (await executeTool(
        "blaze_fx_rates",
        {},
        ctx.client,
        memory
      )) as { rates: Record<string, number>; base: string }

      expect(result).toHaveProperty("rates")
      expect(result).toHaveProperty("base")
      expect(typeof result.rates).toBe("object")
    })

    it("executes blaze_fx_rates with base currency", async () => {
      const result = (await executeTool(
        "blaze_fx_rates",
        { base: "MXN" },
        ctx.client,
        memory
      )) as { base: string }

      expect(result.base).toBe("MXN")
    })

    it("executes blaze_fx_quote", async () => {
      const result = (await executeTool(
        "blaze_fx_quote",
        {
          from: "USD",
          to: "MXN",
          amount: 100,
        },
        ctx.client,
        memory
      )) as {
        from_currency: string
        to_currency: string
        from_amount: number
        to_amount: number
        rate: number
      }

      expect(result.from_currency).toBe("USD")
      expect(result.to_currency).toBe("MXN")
      expect(result.from_amount).toBe(100)
      expect(result).toHaveProperty("to_amount")
      expect(result).toHaveProperty("rate")
      expect(typeof result.to_amount).toBe("number")
    })
  })

  describe("Payment Link Tools Execution", () => {
    let paymentLinkId: string

    it("executes blaze_create_payment_link", async () => {
      const result = (await executeTool(
        "blaze_create_payment_link",
        {
          amount: 50,
          currency: "USD",
          name: "Tool Test Payment Link",
          note: "Test from agent tools",
        },
        ctx.client,
        memory
      )) as { id: string; amount: number; currency: string }

      expect(result).toHaveProperty("id")
      expect(result.amount).toBe(50)
      expect(result.currency).toBe("USD")
      paymentLinkId = result.id
      ctx.track("payment_link", paymentLinkId)
    })

    it("executes blaze_list_payment_links", async () => {
      const result = (await executeTool(
        "blaze_list_payment_links",
        { limit: 10 },
        ctx.client,
        memory
      )) as { data: Array<{ id: string }> }

      expect(Array.isArray(result.data)).toBe(true)
      expect(result.data.length).toBeGreaterThan(0)
    })
  })

  describe("Transaction Tools Execution", () => {
    it("executes blaze_list_transactions", async () => {
      const result = (await executeTool(
        "blaze_list_transactions",
        { limit: 5 },
        ctx.client,
        memory
      )) as { data: Array<{ id: string }> }

      expect(Array.isArray(result.data)).toBe(true)
    })

    it("executes blaze_list_transactions with filters", async () => {
      const result = (await executeTool(
        "blaze_list_transactions",
        {
          limit: 10,
          type: "payment",
          status: "completed",
        },
        ctx.client,
        memory
      )) as { data: Array<{ type: string; status: string }> }

      expect(Array.isArray(result.data)).toBe(true)
      // All returned transactions should match filters if any exist
      result.data.forEach(tx => {
        if (tx.type) expect(tx.type).toBe("payment")
        if (tx.status) expect(tx.status).toBe("completed")
      })
    })
  })

  describe("Error Handling", () => {
    it("throws error for unknown tool", async () => {
      await expect(
        executeTool("blaze_nonexistent_tool", {}, ctx.client, memory)
      ).rejects.toThrow("Unknown tool")
    })

    it("returns error for invalid customer ID", async () => {
      await expect(
        executeTool(
          "blaze_get_customer",
          { id: "cust_invalid_nonexistent" },
          ctx.client,
          memory
        )
      ).rejects.toThrow()
    })

    it("handles missing required parameters gracefully", async () => {
      // Missing required 'id' parameter
      await expect(
        executeTool("blaze_get_customer", {}, ctx.client, memory)
      ).rejects.toThrow()
    })
  })

  describe("Tool Input Validation", () => {
    it("accepts valid inputs for blaze_create_customer", async () => {
      const email = `validation-test-${Date.now()}@example.com`
      const result = (await executeTool(
        "blaze_create_customer",
        {
          email,
          first_name: "Valid",
          last_name: "User",
          phone: "+1234567890",
        },
        ctx.client,
        memory
      )) as { id: string }

      expect(result).toHaveProperty("id")
      ctx.track("customer", result.id)
    })

    it("accepts valid inputs for blaze_fx_quote", async () => {
      const result = await executeTool(
        "blaze_fx_quote",
        {
          from: "USD",
          to: "EUR",
          amount: 1000,
        },
        ctx.client,
        memory
      )

      expect(result).toHaveProperty("rate")
    })
  })
})
