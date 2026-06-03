import { Command } from "commander"
import { registerSendCommand } from "../../cli/commands/send"
import { registerContactsCommands } from "../../cli/commands/contacts"
import { registerTransfersCommands } from "../../cli/commands/transfers"
import { registerWithdrawalsCommands } from "../../cli/commands/withdrawals"
import { registerPaylinksCommands } from "../../cli/commands/paylinks"
import { registerCustomersCommands } from "../../cli/commands/customers"
import { registerApiKeysCommands } from "../../cli/commands/api-keys"
import { registerWebhooksCommands } from "../../cli/commands/webhooks"
import { registerTeamCommands } from "../../cli/commands/team"
import { registerRecipientsCommands } from "../../cli/commands/recipients"
import { registerInvoicesCommands } from "../../cli/commands/invoices"
import { registerSubscriptionsCommands } from "../../cli/commands/subscriptions"
import { registerDisputesCommands } from "../../cli/commands/disputes"

jest.mock("../../cli/utils", () => ({
  getClient: jest.fn(),
  getGlobalOpts: jest.fn(),
  handleError: jest.fn(err => {
    throw err
  }),
  requireBusinessContext: jest.fn().mockResolvedValue("biz_123"),
}))

jest.mock("../../cli/auth-utils", () => ({
  getAuth: jest.fn().mockResolvedValue({
    user: { blazetag: "testuser", email: "test@blaze.money" },
  }),
}))

jest.mock("../../cli/output", () => ({
  formatOutput: jest.fn(),
}))

jest.mock("../../constants/fx-rates", () => ({
  estimateUsdAmount: jest.fn((amount: number) => amount * 0.05),
}))

jest.mock("@inquirer/prompts", () => ({
  confirm: jest.fn().mockResolvedValue(true),
  select: jest.fn(),
}))

import { getClient, getGlobalOpts } from "../../cli/utils"
import { formatOutput } from "../../cli/output"

const mockGetClient = getClient as jest.MockedFunction<typeof getClient>
const mockGetGlobalOpts = getGlobalOpts as jest.MockedFunction<
  typeof getGlobalOpts
>
const mockFormatOutput = formatOutput as jest.MockedFunction<
  typeof formatOutput
>

function createMockClient(overrides: Record<string, unknown> = {}) {
  return {
    sendPayment: jest.fn().mockResolvedValue({ id: "pay_123", status: "Sent" }),
    getUserByBlazetag: jest.fn().mockResolvedValue({
      blazetag: "bossman",
      public_key: "GXXX",
      display_name: "Boss Man",
      first_name: "Boss",
      last_name: "Man",
    }),
    searchUsers: jest.fn().mockResolvedValue({ data: [] }),
    getBalance: jest
      .fn()
      .mockResolvedValue({ available: 100000, pending: 0, currency: "USD" }),
    listContacts: jest.fn().mockResolvedValue({ data: [] }),
    getContact: jest.fn().mockResolvedValue({
      id: "con_123",
      first_name: "John",
      last_name: "Doe",
      bank_accounts: [
        {
          id: "ba_1",
          bank_name: "Chase",
          account_number: "1234567890",
          currency_id: "USD",
        },
      ],
    }),
    payContact: jest
      .fn()
      .mockResolvedValue({ id: "tr_123", status: "processing" }),
    createContact: jest.fn().mockResolvedValue({ id: "con_456" }),
    deleteContact: jest.fn().mockResolvedValue(undefined),
    listTransfers: jest.fn().mockResolvedValue({ data: [] }),
    getTransfer: jest.fn().mockResolvedValue({
      id: "tr_999",
      status: "completed",
      amount: 5000,
      currency: "USD",
      fee: 50,
      source: { type: "blaze_balance", id: "src_1" },
      destination: { type: "us_bank_account", id: "dst_1" },
      note: "Test transfer",
      created_at: "2026-01-15T10:00:00Z",
      completed_at: "2026-01-15T10:05:00Z",
    }),
    createTransfer: jest
      .fn()
      .mockResolvedValue({ id: "tr_456", status: "pending" }),
    listWithdrawals: jest.fn().mockResolvedValue({ data: [] }),
    getWithdrawal: jest.fn().mockResolvedValue({ id: "wd_1" }),
    createWithdrawal: jest
      .fn()
      .mockResolvedValue({ id: "wd_789", status: "pending" }),
    listPaymentLinks: jest.fn().mockResolvedValue({ data: [] }),
    getPaymentLink: jest.fn().mockResolvedValue({ id: "pl_1" }),
    createPaymentLink: jest.fn().mockResolvedValue({
      id: "pl_123",
      url: "https://pay.blaze.money/pl_123",
      status: "active",
    }),
    cancelPaymentLink: jest.fn().mockResolvedValue(undefined),
    updatePaymentLink: jest.fn().mockResolvedValue({ id: "pl_1" }),
    listCustomers: jest.fn().mockResolvedValue({ data: [] }),
    getCustomer: jest.fn().mockResolvedValue({ id: "cus_1" }),
    createCustomer: jest
      .fn()
      .mockResolvedValue({ id: "cus_123", email: "test@example.com" }),
    updateCustomer: jest.fn().mockResolvedValue({ id: "cus_1" }),
    archiveCustomer: jest.fn().mockResolvedValue(undefined),
    listApiKeys: jest.fn().mockResolvedValue({ data: [] }),
    createApiKey: jest.fn().mockResolvedValue({
      id: "key_1",
      key: "sk_live_abc123xyz",
      scopes: ["read", "write"],
      expires_at: "2027-01-01T00:00:00Z",
    }),
    revokeApiKey: jest.fn().mockResolvedValue(undefined),
    updateApiKeyScopes: jest.fn().mockResolvedValue({ id: "key_1" }),
    listWebhooks: jest.fn().mockResolvedValue({ data: [] }),
    getWebhook: jest.fn().mockResolvedValue({ id: "wh_1" }),
    createWebhook: jest.fn().mockResolvedValue({
      id: "wh_123",
      secret: "whsec_abc123",
      events: ["payment.completed", "transfer.created"],
    }),
    deleteWebhook: jest.fn().mockResolvedValue(undefined),
    updateWebhook: jest.fn().mockResolvedValue({ id: "wh_1" }),
    listTeamMembers: jest.fn().mockResolvedValue({ data: [] }),
    listPendingInvitations: jest.fn().mockResolvedValue({ data: [] }),
    inviteTeamMember: jest
      .fn()
      .mockResolvedValue({ id: "inv_1", email: "new@team.com" }),
    updateMemberRole: jest.fn().mockResolvedValue({ id: "mem_1" }),
    removeMember: jest.fn().mockResolvedValue(undefined),
    transferOwnership: jest.fn().mockResolvedValue(undefined),
    listExternalAccounts: jest.fn().mockResolvedValue({ data: [] }),
    createExternalAccount: jest.fn().mockResolvedValue({ id: "ext_1" }),
    deleteExternalAccount: jest.fn().mockResolvedValue(undefined),
    sendInvoice: jest.fn().mockResolvedValue({ id: "inv_1", status: "sent" }),
    markInvoicePaid: jest
      .fn()
      .mockResolvedValue({ id: "inv_1", status: "paid" }),
    voidInvoice: jest.fn().mockResolvedValue({ id: "inv_1", status: "voided" }),
    listInvoices: jest.fn().mockResolvedValue({ data: [] }),
    getInvoice: jest.fn().mockResolvedValue({ id: "inv_1" }),
    createInvoice: jest.fn().mockResolvedValue({ id: "inv_1" }),
    listSubscriptions: jest.fn().mockResolvedValue({ data: [] }),
    getSubscription: jest.fn().mockResolvedValue({ id: "sub_1" }),
    createSubscription: jest.fn().mockResolvedValue({ id: "sub_1" }),
    cancelSubscription: jest
      .fn()
      .mockResolvedValue({ id: "sub_1", status: "cancelled" }),
    pauseSubscription: jest
      .fn()
      .mockResolvedValue({ id: "sub_1", status: "paused" }),
    resumeSubscription: jest
      .fn()
      .mockResolvedValue({ id: "sub_1", status: "active" }),
    listDisputes: jest.fn().mockResolvedValue({ data: [] }),
    getDispute: jest.fn().mockResolvedValue({ id: "dis_1" }),
    submitDisputeEvidence: jest
      .fn()
      .mockResolvedValue({ id: "dis_1", status: "evidence_submitted" }),
    closeDispute: jest
      .fn()
      .mockResolvedValue({ id: "dis_1", status: "closed" }),
    graphqlRequest: jest.fn().mockResolvedValue({}),
    ...overrides,
  } as unknown as ReturnType<typeof getClient> extends Promise<infer T>
    ? T
    : never
}

let logOutput: string[]
let program: Command

function setupProgram() {
  program = new Command()
  program
    .option("--api-key <key>", "API key")
    .option("--base-url <url>", "Base URL")
    .option("--format <format>", "Output format")
    .option("--business <id>", "Business ID")
    .option("--personal", "Personal mode")
  program.exitOverride()
  return program
}

function setupTableFormat() {
  mockGetGlobalOpts.mockReturnValue({
    format: "table",
    personal: true,
  })
}

function setupJsonFormat() {
  mockGetGlobalOpts.mockReturnValue({
    format: "json",
    personal: true,
  })
}

beforeEach(() => {
  logOutput = []
  jest.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    logOutput.push(args.map(String).join(" "))
  })
  jest.spyOn(console, "error").mockImplementation(() => {})
  mockGetClient.mockResolvedValue(createMockClient())
  setupTableFormat()
  program = setupProgram()
})

afterEach(() => {
  jest.restoreAllMocks()
  mockFormatOutput.mockClear()
})

function getOutput(): string {
  return logOutput.join("\n")
}

describe("CLI Command Responses", () => {
  describe("send", () => {
    beforeEach(() => {
      registerSendCommand(program)
    })

    it("outputs natural sentence with amount, currency, and recipient", async () => {
      await program.parseAsync([
        "node",
        "blaze",
        "send",
        "@bossman",
        "--amount",
        "5",
        "--yes",
      ])
      const output = getOutput()
      expect(output).toContain(
        "Your payment of 5 USD to Boss Man has been sent"
      )
      expect(output).not.toContain("ID:")
      expect(output).not.toContain("Status:")
      expect(output).not.toContain("pay_123")
    })

    it("includes note when provided", async () => {
      await program.parseAsync([
        "node",
        "blaze",
        "send",
        "@bossman",
        "--amount",
        "0.01",
        "--note",
        "CLI test",
        "--yes",
      ])
      const output = getOutput()
      expect(output).toContain('with the note "CLI test"')
    })

    it("uses --json flag to output structured JSON", async () => {
      setupJsonFormat()
      await program.parseAsync([
        "node",
        "blaze",
        "send",
        "@bossman",
        "--amount",
        "5",
        "--yes",
      ])
      expect(mockFormatOutput).toHaveBeenCalledWith(
        { id: "pay_123", status: "Sent" },
        "json"
      )
      expect(getOutput()).not.toContain("Your payment")
    })
  })

  describe("contacts pay", () => {
    beforeEach(() => {
      registerContactsCommands(program)
      mockGetClient.mockResolvedValue(
        createMockClient({
          listContacts: jest.fn().mockResolvedValue({
            data: [
              {
                id: "con_123",
                first_name: "John",
                last_name: "Doe",
                bank_accounts: [
                  {
                    id: "ba_1",
                    bank_name: "Chase",
                    account_number: "1234567890",
                    currency_id: "USD",
                  },
                ],
              },
            ],
          }),
          getBalance: jest
            .fn()
            .mockResolvedValue({ available: 100000, pending: 0 }),
          payContact: jest
            .fn()
            .mockResolvedValue({ id: "tr_123", status: "processing" }),
        })
      )
    })

    it("outputs natural sentence with amount, recipient, and account", async () => {
      await program.parseAsync([
        "node",
        "blaze",
        "contacts",
        "pay",
        "John",
        "--amount",
        "100",
        "--yes",
      ])
      const output = getOutput()
      expect(output).toContain("Your payment of 100 USD to John Doe")
      expect(output).toContain("Chase (****7890)")
      expect(output).toContain("has been submitted")
      expect(output).not.toContain("Transfer ID:")
      expect(output).not.toContain("tr_123")
    })

    it("includes note in contacts pay response", async () => {
      await program.parseAsync([
        "node",
        "blaze",
        "contacts",
        "pay",
        "John",
        "--amount",
        "50",
        "--note",
        "Rent payment",
        "--yes",
      ])
      const output = getOutput()
      expect(output).toContain('with the note "Rent payment"')
    })

    it("uses 'your contact' fallback when contact has no name", async () => {
      mockGetClient.mockResolvedValue(
        createMockClient({
          listContacts: jest.fn().mockResolvedValue({
            data: [
              {
                id: "con_999",
                first_name: null,
                last_name: null,
                business_name: null,
                bank_accounts: [
                  {
                    id: "ba_1",
                    bank_name: "Bank",
                    account_number: "9999",
                    currency_id: "USD",
                  },
                ],
              },
            ],
          }),
          getBalance: jest
            .fn()
            .mockResolvedValue({ available: 100000, pending: 0 }),
          payContact: jest
            .fn()
            .mockResolvedValue({ id: "tr_123", status: "processing" }),
        })
      )
      await program.parseAsync([
        "node",
        "blaze",
        "contacts",
        "pay",
        "con_999",
        "--amount",
        "25",
        "--yes",
      ])
      const output = getOutput()
      expect(output).toContain("your contact")
      expect(output).not.toContain("con_999")
    })
  })

  describe("contacts add", () => {
    beforeEach(() => {
      registerContactsCommands(program)
    })

    it("outputs natural sentence with contact name", async () => {
      await program.parseAsync([
        "node",
        "blaze",
        "contacts",
        "add",
        "--first-name",
        "Jane",
        "--last-name",
        "Smith",
        "--phone",
        "+12025551234",
        "--account-number",
        "123456789",
      ])
      const output = getOutput()
      expect(output).toContain("Jane Smith has been added to your contacts")
      expect(output).not.toContain("ID:")
      expect(output).not.toContain("con_456")
    })
  })

  describe("contacts remove", () => {
    beforeEach(() => {
      registerContactsCommands(program)
    })

    it("outputs confirmation without ID", async () => {
      await program.parseAsync([
        "node",
        "blaze",
        "contacts",
        "remove",
        "con_123",
        "--yes",
      ])
      const output = getOutput()
      expect(output).toContain("Contact removed.")
      expect(output).not.toContain("con_123")
    })
  })

  describe("transfers create", () => {
    beforeEach(() => {
      registerTransfersCommands(program)
    })

    it("outputs natural sentence with amount and currency", async () => {
      await program.parseAsync([
        "node",
        "blaze",
        "transfers",
        "create",
        "--amount",
        "50",
      ])
      const output = getOutput()
      expect(output).toContain(
        "Transfer of 50.00 USD created and is now processing"
      )
      expect(output).not.toContain("ID:")
      expect(output).not.toContain("tr_456")
    })

    it("includes note in transfer response", async () => {
      await program.parseAsync([
        "node",
        "blaze",
        "transfers",
        "create",
        "--amount",
        "75",
        "--note",
        "Monthly payout",
      ])
      const output = getOutput()
      expect(output).toContain('with the note "Monthly payout"')
    })

    it("uses specified currency without dollar sign", async () => {
      await program.parseAsync([
        "node",
        "blaze",
        "transfers",
        "create",
        "--amount",
        "100",
        "--currency",
        "MXN",
      ])
      const output = getOutput()
      expect(output).toContain("100.00 MXN")
      expect(output).not.toContain("$")
    })
  })

  describe("transfers get", () => {
    beforeEach(() => {
      registerTransfersCommands(program)
    })

    it("shows structured detail view without IDs", async () => {
      await program.parseAsync(["node", "blaze", "transfers", "get", "tr_999"])
      const output = getOutput()
      expect(output).toContain("Transfer Details")
      expect(output).toContain("completed")
      expect(output).toContain("50.00 USD")
      expect(output).toContain("0.50 USD")
      expect(output).toContain("blaze balance")
      expect(output).toContain("us bank account")
      expect(output).toContain("Test transfer")
      expect(output).not.toContain("tr_999")
      expect(output).not.toContain("src_1")
      expect(output).not.toContain("dst_1")
    })

    it("outputs JSON when format is json", async () => {
      setupJsonFormat()
      await program.parseAsync(["node", "blaze", "transfers", "get", "tr_999"])
      expect(mockFormatOutput).toHaveBeenCalledWith(
        expect.objectContaining({ id: "tr_999" }),
        "json"
      )
    })
  })

  describe("withdrawals create", () => {
    beforeEach(() => {
      registerWithdrawalsCommands(program)
    })

    it("outputs natural sentence with amount", async () => {
      await program.parseAsync([
        "node",
        "blaze",
        "withdrawals",
        "create",
        "--amount",
        "200",
        "--external-account-id",
        "ext_1",
      ])
      const output = getOutput()
      expect(output).toContain(
        "Your withdrawal of 200.00 USD has been initiated and is processing"
      )
      expect(output).not.toContain("ID:")
      expect(output).not.toContain("wd_789")
    })

    it("includes note in withdrawal response", async () => {
      await program.parseAsync([
        "node",
        "blaze",
        "withdrawals",
        "create",
        "--amount",
        "100",
        "--external-account-id",
        "ext_1",
        "--note",
        "Savings",
      ])
      const output = getOutput()
      expect(output).toContain('with the note "Savings"')
    })
  })

  describe("paylinks create", () => {
    beforeEach(() => {
      registerPaylinksCommands(program)
    })

    it("displays amount in dollars without dividing by 100", async () => {
      await program.parseAsync([
        "node",
        "blaze",
        "paylinks",
        "create",
        "--amount",
        "25",
      ])
      const output = getOutput()
      expect(output).toContain("25.00 USD")
      expect(output).not.toContain("0.25")
      expect(output).not.toContain("$")
    })

    it("shows payment link URL", async () => {
      await program.parseAsync([
        "node",
        "blaze",
        "paylinks",
        "create",
        "--amount",
        "10",
      ])
      const output = getOutput()
      expect(output).toContain("https://pay.blaze.money/pl_123")
      expect(output).toContain("Payment link for 10.00 USD created")
    })

    it("does not show internal IDs as labeled fields", async () => {
      await program.parseAsync([
        "node",
        "blaze",
        "paylinks",
        "create",
        "--amount",
        "50",
      ])
      const output = getOutput()
      expect(output).not.toContain("ID:")
      expect(output).not.toContain("Status:")
    })
  })

  describe("paylinks cancel", () => {
    beforeEach(() => {
      registerPaylinksCommands(program)
    })

    it("outputs confirmation without ID", async () => {
      await program.parseAsync([
        "node",
        "blaze",
        "paylinks",
        "cancel",
        "pl_123",
      ])
      const output = getOutput()
      expect(output).toContain("Payment link cancelled.")
      expect(output).not.toContain("pl_123")
    })
  })

  describe("customers create", () => {
    beforeEach(() => {
      registerCustomersCommands(program)
    })

    it("outputs natural sentence with email", async () => {
      await program.parseAsync([
        "node",
        "blaze",
        "customers",
        "create",
        "--email",
        "john@acme.com",
      ])
      const output = getOutput()
      expect(output).toContain("Customer john@acme.com has been created")
      expect(output).not.toContain("ID:")
      expect(output).not.toContain("cus_123")
    })
  })

  describe("customers archive", () => {
    beforeEach(() => {
      registerCustomersCommands(program)
    })

    it("outputs confirmation without ID", async () => {
      await program.parseAsync([
        "node",
        "blaze",
        "customers",
        "archive",
        "cus_123",
      ])
      const output = getOutput()
      expect(output).toContain("Customer archived.")
      expect(output).not.toContain("cus_123")
    })
  })

  describe("api-keys create", () => {
    beforeEach(() => {
      registerApiKeysCommands(program)
    })

    it("shows key name, scopes, and the key itself", async () => {
      await program.parseAsync([
        "node",
        "blaze",
        "api-keys",
        "create",
        "--name",
        "Production Key",
        "--scopes",
        "read,write",
      ])
      const output = getOutput()
      expect(output).toContain('API key "Production Key"')
      expect(output).toContain("scopes: read, write")
      expect(output).toContain("sk_live_abc123xyz")
      expect(output).toContain("won't be shown again")
    })

    it("shows expiration date when present", async () => {
      await program.parseAsync([
        "node",
        "blaze",
        "api-keys",
        "create",
        "--name",
        "Temp Key",
        "--scopes",
        "read",
        "--expires-in-days",
        "30",
      ])
      const output = getOutput()
      expect(output).toContain("Expires")
      expect(output).toMatch(/Expires\s+(Jan|Dec)\s+\d+,\s+20\d{2}/)
    })

    it("shows test mode indicator", async () => {
      await program.parseAsync([
        "node",
        "blaze",
        "api-keys",
        "create",
        "--name",
        "Test Key",
        "--scopes",
        "read",
        "--test",
      ])
      const output = getOutput()
      expect(output).toContain("(test mode)")
    })

    it("outputs JSON when format is json", async () => {
      setupJsonFormat()
      await program.parseAsync([
        "node",
        "blaze",
        "api-keys",
        "create",
        "--name",
        "Key",
        "--scopes",
        "read",
      ])
      expect(mockFormatOutput).toHaveBeenCalledWith(
        expect.objectContaining({ key: "sk_live_abc123xyz" }),
        "json"
      )
    })
  })

  describe("api-keys revoke", () => {
    beforeEach(() => {
      registerApiKeysCommands(program)
    })

    it("outputs confirmation without ID", async () => {
      await program.parseAsync([
        "node",
        "blaze",
        "api-keys",
        "revoke",
        "key_123",
        "--yes",
      ])
      const output = getOutput()
      expect(output).toContain("API key revoked.")
      expect(output).not.toContain("key_123")
    })
  })

  describe("webhooks create", () => {
    beforeEach(() => {
      registerWebhooksCommands(program)
    })

    it("shows URL, events, and signing secret", async () => {
      await program.parseAsync([
        "node",
        "blaze",
        "webhooks",
        "create",
        "--url",
        "https://example.com/hook",
        "--events",
        "payment.completed,transfer.created",
      ])
      const output = getOutput()
      expect(output).toContain(
        "Webhook endpoint created for https://example.com/hook"
      )
      expect(output).toContain("payment.completed, transfer.created")
      expect(output).toContain("whsec_abc123")
      expect(output).toContain("won't be shown again")
    })

    it("outputs JSON when format is json", async () => {
      setupJsonFormat()
      await program.parseAsync([
        "node",
        "blaze",
        "webhooks",
        "create",
        "--url",
        "https://example.com/hook",
      ])
      expect(mockFormatOutput).toHaveBeenCalledWith(
        expect.objectContaining({ secret: "whsec_abc123" }),
        "json"
      )
    })
  })

  describe("webhooks delete", () => {
    beforeEach(() => {
      registerWebhooksCommands(program)
    })

    it("outputs confirmation without ID", async () => {
      await program.parseAsync([
        "node",
        "blaze",
        "webhooks",
        "delete",
        "wh_123",
        "--yes",
      ])
      const output = getOutput()
      expect(output).toContain("Webhook deleted.")
      expect(output).not.toContain("wh_123")
    })
  })

  describe("team invite", () => {
    beforeEach(() => {
      registerTeamCommands(program)
    })

    it("outputs natural sentence with email and role", async () => {
      await program.parseAsync([
        "node",
        "blaze",
        "team",
        "invite",
        "--email",
        "new@team.com",
        "--role",
        "admin",
      ])
      const output = getOutput()
      expect(output).toContain("Invitation sent to new@team.com as admin")
      expect(output).not.toContain("inv_1")
    })
  })

  describe("team update-role", () => {
    beforeEach(() => {
      registerTeamCommands(program)
    })

    it("outputs natural sentence with role", async () => {
      await program.parseAsync([
        "node",
        "blaze",
        "team",
        "update-role",
        "mem_1",
        "--role",
        "editor",
      ])
      const output = getOutput()
      expect(output).toContain("Role updated to editor")
      expect(output).not.toContain("mem_1")
    })
  })

  describe("team remove", () => {
    beforeEach(() => {
      registerTeamCommands(program)
    })

    it("outputs confirmation without ID", async () => {
      await program.parseAsync([
        "node",
        "blaze",
        "team",
        "remove",
        "mem_1",
        "--yes",
      ])
      const output = getOutput()
      expect(output).toContain("Team member removed.")
      expect(output).not.toContain("mem_1")
    })
  })

  describe("team transfer-ownership", () => {
    beforeEach(() => {
      registerTeamCommands(program)
    })

    it("outputs generic success without ID", async () => {
      await program.parseAsync([
        "node",
        "blaze",
        "team",
        "transfer-ownership",
        "--new-owner-id",
        "mem_2",
        "--yes",
      ])
      const output = getOutput()
      expect(output).toContain("Ownership transferred successfully.")
      expect(output).not.toContain("mem_2")
    })
  })

  describe("recipients remove", () => {
    beforeEach(() => {
      registerRecipientsCommands(program)
    })

    it("outputs confirmation without ID", async () => {
      await program.parseAsync([
        "node",
        "blaze",
        "recipients",
        "remove",
        "--customer-id",
        "cus_1",
        "--account-id",
        "ext_1",
      ])
      const output = getOutput()
      expect(output).toContain("External account removed.")
      expect(output).not.toContain("ext_1")
    })
  })

  describe("invoices send", () => {
    beforeEach(() => {
      registerInvoicesCommands(program)
    })

    it("outputs natural confirmation", async () => {
      await program.parseAsync(["node", "blaze", "invoices", "send", "inv_1"])
      const output = getOutput()
      expect(output).toContain("Invoice sent to customer.")
      expect(output).not.toContain("inv_1")
    })

    it("outputs JSON when format is json", async () => {
      setupJsonFormat()
      await program.parseAsync(["node", "blaze", "invoices", "send", "inv_1"])
      expect(mockFormatOutput).toHaveBeenCalledWith(
        expect.objectContaining({ id: "inv_1", status: "sent" }),
        "json"
      )
    })
  })

  describe("invoices mark-paid", () => {
    beforeEach(() => {
      registerInvoicesCommands(program)
    })

    it("outputs natural confirmation", async () => {
      await program.parseAsync([
        "node",
        "blaze",
        "invoices",
        "mark-paid",
        "inv_1",
      ])
      const output = getOutput()
      expect(output).toContain("Invoice marked as paid.")
    })
  })

  describe("invoices void", () => {
    beforeEach(() => {
      registerInvoicesCommands(program)
    })

    it("outputs natural confirmation", async () => {
      await program.parseAsync(["node", "blaze", "invoices", "void", "inv_1"])
      const output = getOutput()
      expect(output).toContain("Invoice voided.")
    })
  })

  describe("subscriptions cancel", () => {
    beforeEach(() => {
      registerSubscriptionsCommands(program)
    })

    it("says cancelled at period end by default", async () => {
      await program.parseAsync([
        "node",
        "blaze",
        "subscriptions",
        "cancel",
        "sub_1",
      ])
      const output = getOutput()
      expect(output).toContain(
        "Subscription cancelled at the end of the current billing period"
      )
    })

    it("says cancelled immediately with --immediately flag", async () => {
      await program.parseAsync([
        "node",
        "blaze",
        "subscriptions",
        "cancel",
        "sub_1",
        "--immediately",
      ])
      const output = getOutput()
      expect(output).toContain("Subscription cancelled immediately")
    })
  })

  describe("subscriptions pause", () => {
    beforeEach(() => {
      registerSubscriptionsCommands(program)
    })

    it("outputs natural confirmation", async () => {
      await program.parseAsync([
        "node",
        "blaze",
        "subscriptions",
        "pause",
        "sub_1",
      ])
      const output = getOutput()
      expect(output).toContain("Subscription paused.")
    })
  })

  describe("subscriptions resume", () => {
    beforeEach(() => {
      registerSubscriptionsCommands(program)
    })

    it("outputs natural confirmation", async () => {
      await program.parseAsync([
        "node",
        "blaze",
        "subscriptions",
        "resume",
        "sub_1",
      ])
      const output = getOutput()
      expect(output).toContain("Subscription resumed.")
    })
  })

  describe("disputes submit-evidence", () => {
    beforeEach(() => {
      registerDisputesCommands(program)
    })

    it("outputs natural confirmation", async () => {
      await program.parseAsync([
        "node",
        "blaze",
        "disputes",
        "submit-evidence",
        "dis_1",
        "--description",
        "Customer received goods",
      ])
      const output = getOutput()
      expect(output).toContain("Evidence submitted for dispute.")
    })
  })

  describe("disputes close", () => {
    beforeEach(() => {
      registerDisputesCommands(program)
    })

    it("outputs natural confirmation", async () => {
      await program.parseAsync(["node", "blaze", "disputes", "close", "dis_1"])
      const output = getOutput()
      expect(output).toContain("Dispute closed.")
    })
  })
})
