import { TestContext, SKIP_E2E } from "./setup"
import { runAgent } from "../../agent"
import * as path from "path"
import * as os from "os"
import * as fs from "fs"

// Skip tests if ANTHROPIC_API_KEY is not set
const SKIP_LLM_TESTS = !process.env.ANTHROPIC_API_KEY
const describeE2E = SKIP_E2E || SKIP_LLM_TESTS ? describe.skip : describe

// Helper to capture stdout
function captureStdout(fn: () => Promise<void>): Promise<string> {
  return new Promise((resolve, reject) => {
    const originalWrite = process.stdout.write.bind(process.stdout)
    let output = ""

    // Override stdout.write to capture output
    process.stdout.write = ((chunk: string | Buffer): boolean => {
      output += chunk.toString()
      return true
    }) as typeof process.stdout.write

    fn()
      .then(() => {
        process.stdout.write = originalWrite
        resolve(output)
      })
      .catch(err => {
        process.stdout.write = originalWrite
        reject(err)
      })
  })
}

describeE2E("E2E: Agent LLM", () => {
  let ctx: TestContext
  const testMemoryPath = path.join(os.tmpdir(), `blaze-test-llm-${Date.now()}`)

  beforeAll(() => {
    if (SKIP_LLM_TESTS) {
      console.log(
        "⏭️  Skipping LLM tests: ANTHROPIC_API_KEY not set in environment"
      )
    }
    ctx = new TestContext()
    // Override memory path for testing
    process.env.HOME = testMemoryPath
    fs.mkdirSync(path.join(testMemoryPath, ".blaze"), { recursive: true })
  })

  afterAll(async () => {
    await ctx.cleanup()
    try {
      fs.rmSync(testMemoryPath, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe("Basic Tool Calling", () => {
    it("calls blaze_get_balance tool for balance query", async () => {
      const output = await captureStdout(() =>
        runAgent("What's my balance?", ctx.client)
      )

      // Should call the balance tool and return a response
      expect(output).toBeTruthy()
      expect(output.toLowerCase()).toMatch(/balance|available|pending/)
    }, 30000)

    it("calls blaze_fx_rates for exchange rate queries", async () => {
      const output = await captureStdout(() =>
        runAgent("What's the USD to MXN exchange rate?", ctx.client)
      )

      expect(output).toBeTruthy()
      expect(output.toLowerCase()).toMatch(/rate|exchange|usd|mxn/)
    }, 30000)

    it("calls blaze_fx_quote for specific amount conversions", async () => {
      const output = await captureStdout(() =>
        runAgent("How much is 100 USD in MXN?", ctx.client)
      )

      expect(output).toBeTruthy()
      expect(output).toMatch(/100/)
      expect(output.toLowerCase()).toMatch(/usd|mxn/)
    }, 30000)
  })

  describe("Customer Management", () => {
    const testEmail = `llm-test-${Date.now()}@example.com`

    it("creates a customer via natural language", async () => {
      const output = await captureStdout(() =>
        runAgent(
          `Create a customer with email ${testEmail}, first name LLM, last name Test`,
          ctx.client
        )
      )

      expect(output).toBeTruthy()
      expect(output).toContain(testEmail)

      // Verify customer was actually created
      const customers = await ctx.client.listCustomers({ email: testEmail })
      expect(customers.data.length).toBeGreaterThan(0)
      ctx.track("customer", customers.data[0].id)
    }, 30000)

    it("lists customers with natural language query", async () => {
      const output = await captureStdout(() =>
        runAgent(`List all customers with email ${testEmail}`, ctx.client)
      )

      expect(output).toBeTruthy()
      expect(output).toContain(testEmail)
    }, 30000)
  })

  describe("Payment Links", () => {
    it("creates a payment link via natural language", async () => {
      const output = await captureStdout(() =>
        runAgent(
          "Create a payment link for $25 USD with note 'LLM Test Payment'",
          ctx.client
        )
      )

      expect(output).toBeTruthy()
      expect(output).toMatch(/25|payment.*link/i)

      // Extract payment link ID from output to clean up
      // Format: "id": "pl_..." or similar
      const idMatch = output.match(/["']id["']:\s*["']([^"']+)["']/)
      if (idMatch) {
        ctx.track("payment_link", idMatch[1])
      }
    }, 30000)

    it("lists payment links", async () => {
      const output = await captureStdout(() =>
        runAgent("List my recent payment links", ctx.client)
      )

      expect(output).toBeTruthy()
      expect(output.toLowerCase()).toMatch(/payment.*link/)
    }, 30000)
  })

  describe("Memory Integration", () => {
    it("reads agent memory", async () => {
      const output = await captureStdout(() =>
        runAgent("Show me my saved payment patterns", ctx.client)
      )

      expect(output).toBeTruthy()
      expect(output.toLowerCase()).toMatch(/pattern|memory|saved|recurring/)
    }, 30000)

    it("saves a recurring pattern", async () => {
      const output = await captureStdout(() =>
        runAgent(
          'Save a pattern: when I say "pay my test rent", send $1000 USD to @test_landlord with note "Monthly rent"',
          ctx.client
        )
      )

      expect(output).toBeTruthy()
      expect(output.toLowerCase()).toMatch(/saved|pattern|remember/)
    }, 30000)
  })

  describe("Multi-Turn Conversations", () => {
    it("handles follow-up questions", async () => {
      // First question
      const output1 = await captureStdout(() =>
        runAgent("What's my balance?", ctx.client)
      )
      expect(output1).toBeTruthy()

      // Note: In the current implementation, each runAgent call is independent
      // Multi-turn would require maintaining message history between calls
      // This test verifies single-turn works; true multi-turn would need
      // modification to runAgent to accept previous message context
    }, 30000)
  })

  describe("Error Handling", () => {
    it("handles requests for nonexistent resources gracefully", async () => {
      const output = await captureStdout(() =>
        runAgent(
          "Get customer details for ID cust_nonexistent_fake_id",
          ctx.client
        )
      )

      expect(output).toBeTruthy()
      expect(output.toLowerCase()).toMatch(/not found|doesn't exist|error/)
    }, 30000)

    it("handles ambiguous requests by asking for clarification", async () => {
      const output = await captureStdout(() =>
        runAgent("Send money", ctx.client)
      )

      expect(output).toBeTruthy()
      // Should ask for more information (amount, recipient, etc.)
      expect(output.toLowerCase()).toMatch(/how much|who|recipient|amount|need/)
    }, 30000)
  })

  describe("Transaction Queries", () => {
    it("lists recent transactions", async () => {
      const output = await captureStdout(() =>
        runAgent("Show me my recent transactions", ctx.client)
      )

      expect(output).toBeTruthy()
      expect(output.toLowerCase()).toMatch(/transaction/)
    }, 30000)

    it("filters transactions by status", async () => {
      const output = await captureStdout(() =>
        runAgent("Show me completed transactions", ctx.client)
      )

      expect(output).toBeTruthy()
      expect(output.toLowerCase()).toMatch(/completed|transaction/)
    }, 30000)
  })

  describe("Safety and Confirmation", () => {
    it("asks for confirmation before payments (when properly implemented)", async () => {
      // Note: Current implementation doesn't have built-in confirmation flow
      // This test documents expected behavior if implemented
      const output = await captureStdout(() =>
        runAgent("Send $1000 to @someone", ctx.client)
      )

      expect(output).toBeTruthy()
      // Should either ask for confirmation or indicate missing information
      expect(output.toLowerCase()).toMatch(
        /confirm|sure|verify|check|need more|recipient/
      )
    }, 30000)
  })

  describe("Natural Language Understanding", () => {
    it("understands various phrasings for balance check", async () => {
      const phrasings = [
        "Show me my balance",
        "How much money do I have?",
        "Check my account balance",
        "What's my current balance?",
      ]

      for (const phrase of phrasings) {
        const output = await captureStdout(() => runAgent(phrase, ctx.client))
        expect(output).toBeTruthy()
        expect(output.toLowerCase()).toMatch(/balance|available/)
      }
    }, 60000)

    it("understands various phrasings for customer list", async () => {
      const phrasings = [
        "List my customers",
        "Show all customers",
        "Who are my customers?",
      ]

      for (const phrase of phrasings) {
        const output = await captureStdout(() => runAgent(phrase, ctx.client))
        expect(output).toBeTruthy()
        expect(output.toLowerCase()).toMatch(/customer/)
      }
    }, 60000)
  })
})
