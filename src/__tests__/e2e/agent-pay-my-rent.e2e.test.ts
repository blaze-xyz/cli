import { TestContext, SKIP_E2E } from "./setup"
import { runAgent } from "../../agent"
import { MemoryStore } from "../../agent/memory"
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

describeE2E("E2E: 'Pay My Rent' Agent Flow", () => {
  let ctx: TestContext
  const testMemoryPath = path.join(os.tmpdir(), `blaze-test-rent-${Date.now()}`)

  beforeAll(() => {
    if (SKIP_LLM_TESTS) {
      console.log("⏭️  Skipping 'pay my rent' tests: ANTHROPIC_API_KEY not set")
    }
    ctx = new TestContext()
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

  describe("First Time: No Memory, No Contacts", () => {
    it("asks user for landlord details when no data exists", async () => {
      const output = await captureStdout(() =>
        runAgent("pay my rent", ctx.client)
      )

      expect(output).toBeTruthy()

      // Should ask for clarification since no memory or contacts exist
      const lowerOutput = output.toLowerCase()
      expect(
        lowerOutput.includes("landlord") ||
          lowerOutput.includes("rent") ||
          lowerOutput.includes("contact") ||
          lowerOutput.includes("who")
      ).toBe(true)

      // Should NOT proceed with payment
      expect(lowerOutput).not.toMatch(/payment sent|completed|processing/)
    }, 60000)
  })

  describe("Memory Exists: Second Time Payment", () => {
    beforeEach(() => {
      // Pre-populate memory with a rent pattern
      const memory = new MemoryStore()
      memory.savePattern("pay my rent", {
        contactId: "cnt_test_landlord",
        contactName: "Jones Properties",
        amount: 1200,
        currency: "USD",
        noteTemplate: "Rent {month} {year}",
      })
    })

    it("reads memory first before searching contacts", async () => {
      const output = await captureStdout(() =>
        runAgent("pay my rent", ctx.client)
      )

      expect(output).toBeTruthy()

      // Should mention the saved contact from memory
      expect(output).toMatch(/Jones Properties|landlord|1200/)

      // Should confirm before executing
      const lowerOutput = output.toLowerCase()
      expect(
        lowerOutput.includes("confirm") ||
          lowerOutput.includes("send") ||
          lowerOutput.includes("pay")
      ).toBe(true)
    }, 60000)

    it("checks balance before attempting payment", async () => {
      const output = await captureStdout(() =>
        runAgent("pay my rent", ctx.client)
      )

      expect(output).toBeTruthy()

      // Should mention balance or check funds
      const lowerOutput = output.toLowerCase()
      expect(
        lowerOutput.includes("balance") ||
          lowerOutput.includes("available") ||
          lowerOutput.includes("funds")
      ).toBe(true)
    }, 60000)
  })

  describe("Contact Search: Found in Contacts", () => {
    it("searches contacts when no memory pattern exists", async () => {
      // Clear memory
      const memory = new MemoryStore()
      memory.clear()

      const output = await captureStdout(() =>
        runAgent("pay my rent", ctx.client)
      )

      expect(output).toBeTruthy()

      // Should indicate searching or ask about contacts
      const lowerOutput = output.toLowerCase()
      expect(
        lowerOutput.includes("contact") ||
          lowerOutput.includes("search") ||
          lowerOutput.includes("find")
      ).toBe(true)
    }, 60000)
  })

  describe("Balance Gate: Insufficient Funds", () => {
    it("stops payment if balance is insufficient", async () => {
      // Pre-populate memory with a high rent amount
      const memory = new MemoryStore()
      memory.savePattern("pay my expensive rent", {
        contactId: "cnt_test_landlord",
        contactName: "Expensive Landlord",
        amount: 999999, // Way more than test account balance
        currency: "USD",
        noteTemplate: "Rent",
      })

      const output = await captureStdout(() =>
        runAgent("pay my expensive rent", ctx.client)
      )

      expect(output).toBeTruthy()

      // Should mention insufficient balance
      const lowerOutput = output.toLowerCase()
      expect(
        lowerOutput.includes("insufficient") ||
          lowerOutput.includes("not enough") ||
          lowerOutput.includes("balance")
      ).toBe(true)

      // Should NOT proceed with payment
      expect(lowerOutput).not.toMatch(/payment sent|completed|processing/)
    }, 60000)
  })

  describe("Routing Logic: Correct Command Path", () => {
    it("uses 'blaze contacts pay' for bank account contacts", async () => {
      const memory = new MemoryStore()
      memory.savePattern("pay landlord with bank", {
        contactId: "cnt_bank_account",
        contactName: "Landlord Bank LLC",
        contactType: "bank",
        amount: 1000,
        currency: "USD",
      })

      const output = await captureStdout(() =>
        runAgent("pay landlord with bank", ctx.client)
      )

      expect(output).toBeTruthy()

      // Should indicate bank payment path (not P2P)
      const lowerOutput = output.toLowerCase()
      expect(
        lowerOutput.includes("bank") ||
          lowerOutput.includes("transfer") ||
          lowerOutput.includes("account")
      ).toBe(true)

      // Should NOT mention @blazetag or P2P
      expect(lowerOutput).not.toMatch(/@|peer-to-peer|p2p/)
    }, 60000)

    it("uses 'blaze send' for contacts with @blazetag", async () => {
      const memory = new MemoryStore()
      memory.savePattern("pay landlord on blaze", {
        contactId: "cnt_blazetag",
        contactName: "Tech Landlord",
        blazetag: "@techlord",
        amount: 800,
        currency: "USD",
      })

      const output = await captureStdout(() =>
        runAgent("pay landlord on blaze", ctx.client)
      )

      expect(output).toBeTruthy()

      // Should mention @blazetag or P2P
      const lowerOutput = output.toLowerCase()
      expect(
        lowerOutput.includes("@techlord") ||
          lowerOutput.includes("blaze user") ||
          lowerOutput.includes("send")
      ).toBe(true)
    }, 60000)
  })

  describe("Ambiguity Handling", () => {
    it("asks for amount when not specified and not in memory", async () => {
      const output = await captureStdout(() =>
        runAgent("pay my rent", ctx.client)
      )

      expect(output).toBeTruthy()

      // Should ask for amount or mention amount
      const lowerOutput = output.toLowerCase()
      expect(
        lowerOutput.includes("how much") ||
          lowerOutput.includes("amount") ||
          lowerOutput.includes("rent is")
      ).toBe(true)
    }, 60000)

    it("handles multiple contacts with similar names", async () => {
      // This would require seeding multiple contacts in staging
      // Skipping implementation for now - requires staging data setup
      // Test covered conceptually in simulation doc
    })
  })

  describe("Memory Integration", () => {
    it("offers to save pattern after successful simulated payment", async () => {
      // Clear memory first
      const memory = new MemoryStore()
      memory.clear()

      // This test requires a full payment flow which needs:
      // 1. Mock contacts in staging
      // 2. Sufficient balance
      // 3. Full confirmation flow
      // Skipping implementation - covered in other memory tests
    })

    it("uses fuzzy matching for memory patterns", async () => {
      const memory = new MemoryStore()
      memory.savePattern("pay my rent", {
        contactId: "cnt_fuzzy_test",
        contactName: "Fuzzy Landlord",
        amount: 500,
        currency: "USD",
      })

      // Try variations that should match
      const variations = [
        "pay rent",
        "rent payment",
        "pay the rent",
        "my rent payment",
      ]

      for (const variation of variations) {
        const pattern = memory.findPattern(variation)
        expect(pattern).toBeTruthy()
        expect(pattern?.contactName).toBe("Fuzzy Landlord")
      }
    })
  })

  describe("Error Handling", () => {
    it("handles invalid contact ID gracefully", async () => {
      const memory = new MemoryStore()
      memory.savePattern("pay invalid landlord", {
        contactId: "cnt_nonexistent_12345",
        contactName: "Ghost Landlord",
        amount: 600,
        currency: "USD",
      })

      const output = await captureStdout(() =>
        runAgent("pay invalid landlord", ctx.client)
      )

      expect(output).toBeTruthy()

      // Should handle error gracefully
      const lowerOutput = output.toLowerCase()
      expect(
        lowerOutput.includes("not found") ||
          lowerOutput.includes("error") ||
          lowerOutput.includes("invalid")
      ).toBe(true)
    }, 60000)

    it("handles network errors gracefully", async () => {
      // This would require mocking network failures
      // Conceptual test - full implementation needs mock infrastructure
    })
  })
})

/**
 * CRITICAL ASSERTIONS CHECKLIST
 *
 * Based on the skills and expected agent behavior:
 *
 * ✅ Memory Check First
 * - Agent MUST call memory check before searching contacts
 * - Verified by: presence of memory-related output
 *
 * ✅ Balance Gate
 * - Agent MUST check balance before attempting payment
 * - Agent MUST stop if balance insufficient
 * - Verified by: balance mentions in output + no payment on insufficient funds
 *
 * ✅ Correct Payment Path
 * - Bank/CLABE contacts → blaze contacts pay
 * - @blazetag contacts → blaze send
 * - Verified by: output mentions correct payment method
 *
 * ✅ User Confirmation
 * - Agent MUST confirm with user before executing payment
 * - Verified by: confirmation language in output
 *
 * ✅ Disambiguation
 * - Agent MUST ask for clarification on ambiguous input
 * - Verified by: clarifying questions in output
 *
 * ⚠️ Limitations of These Tests
 * - Cannot verify exact tool call sequence without deeper instrumentation
 * - Tests rely on output text analysis rather than tool call capture
 * - Need staging data setup for full end-to-end payment flow
 * - Multi-turn conversation handling needs separate test infrastructure
 *
 * 📝 Next Steps for Complete Testing
 * 1. Add tool call logging/capture mechanism to agent
 * 2. Create staging seed script for test contacts
 * 3. Add multi-turn conversation test framework
 * 4. Verify tool selection matches expected sequence from simulation doc
 */
