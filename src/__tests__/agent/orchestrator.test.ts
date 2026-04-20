import { Orchestrator } from "../../agent/orchestrator"
import type { BlazeClient } from "../../sdk/client"
import type {
  SendMoneyIntent,
  CheckBalanceIntent,
  ListTransactionsIntent,
} from "../../agent/intents"

function createMockClient(overrides: Partial<Record<string, jest.Mock>> = {}) {
  return {
    listCustomers: jest.fn().mockResolvedValue({ data: [], has_more: false }),
    createCustomer: jest
      .fn()
      .mockResolvedValue({ id: "cust_new", email: "test@example.com" }),
    listExternalAccounts: jest
      .fn()
      .mockResolvedValue({ data: [], has_more: false }),
    createTransfer: jest
      .fn()
      .mockResolvedValue({ id: "txn_123", status: "pending" }),
    getBalance: jest
      .fn()
      .mockResolvedValue({ available: 1000, pending: 0, currency: "USD" }),
    listTransactions: jest
      .fn()
      .mockResolvedValue({ data: [], has_more: false }),
    ...overrides,
  } as unknown as BlazeClient
}

describe("Orchestrator", () => {
  let consoleSpy: jest.SpyInstance

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, "log").mockImplementation()
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  describe("send money", () => {
    const baseIntent: SendMoneyIntent = {
      type: "send_money",
      amount: 500,
      currency: "USD",
      recipientEmail: "x@y.com",
    }

    it("finds existing customer by email and creates transfer", async () => {
      const client = createMockClient({
        listCustomers: jest.fn().mockResolvedValue({
          data: [
            { id: "cust_1", email: "x@y.com", first_name: "X", last_name: "Y" },
          ],
          has_more: false,
        }),
      })
      const orchestrator = new Orchestrator(client)

      await orchestrator.execute(baseIntent)

      expect(client.createCustomer).not.toHaveBeenCalled()
      expect(client.createTransfer).toHaveBeenCalledWith(
        expect.objectContaining({ customer_id: "cust_1" })
      )
    })

    it("creates new customer when not found", async () => {
      const client = createMockClient({
        listCustomers: jest.fn().mockResolvedValue({
          data: [],
          has_more: false,
        }),
        createCustomer: jest.fn().mockResolvedValue({
          id: "cust_new",
          email: "x@y.com",
        }),
      })
      const orchestrator = new Orchestrator(client)

      await orchestrator.execute(baseIntent)

      expect(client.createCustomer).toHaveBeenCalledWith(
        expect.objectContaining({ email: "x@y.com" })
      )
      expect(client.createTransfer).toHaveBeenCalledWith(
        expect.objectContaining({ customer_id: "cust_new" })
      )
    })

    it("uses first external account as destination when available", async () => {
      const client = createMockClient({
        listCustomers: jest.fn().mockResolvedValue({
          data: [
            { id: "cust_1", email: "x@y.com", first_name: "X", last_name: "Y" },
          ],
          has_more: false,
        }),
        listExternalAccounts: jest.fn().mockResolvedValue({
          data: [{ id: "ea_1", type: "bank_account", account_last4: "1234" }],
          has_more: false,
        }),
      })
      const orchestrator = new Orchestrator(client)

      await orchestrator.execute(baseIntent)

      expect(client.createTransfer).toHaveBeenCalledWith(
        expect.objectContaining({
          destination_type: "external_account",
          destination_id: "ea_1",
        })
      )
    })

    it("sends to wallet when no external accounts exist", async () => {
      const client = createMockClient({
        listCustomers: jest.fn().mockResolvedValue({
          data: [
            { id: "cust_1", email: "x@y.com", first_name: "X", last_name: "Y" },
          ],
          has_more: false,
        }),
        listExternalAccounts: jest.fn().mockResolvedValue({
          data: [],
          has_more: false,
        }),
      })
      const orchestrator = new Orchestrator(client)

      await orchestrator.execute(baseIntent)

      expect(client.createTransfer).toHaveBeenCalledWith(
        expect.objectContaining({
          destination_type: undefined,
          destination_id: undefined,
        })
      )
    })

    it("includes note in transfer when provided", async () => {
      const intentWithNote: SendMoneyIntent = {
        ...baseIntent,
        note: "test note",
      }
      const client = createMockClient({
        listCustomers: jest.fn().mockResolvedValue({
          data: [
            { id: "cust_1", email: "x@y.com", first_name: "X", last_name: "Y" },
          ],
          has_more: false,
        }),
      })
      const orchestrator = new Orchestrator(client)

      await orchestrator.execute(intentWithNote)

      expect(client.createTransfer).toHaveBeenCalledWith(
        expect.objectContaining({ note: "test note" })
      )
    })
  })

  describe("check balance", () => {
    const intent: CheckBalanceIntent = { type: "check_balance" }

    it("calls getBalance and logs the result", async () => {
      const client = createMockClient({
        getBalance: jest.fn().mockResolvedValue({
          available: 2500,
          pending: 100,
          currency: "USD",
        }),
      })
      const orchestrator = new Orchestrator(client)

      await orchestrator.execute(intent)

      expect(client.getBalance).toHaveBeenCalled()
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("2500"))
    })
  })

  describe("list transactions", () => {
    it("uses default limit of 10 when not specified in intent", async () => {
      const intent: ListTransactionsIntent = { type: "list_transactions" }
      const client = createMockClient()
      const orchestrator = new Orchestrator(client)

      await orchestrator.execute(intent)

      expect(client.listTransactions).toHaveBeenCalledWith({ limit: 10 })
    })

    it("uses specified limit from intent", async () => {
      const intent: ListTransactionsIntent = {
        type: "list_transactions",
        limit: 5,
      }
      const client = createMockClient()
      const orchestrator = new Orchestrator(client)

      await orchestrator.execute(intent)

      expect(client.listTransactions).toHaveBeenCalledWith({ limit: 5 })
    })
  })
})
