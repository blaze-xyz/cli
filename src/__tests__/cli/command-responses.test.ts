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
  // `fail` prints + process.exit(1); the withdraw command uses it for guard
  // exits. Mirror the real behavior (console.error then exit) so the existing
  // exit-spy assertions keep working.
  fail: jest.fn((message: string) => {
    console.error(message)
    process.exit(1)
  }),
  requireBusinessContext: jest.fn().mockResolvedValue("biz_123"),
  withSpinner: jest.fn((_text: string, fn: () => Promise<unknown>) => fn()),
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
  // USD_RATES is consumed at module-load by withdrawal-format.ts to build the
  // supported-currency list, so the mock must provide it.
  USD_RATES: {
    MXN: 17.15,
    BRL: 5.05,
    EUR: 0.92,
    GBP: 0.79,
    COP: 4200,
    ARS: 900,
  },
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
    payContactCrypto: jest
      .fn()
      .mockResolvedValue({ id: "tr_crypto_1", status: "processing" }),
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
    // Consumer withdrawal limit/receipt surface — default to a passing
    // limit check and a fee-less transfer so the to-method happy path runs
    // clean unless a test overrides these.
    checkWithdrawalLimits: jest.fn().mockResolvedValue({
      meetsMinimum: true,
      isUnderLimit: true,
      minimumAmountCents: 500,
    }),
    // Live consumer exchange rate (1 local = N USD) used to suggest an accurate
    // local minimum on the below-minimum path. 0.0567 ≈ 1 MXN in USD.
    getExchangeRate: jest.fn().mockResolvedValue(0.0567),
    getRampTransfer: jest.fn().mockResolvedValue({
      id: "rt_1",
      status: "Pending",
      feeCollections: [],
    }),
    // Fee preview surface — default to a $2.00 fee so the to-method receipt and
    // confirm prompt have an accurate fee unless a test overrides it.
    getApplicableWithdrawalFee: jest.fn().mockResolvedValue({
      totalFeeCents: 200,
      displayName: "Card Withdrawal Fee",
      flatFeeCents: 0,
      percentageFeeCents: 0,
      percentageRate: 0.02,
      minFeeCents: 200,
      configId: "c",
    }),
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

  describe("contacts pay (crypto routing)", () => {
    // A Stablecoin contact with a single crypto address and no bank account.
    const stablecoinContact = {
      id: "con_crypto",
      type: "Stablecoin",
      first_name: "Ada",
      last_name: "Lovelace",
      business_name: null,
      bank_accounts: [],
      crypto_addresses: [
        {
          id: "addr_1",
          network: "Ethereum",
          address: "0xAbC1234567890dEf1234567890aBcDeF12345678",
        },
      ],
    }
    let payCrypto: jest.Mock
    let payBank: jest.Mock
    let exitSpy: jest.SpyInstance

    beforeEach(() => {
      registerContactsCommands(program)
      payCrypto = jest
        .fn()
        .mockResolvedValue({ id: "tr_crypto_1", status: "processing" })
      payBank = jest
        .fn()
        .mockResolvedValue({ id: "tr_123", status: "processing" })
      // process.exit would kill the test runner — make it throw so the test
      // can assert the early-exit path without terminating the process.
      exitSpy = jest.spyOn(process, "exit").mockImplementation((() => {
        throw new Error("process.exit called")
      }) as never)
    })

    afterEach(() => {
      exitSpy.mockRestore()
    })

    it("routes a Stablecoin contact to payContactCrypto and never calls payContact", async () => {
      mockGetClient.mockResolvedValue(
        createMockClient({
          listContacts: jest
            .fn()
            .mockResolvedValue({ data: [stablecoinContact] }),
          getBalance: jest
            .fn()
            .mockResolvedValue({ available: 100000, pending: 0 }),
          payContactCrypto: payCrypto,
          payContact: payBank,
        })
      )

      await program.parseAsync([
        "node",
        "blaze",
        "contacts",
        "pay",
        "Ada",
        "--amount",
        "25",
        "--yes",
      ])

      expect(payCrypto).toHaveBeenCalledWith("con_crypto", "addr_1", {
        usdcAmountInCents: 2500,
        amount: 25,
        note: undefined,
      })
      expect(payBank).not.toHaveBeenCalled()
      expect(getOutput()).toContain(
        "Your crypto send of 25 USDC to Ada Lovelace"
      )
      // Names the network in plain English and sets the ~30-min settlement expectation.
      expect(getOutput()).toContain("Ethereum")
      expect(getOutput()).toContain("30 minutes")
      expect(getOutput()).toContain("irreversible")
    })

    it("confirm-gates a crypto send with an irreversibility warning and cancels when declined", async () => {
      const { confirm } = jest.requireMock("@inquirer/prompts") as {
        confirm: jest.Mock
      }
      confirm.mockResolvedValueOnce(false)
      mockGetClient.mockResolvedValue(
        createMockClient({
          listContacts: jest
            .fn()
            .mockResolvedValue({ data: [stablecoinContact] }),
          getBalance: jest
            .fn()
            .mockResolvedValue({ available: 100000, pending: 0 }),
          payContactCrypto: payCrypto,
        })
      )

      // No --yes flag, so the confirmation prompt is reached.
      await program.parseAsync([
        "node",
        "blaze",
        "contacts",
        "pay",
        "Ada",
        "--amount",
        "25",
      ])

      expect(confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("irreversible"),
        })
      )
      expect(payCrypto).not.toHaveBeenCalled()
      expect(getOutput()).toContain("Cancelled.")
    })

    it("rejects a crypto send below the $1 USDC minimum before calling payContactCrypto", async () => {
      mockGetClient.mockResolvedValue(
        createMockClient({
          listContacts: jest
            .fn()
            .mockResolvedValue({ data: [stablecoinContact] }),
          payContactCrypto: payCrypto,
        })
      )

      await expect(
        program.parseAsync([
          "node",
          "blaze",
          "contacts",
          "pay",
          "Ada",
          "--amount",
          "0.5",
          "--yes",
        ])
      ).rejects.toThrow()

      expect(payCrypto).not.toHaveBeenCalled()
      expect(exitSpy).toHaveBeenCalledWith(1)
    })

    it("rejects a $5,000 crypto send ($3,000 or more) when beneficiary data is missing", async () => {
      mockGetClient.mockResolvedValue(
        createMockClient({
          listContacts: jest
            .fn()
            .mockResolvedValue({ data: [stablecoinContact] }),
          getBalance: jest
            .fn()
            .mockResolvedValue({ available: 10000000, pending: 0 }),
          payContactCrypto: payCrypto,
        })
      )

      await expect(
        program.parseAsync([
          "node",
          "blaze",
          "contacts",
          "pay",
          "Ada",
          "--amount",
          "5000",
          "--yes",
        ])
      ).rejects.toThrow()

      expect(payCrypto).not.toHaveBeenCalled()
      expect(exitSpy).toHaveBeenCalledWith(1)
    })

    it("rejects a crypto send of exactly $3,000 (at the threshold) when beneficiary data is missing", async () => {
      mockGetClient.mockResolvedValue(
        createMockClient({
          listContacts: jest
            .fn()
            .mockResolvedValue({ data: [stablecoinContact] }),
          getBalance: jest
            .fn()
            .mockResolvedValue({ available: 10000000, pending: 0 }),
          payContactCrypto: payCrypto,
        })
      )

      await expect(
        program.parseAsync([
          "node",
          "blaze",
          "contacts",
          "pay",
          "Ada",
          "--amount",
          "3000",
          "--yes",
        ])
      ).rejects.toThrow()

      expect(payCrypto).not.toHaveBeenCalled()
      expect(exitSpy).toHaveBeenCalledWith(1)
    })

    it("allows a crypto send just below $3,000 without beneficiary data", async () => {
      mockGetClient.mockResolvedValue(
        createMockClient({
          listContacts: jest
            .fn()
            .mockResolvedValue({ data: [stablecoinContact] }),
          getBalance: jest
            .fn()
            .mockResolvedValue({ available: 10000000, pending: 0 }),
          payContactCrypto: payCrypto,
        })
      )

      await program.parseAsync([
        "node",
        "blaze",
        "contacts",
        "pay",
        "Ada",
        "--amount",
        "2999",
        "--yes",
      ])

      expect(payCrypto).toHaveBeenCalledWith("con_crypto", "addr_1", {
        usdcAmountInCents: 299900,
        amount: 2999,
        note: undefined,
      })
    })

    it("allows a $5,000 crypto send ($3,000 or more) when the address has beneficiary data", async () => {
      const compliantContact = {
        ...stablecoinContact,
        crypto_addresses: [
          {
            ...stablecoinContact.crypto_addresses[0],
            wallet_type: "SelfCustodied",
            beneficiary_street_line1: "1 Engine Way",
            beneficiary_city: "London",
            beneficiary_postal_code: "EC1A",
            beneficiary_country_code: "GB",
          },
        ],
      }
      mockGetClient.mockResolvedValue(
        createMockClient({
          listContacts: jest
            .fn()
            .mockResolvedValue({ data: [compliantContact] }),
          getBalance: jest
            .fn()
            .mockResolvedValue({ available: 10000000, pending: 0 }),
          payContactCrypto: payCrypto,
        })
      )

      await program.parseAsync([
        "node",
        "blaze",
        "contacts",
        "pay",
        "Ada",
        "--amount",
        "5000",
        "--yes",
      ])

      expect(payCrypto).toHaveBeenCalledWith("con_crypto", "addr_1", {
        usdcAmountInCents: 500000,
        amount: 5000,
        note: undefined,
      })
    })

    it("rejects a $5,000 crypto send to a hosted wallet when the ownership attestation is missing", async () => {
      // A hosted/custodial address with full base beneficiary data but NO
      // ownership attestation — Bridge requires it, so the CLI must block.
      const hostedNoAttestation = {
        ...stablecoinContact,
        crypto_addresses: [
          {
            ...stablecoinContact.crypto_addresses[0],
            wallet_type: "Hosted",
            beneficiary_street_line1: "1 Engine Way",
            beneficiary_city: "London",
            beneficiary_postal_code: "EC1A",
            beneficiary_country_code: "GB",
            wallet_ownership_attested_at: null,
          },
        ],
      }
      mockGetClient.mockResolvedValue(
        createMockClient({
          listContacts: jest
            .fn()
            .mockResolvedValue({ data: [hostedNoAttestation] }),
          getBalance: jest
            .fn()
            .mockResolvedValue({ available: 10000000, pending: 0 }),
          payContactCrypto: payCrypto,
        })
      )

      await expect(
        program.parseAsync([
          "node",
          "blaze",
          "contacts",
          "pay",
          "Ada",
          "--amount",
          "5000",
          "--yes",
        ])
      ).rejects.toThrow()

      expect(payCrypto).not.toHaveBeenCalled()
      expect(exitSpy).toHaveBeenCalledWith(1)
    })

    it("allows a $5,000 crypto send to a hosted wallet when the ownership attestation is present", async () => {
      const hostedAttested = {
        ...stablecoinContact,
        crypto_addresses: [
          {
            ...stablecoinContact.crypto_addresses[0],
            wallet_type: "Hosted",
            beneficiary_street_line1: "1 Engine Way",
            beneficiary_city: "London",
            beneficiary_postal_code: "EC1A",
            beneficiary_country_code: "GB",
            wallet_ownership_attested_at: "2026-06-17T12:00:00.000Z",
          },
        ],
      }
      mockGetClient.mockResolvedValue(
        createMockClient({
          listContacts: jest.fn().mockResolvedValue({ data: [hostedAttested] }),
          getBalance: jest
            .fn()
            .mockResolvedValue({ available: 10000000, pending: 0 }),
          payContactCrypto: payCrypto,
        })
      )

      await program.parseAsync([
        "node",
        "blaze",
        "contacts",
        "pay",
        "Ada",
        "--amount",
        "5000",
        "--yes",
      ])

      expect(payCrypto).toHaveBeenCalledWith("con_crypto", "addr_1", {
        usdcAmountInCents: 500000,
        amount: 5000,
        note: undefined,
      })
    })
  })

  describe("contacts pay (bank-only error)", () => {
    let exitSpy: jest.SpyInstance

    beforeEach(() => {
      registerContactsCommands(program)
      exitSpy = jest.spyOn(process, "exit").mockImplementation((() => {
        throw new Error("process.exit called")
      }) as never)
    })

    afterEach(() => {
      exitSpy.mockRestore()
    })

    it("throws the no-bank-accounts error only for a genuine Bank contact", async () => {
      const bankContactNoAccounts = {
        id: "con_bank",
        type: "Bank",
        first_name: "Bob",
        last_name: "Bank",
        business_name: null,
        bank_accounts: [],
        crypto_addresses: [],
      }
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {})
      mockGetClient.mockResolvedValue(
        createMockClient({
          listContacts: jest
            .fn()
            .mockResolvedValue({ data: [bankContactNoAccounts] }),
        })
      )

      await expect(
        program.parseAsync([
          "node",
          "blaze",
          "contacts",
          "pay",
          "Bob",
          "--amount",
          "100",
          "--yes",
        ])
      ).rejects.toThrow("has no bank accounts")

      errorSpy.mockRestore()
    })
  })

  describe("contacts add", () => {
    let exitSpy: jest.SpyInstance

    beforeEach(() => {
      registerContactsCommands(program)
      exitSpy = jest.spyOn(process, "exit").mockImplementation((() => {
        throw new Error("process.exit called")
      }) as never)
    })

    afterEach(() => {
      exitSpy.mockRestore()
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

    it("maps a validated --network value to the PascalCase enum on the crypto address", async () => {
      const createContact = jest.fn().mockResolvedValue({ id: "con_456" })
      mockGetClient.mockResolvedValue(createMockClient({ createContact }))

      await program.parseAsync([
        "node",
        "blaze",
        "contacts",
        "add",
        "--first-name",
        "Ada",
        "--last-name",
        "Lovelace",
        "--phone",
        "+12025551234",
        "--type",
        "crypto",
        "--wallet-address",
        "0xAbC1234567890dEf1234567890aBcDeF12345678",
        "--network",
        "polygon",
      ])

      expect(createContact).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "Stablecoin",
          cryptoAddressData: expect.objectContaining({
            address: "0xAbC1234567890dEf1234567890aBcDeF12345678",
            network: "Polygon",
          }),
        })
      )
    })

    it("includes the --memo value on the crypto address payload for a Stellar contact", async () => {
      const createContact = jest.fn().mockResolvedValue({ id: "con_456" })
      mockGetClient.mockResolvedValue(createMockClient({ createContact }))

      await program.parseAsync([
        "node",
        "blaze",
        "contacts",
        "add",
        "--first-name",
        "Ada",
        "--last-name",
        "Lovelace",
        "--phone",
        "+12025551234",
        "--type",
        "crypto",
        "--wallet-address",
        "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
        "--network",
        "stellar",
        "--memo",
        "exchange-memo-42",
      ])

      expect(createContact).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "Stablecoin",
          cryptoAddressData: expect.objectContaining({
            address: "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
            network: "Stellar",
            memo: "exchange-memo-42",
          }),
        })
      )
    })

    it("omits memo from the crypto address payload when --memo is not provided", async () => {
      const createContact = jest.fn().mockResolvedValue({ id: "con_456" })
      mockGetClient.mockResolvedValue(createMockClient({ createContact }))

      await program.parseAsync([
        "node",
        "blaze",
        "contacts",
        "add",
        "--first-name",
        "Ada",
        "--last-name",
        "Lovelace",
        "--phone",
        "+12025551234",
        "--type",
        "crypto",
        "--wallet-address",
        "0xAbC1234567890dEf1234567890aBcDeF12345678",
        "--network",
        "polygon",
      ])

      const payload = createContact.mock.calls[0][0] as {
        cryptoAddressData: Record<string, unknown>
      }
      expect(payload.cryptoAddressData).not.toHaveProperty("memo")
    })

    it("stamps walletOwnershipAttestedAt with the current ISO timestamp when --attest-ownership is set on a hosted wallet", async () => {
      const createContact = jest.fn().mockResolvedValue({ id: "con_456" })
      mockGetClient.mockResolvedValue(createMockClient({ createContact }))

      const before = Date.now()
      await program.parseAsync([
        "node",
        "blaze",
        "contacts",
        "add",
        "--first-name",
        "Ada",
        "--last-name",
        "Lovelace",
        "--phone",
        "+12025551234",
        "--type",
        "crypto",
        "--wallet-address",
        "0xAbC1234567890dEf1234567890aBcDeF12345678",
        "--network",
        "ethereum",
        "--wallet-type",
        "hosted",
        "--attest-ownership",
      ])
      const after = Date.now()

      const payload = createContact.mock.calls[0][0] as {
        cryptoAddressData: {
          walletType: string
          walletOwnershipAttestedAt: string
        }
      }
      expect(payload.cryptoAddressData.walletType).toBe("Hosted")
      const attestedMs = new Date(
        payload.cryptoAddressData.walletOwnershipAttestedAt
      ).getTime()
      expect(attestedMs).toBeGreaterThanOrEqual(before)
      expect(attestedMs).toBeLessThanOrEqual(after)
    })

    it("uses the explicit --wallet-attested-at value over --attest-ownership's now", async () => {
      const createContact = jest.fn().mockResolvedValue({ id: "con_456" })
      mockGetClient.mockResolvedValue(createMockClient({ createContact }))

      await program.parseAsync([
        "node",
        "blaze",
        "contacts",
        "add",
        "--first-name",
        "Ada",
        "--last-name",
        "Lovelace",
        "--phone",
        "+12025551234",
        "--type",
        "crypto",
        "--wallet-address",
        "0xAbC1234567890dEf1234567890aBcDeF12345678",
        "--network",
        "ethereum",
        "--wallet-type",
        "hosted",
        "--attest-ownership",
        "--wallet-attested-at",
        "2026-06-17T00:00:00Z",
      ])

      expect(createContact).toHaveBeenCalledWith(
        expect.objectContaining({
          cryptoAddressData: expect.objectContaining({
            walletType: "Hosted",
            walletOwnershipAttestedAt: "2026-06-17T00:00:00.000Z",
          }),
        })
      )
    })

    it("rejects an invalid --wallet-attested-at value without calling createContact", async () => {
      const createContact = jest.fn().mockResolvedValue({ id: "con_456" })
      mockGetClient.mockResolvedValue(createMockClient({ createContact }))

      await expect(
        program.parseAsync([
          "node",
          "blaze",
          "contacts",
          "add",
          "--first-name",
          "Ada",
          "--last-name",
          "Lovelace",
          "--phone",
          "+12025551234",
          "--type",
          "crypto",
          "--wallet-address",
          "0xAbC1234567890dEf1234567890aBcDeF12345678",
          "--network",
          "ethereum",
          "--wallet-type",
          "hosted",
          "--wallet-attested-at",
          "not-a-date",
        ])
      ).rejects.toThrow()

      expect(createContact).not.toHaveBeenCalled()
      expect(exitSpy).toHaveBeenCalledWith(1)
    })

    it("rejects a Stellar crypto contact without --memo before calling createContact", async () => {
      const createContact = jest.fn().mockResolvedValue({ id: "con_456" })
      mockGetClient.mockResolvedValue(createMockClient({ createContact }))

      await expect(
        program.parseAsync([
          "node",
          "blaze",
          "contacts",
          "add",
          "--first-name",
          "Ada",
          "--last-name",
          "Lovelace",
          "--phone",
          "+12025551234",
          "--type",
          "crypto",
          "--wallet-address",
          "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
          "--network",
          "stellar",
        ])
      ).rejects.toThrow()

      expect(createContact).not.toHaveBeenCalled()
      expect(exitSpy).toHaveBeenCalledWith(1)
    })

    it("rejects a Stellar crypto contact when --network is omitted (defaults to stellar) and --memo is missing", async () => {
      const createContact = jest.fn().mockResolvedValue({ id: "con_456" })
      mockGetClient.mockResolvedValue(createMockClient({ createContact }))

      await expect(
        program.parseAsync([
          "node",
          "blaze",
          "contacts",
          "add",
          "--first-name",
          "Ada",
          "--last-name",
          "Lovelace",
          "--phone",
          "+12025551234",
          "--type",
          "crypto",
          "--wallet-address",
          "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
        ])
      ).rejects.toThrow()

      expect(createContact).not.toHaveBeenCalled()
      expect(exitSpy).toHaveBeenCalledWith(1)
    })

    it("allows a Stellar crypto contact when --memo is provided", async () => {
      const createContact = jest.fn().mockResolvedValue({ id: "con_456" })
      mockGetClient.mockResolvedValue(createMockClient({ createContact }))

      await program.parseAsync([
        "node",
        "blaze",
        "contacts",
        "add",
        "--first-name",
        "Ada",
        "--last-name",
        "Lovelace",
        "--phone",
        "+12025551234",
        "--type",
        "crypto",
        "--wallet-address",
        "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
        "--network",
        "stellar",
        "--memo",
        "exchange-memo-42",
      ])

      expect(createContact).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "Stablecoin",
          cryptoAddressData: expect.objectContaining({
            network: "Stellar",
            memo: "exchange-memo-42",
          }),
        })
      )
      expect(exitSpy).not.toHaveBeenCalled()
    })

    it("rejects an unknown --network value without silently defaulting to Stellar", async () => {
      const createContact = jest.fn().mockResolvedValue({ id: "con_456" })
      mockGetClient.mockResolvedValue(createMockClient({ createContact }))

      await expect(
        program.parseAsync([
          "node",
          "blaze",
          "contacts",
          "add",
          "--first-name",
          "Ada",
          "--last-name",
          "Lovelace",
          "--phone",
          "+12025551234",
          "--type",
          "crypto",
          "--wallet-address",
          "0xAbC1234567890dEf1234567890aBcDeF12345678",
          "--network",
          "dogecoin",
        ])
      ).rejects.toThrow()

      expect(createContact).not.toHaveBeenCalled()
      expect(exitSpy).toHaveBeenCalledWith(1)
    })
  })

  describe("contacts list", () => {
    beforeEach(() => {
      registerContactsCommands(program)
    })

    it("renders a crypto address with network and shortened address in the account column", async () => {
      mockGetClient.mockResolvedValue(
        createMockClient({
          listContacts: jest.fn().mockResolvedValue({
            data: [
              {
                id: "con_crypto",
                type: "Stablecoin",
                first_name: "Ada",
                last_name: "Lovelace",
                business_name: null,
                email: null,
                is_favorite: false,
                created_at: "2026-01-15T10:00:00Z",
                bank_accounts: [],
                crypto_addresses: [
                  {
                    id: "addr_1",
                    network: "Ethereum",
                    address: "0xAbC1234567890dEf1234567890aBcDeF12345678",
                  },
                ],
              },
            ],
          }),
        })
      )

      await program.parseAsync(["node", "blaze", "contacts", "list"])

      const formatted = mockFormatOutput.mock.calls[0][0] as Array<{
        account: string
      }>
      expect(formatted[0].account).toBe("Ethereum (0xAbC1…5678)")
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

  describe("withdrawals methods (consumer)", () => {
    beforeEach(() => {
      registerWithdrawalsCommands(program)
    })

    it("shows only withdrawal-eligible methods by default", async () => {
      mockGetClient.mockResolvedValue(
        createMockClient({
          authContext: "consumer",
          listConnectedPaymentMethods: jest.fn().mockResolvedValue({
            methods: [
              {
                id: "pm_1",
                type: "Bank",
                displayName: "Chase",
                canWithdraw: true,
              },
              {
                id: "pm_2",
                type: "Card",
                displayName: "Old Card",
                canWithdraw: false,
              },
            ],
            defaultWithdrawalMethodId: "pm_1",
          }),
        })
      )

      await program.parseAsync(["node", "blaze", "withdrawals", "methods"])

      const rows = mockFormatOutput.mock.calls[0][0] as { id: string }[]
      expect(rows).toHaveLength(1)
      expect(rows[0].id).toBe("pm_1")
    })

    it("blocks listing in business context with a personal-login error", async () => {
      const exitSpy = jest.spyOn(process, "exit").mockImplementation((() => {
        throw new Error("process.exit called")
      }) as never)
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {})
      mockGetClient.mockResolvedValue(
        createMockClient({ authContext: "business" })
      )

      await expect(
        program.parseAsync(["node", "blaze", "withdrawals", "methods"])
      ).rejects.toThrow("process.exit called")

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("requires a personal login")
      )
      exitSpy.mockRestore()
      errorSpy.mockRestore()
    })
  })

  describe("withdrawals to-method (consumer)", () => {
    beforeEach(() => {
      registerWithdrawalsCommands(program)
    })

    it("submits the withdrawal to the only eligible method and prints a friendly receipt with the real fee", async () => {
      const withdrawToPaymentMethod = jest
        .fn()
        .mockResolvedValue({ status: "PENDING", rampTransferId: "rt_1" })
      mockGetClient.mockResolvedValue(
        createMockClient({
          authContext: "consumer",
          getBalance: jest
            .fn()
            .mockResolvedValue({ available: 100000, pending: 0 }),
          checkWithdrawalLimits: jest.fn().mockResolvedValue({
            meetsMinimum: true,
            isUnderLimit: true,
            minimumAmountCents: 500,
          }),
          listConnectedPaymentMethods: jest.fn().mockResolvedValue({
            methods: [
              {
                id: "pm_1",
                type: "Bank",
                displayName: "Chase",
                canWithdraw: true,
              },
            ],
            defaultWithdrawalMethodId: "pm_1",
            countryCode: "US",
          }),
          getRampTransfer: jest.fn().mockResolvedValue({
            id: "rt_1",
            status: "Pending",
            usdcAmount: { value: 2500, currency: { code: "USD" } },
            feeCollections: [{ amountCents: 200 }],
          }),
          withdrawToPaymentMethod,
        })
      )

      await program.parseAsync([
        "node",
        "blaze",
        "withdrawals",
        "to-method",
        "--amount",
        "25",
        "--yes",
      ])

      expect(withdrawToPaymentMethod).toHaveBeenCalledWith({
        paymentMethodId: "pm_1",
        usdcAmountInCents: 2500,
        fiatAmountInCents: 2500,
        currencyCode: "USD",
        instantTransfer: false,
      })
      const output = getOutput()
      expect(output).toContain(
        "✓ Done — your withdrawal of 25.00 USD to Chase is on its way."
      )
      expect(output).toContain(
        "We took a $2.00 fee, so $27.00 USDC left your balance."
      )
      expect(output).toContain("It usually arrives in 1–2 business days.")
      expect(output).toContain(
        "Track it anytime with: blaze withdrawals status rt_1"
      )
    })

    it("blocks a withdrawal the fee pushes over balance and notes the fee in the message", async () => {
      const exitSpy = jest.spyOn(process, "exit").mockImplementation((() => {
        throw new Error("process.exit called")
      }) as never)
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {})
      const withdrawToPaymentMethod = jest.fn()
      mockGetClient.mockResolvedValue(
        createMockClient({
          authContext: "consumer",
          // Exactly enough for the amount, but NOT for amount + $2.00 fee.
          getBalance: jest
            .fn()
            .mockResolvedValue({ available: 2500, pending: 0 }),
          checkWithdrawalLimits: jest.fn().mockResolvedValue({
            meetsMinimum: true,
            isUnderLimit: true,
            minimumAmountCents: 500,
          }),
          listConnectedPaymentMethods: jest.fn().mockResolvedValue({
            methods: [
              {
                id: "pm_1",
                type: "Bank",
                displayName: "Chase",
                canWithdraw: true,
              },
            ],
            defaultWithdrawalMethodId: "pm_1",
            countryCode: "US",
          }),
          withdrawToPaymentMethod,
        })
      )

      await expect(
        program.parseAsync([
          "node",
          "blaze",
          "withdrawals",
          "to-method",
          "--amount",
          "25",
          "--yes",
        ])
      ).rejects.toThrow("process.exit called")

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("(including a $2.00 fee)")
      )
      expect(withdrawToPaymentMethod).not.toHaveBeenCalled()
      exitSpy.mockRestore()
      errorSpy.mockRestore()
    })

    it("rejects a below-minimum withdrawal with the server minimum and never submits", async () => {
      const exitSpy = jest.spyOn(process, "exit").mockImplementation((() => {
        throw new Error("process.exit called")
      }) as never)
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {})
      const withdrawToPaymentMethod = jest.fn()
      mockGetClient.mockResolvedValue(
        createMockClient({
          authContext: "consumer",
          getBalance: jest
            .fn()
            .mockResolvedValue({ available: 100000, pending: 0 }),
          checkWithdrawalLimits: jest.fn().mockResolvedValue({
            meetsMinimum: false,
            isUnderLimit: true,
            minimumAmountCents: 500,
          }),
          listConnectedPaymentMethods: jest.fn().mockResolvedValue({
            methods: [
              {
                id: "pm_1",
                type: "Bank",
                displayName: "Chase",
                canWithdraw: true,
              },
            ],
            defaultWithdrawalMethodId: "pm_1",
          }),
          withdrawToPaymentMethod,
        })
      )

      await expect(
        program.parseAsync([
          "node",
          "blaze",
          "withdrawals",
          "to-method",
          "--amount",
          "1",
          "--yes",
        ])
      ).rejects.toThrow("process.exit called")

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Withdrawals must be at least $5.00 USD")
      )
      expect(withdrawToPaymentMethod).not.toHaveBeenCalled()
      exitSpy.mockRestore()
      errorSpy.mockRestore()
    })

    it("suggests a live-rate local minimum for a below-minimum non-USD withdrawal", async () => {
      const exitSpy = jest.spyOn(process, "exit").mockImplementation((() => {
        throw new Error("process.exit called")
      }) as never)
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {})
      const withdrawToPaymentMethod = jest.fn()
      mockGetClient.mockResolvedValue(
        createMockClient({
          authContext: "consumer",
          getBalance: jest
            .fn()
            .mockResolvedValue({ available: 100000, pending: 0 }),
          checkWithdrawalLimits: jest.fn().mockResolvedValue({
            meetsMinimum: false,
            isUnderLimit: true,
            minimumAmountCents: 500,
          }),
          // 1 MXN ≈ 0.0567 USD live → ceil(5 / 0.0567) + 1 = 90 MXN.
          getExchangeRate: jest.fn().mockResolvedValue(0.0567),
          listConnectedPaymentMethods: jest.fn().mockResolvedValue({
            methods: [
              {
                id: "pm_1",
                type: "Bank",
                displayName: "Banamex",
                canWithdraw: true,
              },
            ],
            defaultWithdrawalMethodId: "pm_1",
          }),
          withdrawToPaymentMethod,
        })
      )

      await expect(
        program.parseAsync([
          "node",
          "blaze",
          "withdrawals",
          "to-method",
          "--amount",
          "50",
          "--currency",
          "MXN",
          "--yes",
        ])
      ).rejects.toThrow("process.exit called")

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "Withdrawals must be at least $5.00 USD (about 90 MXN)"
        )
      )
      expect(withdrawToPaymentMethod).not.toHaveBeenCalled()
      exitSpy.mockRestore()
      errorSpy.mockRestore()
    })

    it("blocks on insufficient balance and never submits", async () => {
      const exitSpy = jest.spyOn(process, "exit").mockImplementation((() => {
        throw new Error("process.exit called")
      }) as never)
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {})
      const withdrawToPaymentMethod = jest.fn()
      mockGetClient.mockResolvedValue(
        createMockClient({
          authContext: "consumer",
          getBalance: jest
            .fn()
            .mockResolvedValue({ available: 100, pending: 0 }),
          listConnectedPaymentMethods: jest.fn().mockResolvedValue({
            methods: [
              {
                id: "pm_1",
                type: "Bank",
                displayName: "Chase",
                canWithdraw: true,
              },
            ],
            defaultWithdrawalMethodId: "pm_1",
          }),
          withdrawToPaymentMethod,
        })
      )

      await expect(
        program.parseAsync([
          "node",
          "blaze",
          "withdrawals",
          "to-method",
          "--amount",
          "25",
          "--yes",
        ])
      ).rejects.toThrow("process.exit called")

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "You don't have enough balance for this withdrawal"
        )
      )
      expect(withdrawToPaymentMethod).not.toHaveBeenCalled()
      exitSpy.mockRestore()
      errorSpy.mockRestore()
    })

    it("cancels without submitting when the user declines confirmation", async () => {
      const { confirm } = jest.requireMock("@inquirer/prompts") as {
        confirm: jest.Mock
      }
      confirm.mockResolvedValueOnce(false)
      const withdrawToPaymentMethod = jest.fn()
      mockGetClient.mockResolvedValue(
        createMockClient({
          authContext: "consumer",
          getBalance: jest
            .fn()
            .mockResolvedValue({ available: 100000, pending: 0 }),
          listConnectedPaymentMethods: jest.fn().mockResolvedValue({
            methods: [
              {
                id: "pm_1",
                type: "Bank",
                displayName: "Chase",
                canWithdraw: true,
              },
            ],
            defaultWithdrawalMethodId: "pm_1",
          }),
          withdrawToPaymentMethod,
        })
      )

      await program.parseAsync([
        "node",
        "blaze",
        "withdrawals",
        "to-method",
        "--amount",
        "25",
      ])

      expect(getOutput()).toContain("Cancelled.")
      expect(withdrawToPaymentMethod).not.toHaveBeenCalled()
    })

    it("blocks withdrawing in business context with a personal-login error", async () => {
      const exitSpy = jest.spyOn(process, "exit").mockImplementation((() => {
        throw new Error("process.exit called")
      }) as never)
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {})
      const withdrawToPaymentMethod = jest.fn()
      mockGetClient.mockResolvedValue(
        createMockClient({ authContext: "business", withdrawToPaymentMethod })
      )

      await expect(
        program.parseAsync([
          "node",
          "blaze",
          "withdrawals",
          "to-method",
          "--amount",
          "25",
          "--yes",
        ])
      ).rejects.toThrow("process.exit called")

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("requires a personal login")
      )
      expect(withdrawToPaymentMethod).not.toHaveBeenCalled()
      exitSpy.mockRestore()
      errorSpy.mockRestore()
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
