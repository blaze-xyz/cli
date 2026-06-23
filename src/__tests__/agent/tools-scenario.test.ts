import type { BlazeClient } from "../../sdk/client"
import type { MemoryStore } from "../../agent/memory"
import { buildTools, executeTool } from "../../agent/tools"

describe("agent tool registry — blaze_cfo_scenario", () => {
  let mockClient: { modelScenario: jest.Mock }
  let memory: MemoryStore

  beforeEach(() => {
    mockClient = {
      modelScenario: jest.fn().mockResolvedValue({ runwayMonths: 6 }),
    }
    memory = {} as MemoryStore
  })

  it("register a tool named blaze_cfo_scenario with name, adjustments, and horizon_days inputs", () => {
    // Arrange
    const client = mockClient as unknown as BlazeClient

    // Act
    const tools = buildTools(client, memory)

    // Assert
    const scenarioTool = tools.find(t => t.name === "blaze_cfo_scenario")
    expect(scenarioTool).toBeDefined()
    expect(scenarioTool?.input_schema.properties).toHaveProperty("name")
    expect(scenarioTool?.input_schema.properties).toHaveProperty("adjustments")
    expect(scenarioTool?.input_schema.properties).toHaveProperty("horizon_days")
  })

  it("delegate execution to client.modelScenario defaulting adjustments to [] and horizon_days to 90", async () => {
    // Arrange
    const client = mockClient as unknown as BlazeClient

    // Act
    await executeTool(
      "blaze_cfo_scenario",
      { name: "Hire 2 engineers" },
      client,
      memory
    )

    // Assert
    expect(mockClient.modelScenario).toHaveBeenCalledWith({
      name: "Hire 2 engineers",
      adjustments: [],
      horizon_days: 90,
    })
  })

  it("delegate execution passing through adjustments and an explicit horizon_days", async () => {
    // Arrange
    const client = mockClient as unknown as BlazeClient
    const adjustments = [
      {
        type: "new_recurring_expense",
        amount_cents: 2400000,
        frequency: "monthly",
      },
    ]

    // Act
    await executeTool(
      "blaze_cfo_scenario",
      { name: "Hire 2 engineers", adjustments, horizon_days: 60 },
      client,
      memory
    )

    // Assert
    expect(mockClient.modelScenario).toHaveBeenCalledWith({
      name: "Hire 2 engineers",
      adjustments,
      horizon_days: 60,
    })
  })
})

describe("agent tool registry — blaze_add_contact (nested REST payload)", () => {
  let mockClient: { createContact: jest.Mock }
  let memory: MemoryStore

  beforeEach(() => {
    mockClient = {
      createContact: jest.fn().mockResolvedValue({ id: "con_456" }),
    }
    memory = {} as MemoryStore
  })

  it("exposes a memo input on blaze_add_contact alongside wallet_address and network", () => {
    // Arrange
    const client = mockClient as unknown as BlazeClient

    // Act
    const tools = buildTools(client, memory)

    // Assert
    const addContactTool = tools.find(t => t.name === "blaze_add_contact")
    expect(addContactTool).toBeDefined()
    expect(addContactTool?.input_schema.properties).toHaveProperty(
      "wallet_address"
    )
    expect(addContactTool?.input_schema.properties).toHaveProperty("network")
    expect(addContactTool?.input_schema.properties).toHaveProperty("memo")
    const memoProp = (
      addContactTool?.input_schema.properties as Record<
        string,
        { description?: string }
      >
    ).memo
    // The description must steer the model to require a memo for Stellar.
    expect(memoProp.description?.toLowerCase()).toContain("stellar")
  })

  it("exposes phone as a required input on blaze_add_contact", () => {
    // Arrange
    const client = mockClient as unknown as BlazeClient

    // Act
    const tools = buildTools(client, memory)

    // Assert
    const addContactTool = tools.find(t => t.name === "blaze_add_contact")
    expect(addContactTool?.input_schema.properties).toHaveProperty("phone")
    expect(addContactTool?.input_schema.required).toContain("phone")
  })

  it("calls client.createContact with nested Stablecoin payload for a Stellar crypto contact with memo", async () => {
    // Arrange
    const client = mockClient as unknown as BlazeClient

    // Act
    await executeTool(
      "blaze_add_contact",
      {
        name: "Ada Lovelace",
        phone: "+14155550123",
        type: "crypto",
        wallet_address: "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
        network: "stellar",
        memo: "exchange-memo-42",
      },
      client,
      memory
    )

    // Assert
    expect(mockClient.createContact).toHaveBeenCalledWith({
      type: "Stablecoin",
      category: "Personal",
      firstName: "Ada",
      lastName: "Lovelace",
      phoneNumber: "+14155550123",
      cryptoAddressData: {
        address: "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
        network: "Stellar",
        memo: "exchange-memo-42",
      },
    })
  })

  it("throws and never calls client.createContact for a Stellar crypto contact without a memo", async () => {
    // Arrange
    const client = mockClient as unknown as BlazeClient

    // Act & Assert
    await expect(
      executeTool(
        "blaze_add_contact",
        {
          name: "Ada Lovelace",
          phone: "+14155550123",
          type: "crypto",
          wallet_address: "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
          network: "stellar",
        },
        client,
        memory
      )
    ).rejects.toThrow(/memo/i)
    expect(mockClient.createContact).not.toHaveBeenCalled()
  })

  it("calls client.createContact mapping network to Ethereum for an EVM crypto contact without a memo", async () => {
    // Arrange
    const client = mockClient as unknown as BlazeClient

    // Act
    await executeTool(
      "blaze_add_contact",
      {
        name: "Grace Hopper",
        phone: "+14155550199",
        type: "crypto",
        wallet_address: "0xabc0000000000000000000000000000000000000",
        network: "ethereum",
      },
      client,
      memory
    )

    // Assert
    expect(mockClient.createContact).toHaveBeenCalledWith({
      type: "Stablecoin",
      category: "Personal",
      firstName: "Grace",
      lastName: "Hopper",
      phoneNumber: "+14155550199",
      cryptoAddressData: {
        address: "0xabc0000000000000000000000000000000000000",
        network: "Ethereum",
      },
    })
  })

  it("calls client.createContact with nested US bankAccountData for a bank contact", async () => {
    // Arrange
    const client = mockClient as unknown as BlazeClient

    // Act
    await executeTool(
      "blaze_add_contact",
      {
        name: "Alan Turing",
        phone: "+14155550150",
        type: "bank",
        account_number: "000123456789",
        routing_number: "021000021",
      },
      client,
      memory
    )

    // Assert
    expect(mockClient.createContact).toHaveBeenCalledWith({
      type: "Bank",
      category: "Personal",
      firstName: "Alan",
      lastName: "Turing",
      phoneNumber: "+14155550150",
      bankAccountData: {
        countryId: "US",
        accountNumber: "000123456789",
        routingNumber: "021000021",
      },
    })
  })

  it("calls client.createContact with nested MX bankAccountData for a clabe contact", async () => {
    // Arrange
    const client = mockClient as unknown as BlazeClient

    // Act
    await executeTool(
      "blaze_add_contact",
      {
        name: "Carlos Slim",
        phone: "+525555550100",
        type: "clabe",
        clabe: "032180000118359719",
      },
      client,
      memory
    )

    // Assert
    expect(mockClient.createContact).toHaveBeenCalledWith({
      type: "Bank",
      category: "Personal",
      firstName: "Carlos",
      lastName: "Slim",
      phoneNumber: "+525555550100",
      bankAccountData: {
        countryId: "MX",
        accountNumber: "032180000118359719",
      },
    })
  })

  it("throws and never calls client.createContact for a blaze-tag contact (unsupported)", async () => {
    // Arrange
    const client = mockClient as unknown as BlazeClient

    // Act & Assert
    await expect(
      executeTool(
        "blaze_add_contact",
        {
          name: "John Doe",
          phone: "+14155550111",
          type: "blaze",
          blazetag: "@john",
        },
        client,
        memory
      )
    ).rejects.toThrow(/supported via the agent yet/i)
    expect(mockClient.createContact).not.toHaveBeenCalled()
  })

  it("throws and never calls client.createContact when phone is missing", async () => {
    // Arrange
    const client = mockClient as unknown as BlazeClient

    // Act & Assert
    await expect(
      executeTool(
        "blaze_add_contact",
        {
          name: "Ada Lovelace",
          type: "bank",
          account_number: "000123456789",
        },
        client,
        memory
      )
    ).rejects.toThrow(/phone number is required/i)
    expect(mockClient.createContact).not.toHaveBeenCalled()
  })

  it("throws and never calls client.createContact when the name has no last name", async () => {
    // Arrange
    const client = mockClient as unknown as BlazeClient

    // Act & Assert
    await expect(
      executeTool(
        "blaze_add_contact",
        {
          name: "Madonna",
          phone: "+14155550123",
          type: "bank",
          account_number: "000123456789",
        },
        client,
        memory
      )
    ).rejects.toThrow(/first and last name/i)
    expect(mockClient.createContact).not.toHaveBeenCalled()
  })
})
