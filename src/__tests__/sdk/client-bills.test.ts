import { BlazeClient } from "../../sdk/client"

/**
 * Mocks `global.fetch` for the GraphQL bills surface.
 * The bills SDK methods all funnel through `graphqlRequest`, which POSTs to
 * `${baseUrl}/graphql` and expects `{ data }` or `{ errors }`.
 */
function mockGraphql(
  status: number,
  payload: unknown,
  statusText = "OK"
): jest.Mock {
  const fn = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: () => Promise.resolve(payload),
  })
  global.fetch = fn
  return fn
}

const client = new BlazeClient({ apiKey: "sk_test_bills" })
const bearerClient = new BlazeClient({ bearerToken: "jwt_token_abc" })

afterEach(() => {
  jest.restoreAllMocks()
})

describe("BlazeClient graphqlRequest", () => {
  it("posts to the /graphql endpoint with the query and variables", async () => {
    // Arrange
    const fetchMock = mockGraphql(200, { data: { ping: "pong" } })

    // Act
    await client.graphqlRequest("query { ping }", { a: 1 })

    // Assert
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.blaze.money/graphql",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ query: "query { ping }", variables: { a: 1 } }),
      })
    )
  })

  it("sends X-API-Key header when constructed with an api key", async () => {
    // Arrange
    const fetchMock = mockGraphql(200, { data: {} })

    // Act
    await client.graphqlRequest("query { ping }")

    // Assert
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ "X-API-Key": "sk_test_bills" }),
      })
    )
  })

  it("sends Authorization bearer header when constructed with a bearer token", async () => {
    // Arrange
    const fetchMock = mockGraphql(200, { data: {} })

    // Act
    await bearerClient.graphqlRequest("query { ping }")

    // Assert
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer jwt_token_abc",
        }),
      })
    )
  })

  it("returns the data field on a successful response", async () => {
    // Arrange
    mockGraphql(200, { data: { value: 42 } })

    // Act
    const result = await client.graphqlRequest<{ value: number }>("query {}")

    // Assert
    expect(result).toEqual({ value: 42 })
  })

  it("throws with the HTTP status when the response is not ok", async () => {
    // Arrange
    mockGraphql(502, {}, "Bad Gateway")

    // Act / Assert
    await expect(client.graphqlRequest("query {}")).rejects.toThrow(
      "GraphQL HTTP 502: Bad Gateway"
    )
  })

  it("throws the first GraphQL error message when errors are present", async () => {
    // Arrange
    mockGraphql(200, {
      errors: [{ message: "Field 'foo' not found" }, { message: "second" }],
    })

    // Act / Assert
    await expect(client.graphqlRequest("query {}")).rejects.toThrow(
      "Field 'foo' not found"
    )
  })

  it("throws when the response has no data and no errors", async () => {
    // Arrange
    mockGraphql(200, {})

    // Act / Assert
    await expect(client.graphqlRequest("query {}")).rejects.toThrow(
      "GraphQL response missing data"
    )
  })
})

describe("BlazeClient.listBills", () => {
  it("sends the businessBills query with the provided filter params", async () => {
    // Arrange
    const fetchMock = mockGraphql(200, {
      data: { businessBills: { nodes: [], pageInfo: { hasNextPage: false } } },
    })
    const params = { status: "READY_TO_PAY", limit: 10 }

    // Act
    await client.listBills(params)

    // Assert
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as { body: string }).body
    )
    expect(body.variables).toEqual(params)
    expect(body.query).toContain("businessBills(")
  })

  it("returns the unwrapped businessBills connection", async () => {
    // Arrange
    const connection = {
      nodes: [{ id: "bill_1", status: "PAID" }],
      pageInfo: { hasNextPage: false, endCursor: null, totalCount: 1 },
    }
    mockGraphql(200, { data: { businessBills: connection } })

    // Act
    const result = await client.listBills()

    // Assert
    expect(result).toEqual(connection)
  })

  it("defaults to empty params when called with no arguments", async () => {
    // Arrange
    const fetchMock = mockGraphql(200, {
      data: { businessBills: { nodes: [] } },
    })

    // Act
    await client.listBills()

    // Assert
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as { body: string }).body
    )
    expect(body.variables).toEqual({})
  })

  it("surfaces a GraphQL error from the server", async () => {
    // Arrange
    mockGraphql(200, { errors: [{ message: "No active business" }] })

    // Act / Assert
    await expect(client.listBills()).rejects.toThrow("No active business")
  })
})

describe("BlazeClient.getBill", () => {
  it("sends the businessBill query with the bill id variable", async () => {
    // Arrange
    const fetchMock = mockGraphql(200, {
      data: { businessBill: { id: "bill_42" } },
    })

    // Act
    await client.getBill("bill_42")

    // Assert
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as { body: string }).body
    )
    expect(body.variables).toEqual({ id: "bill_42" })
    expect(body.query).toContain("businessBill(id: $id)")
  })

  it("returns the unwrapped businessBill object", async () => {
    // Arrange
    const bill = { id: "bill_42", status: "NEEDS_REVIEW", currencyCode: "USD" }
    mockGraphql(200, { data: { businessBill: bill } })

    // Act
    const result = await client.getBill("bill_42")

    // Assert
    expect(result).toEqual(bill)
  })

  it("throws when the bill is not found via GraphQL errors", async () => {
    // Arrange
    mockGraphql(200, { errors: [{ message: "Bill not found" }] })

    // Act / Assert
    await expect(client.getBill("missing")).rejects.toThrow("Bill not found")
  })
})

describe("BlazeClient.createManualBill", () => {
  it("sends the createManualBusinessBill mutation with the input wrapped", async () => {
    // Arrange
    const fetchMock = mockGraphql(200, {
      data: { createManualBusinessBill: { id: "bill_new" } },
    })
    const input = { vendorName: "Acme", amountInMinorUnits: 5000 }

    // Act
    await client.createManualBill(input)

    // Assert
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as { body: string }).body
    )
    expect(body.variables).toEqual({ input })
    expect(body.query).toContain("createManualBusinessBill(input: $input)")
  })

  it("returns the created bill", async () => {
    // Arrange
    const created = { id: "bill_new", status: "NEEDS_REVIEW" }
    mockGraphql(200, { data: { createManualBusinessBill: created } })

    // Act
    const result = await client.createManualBill({ vendorName: "Acme" })

    // Assert
    expect(result).toEqual(created)
  })

  it("surfaces a validation error from the server", async () => {
    // Arrange
    mockGraphql(200, {
      errors: [{ message: "amountInMinorUnits must be positive" }],
    })

    // Act / Assert
    await expect(
      client.createManualBill({ vendorName: "Acme" })
    ).rejects.toThrow("amountInMinorUnits must be positive")
  })
})

describe("BlazeClient.approveBill", () => {
  it("sends the approveBusinessBill mutation with the bill id", async () => {
    // Arrange
    const fetchMock = mockGraphql(200, {
      data: { approveBusinessBill: { id: "bill_1", status: "READY_TO_PAY" } },
    })

    // Act
    await client.approveBill("bill_1")

    // Assert
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as { body: string }).body
    )
    expect(body.variables).toEqual({ id: "bill_1" })
    expect(body.query).toContain("approveBusinessBill(id: $id)")
  })

  it("returns the approved bill with its new status", async () => {
    // Arrange
    const approved = {
      id: "bill_1",
      status: "READY_TO_PAY",
      approvedAt: "2026-05-18T00:00:00Z",
    }
    mockGraphql(200, { data: { approveBusinessBill: approved } })

    // Act
    const result = await client.approveBill("bill_1")

    // Assert
    expect(result).toEqual(approved)
  })
})

describe("BlazeClient.rejectBill", () => {
  it("sends the rejectBusinessBill mutation with id and reason", async () => {
    // Arrange
    const fetchMock = mockGraphql(200, {
      data: { rejectBusinessBill: { id: "bill_1", status: "REJECTED" } },
    })

    // Act
    await client.rejectBill("bill_1", "not our vendor")

    // Assert
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as { body: string }).body
    )
    expect(body.variables).toEqual({ id: "bill_1", reason: "not our vendor" })
  })

  it("passes an undefined reason when none is provided", async () => {
    // Arrange
    const fetchMock = mockGraphql(200, {
      data: { rejectBusinessBill: { id: "bill_1" } },
    })

    // Act
    await client.rejectBill("bill_1")

    // Assert
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as { body: string }).body
    )
    expect(body.variables).toEqual({ id: "bill_1", reason: undefined })
  })

  it("returns the rejected bill", async () => {
    // Arrange
    const rejected = {
      id: "bill_1",
      status: "REJECTED",
      rejectionReason: "spam",
    }
    mockGraphql(200, { data: { rejectBusinessBill: rejected } })

    // Act
    const result = await client.rejectBill("bill_1", "spam")

    // Assert
    expect(result).toEqual(rejected)
  })
})

describe("BlazeClient.quoteBillPayment", () => {
  it("sends the quoteBusinessBillPayment mutation with the input", async () => {
    // Arrange
    const fetchMock = mockGraphql(200, {
      data: { quoteBusinessBillPayment: { id: "quote_1" } },
    })
    const input = { billId: "bill_1", sourceFundingAccountId: null }

    // Act
    await client.quoteBillPayment(input)

    // Assert
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as { body: string }).body
    )
    expect(body.variables).toEqual({ input })
    expect(body.query).toContain("quoteBusinessBillPayment(input: $input)")
  })

  it("returns the quote with fee breakdown", async () => {
    // Arrange
    const quote = {
      id: "quote_1",
      billId: "bill_1",
      totalFeeInMinorUnits: 150,
      etaBusinessDays: 2,
    }
    mockGraphql(200, { data: { quoteBusinessBillPayment: quote } })

    // Act
    const result = await client.quoteBillPayment({ billId: "bill_1" })

    // Assert
    expect(result).toEqual(quote)
  })

  it("surfaces a server error when the bill cannot be quoted", async () => {
    // Arrange
    mockGraphql(200, {
      errors: [{ message: "Bill is not in a payable state" }],
    })

    // Act / Assert
    await expect(client.quoteBillPayment({ billId: "bill_1" })).rejects.toThrow(
      "Bill is not in a payable state"
    )
  })
})

describe("BlazeClient.payBill", () => {
  it("sends the payBusinessBill mutation with the input", async () => {
    // Arrange
    const fetchMock = mockGraphql(200, {
      data: { payBusinessBill: { id: "pay_1", status: "PAYMENT_PENDING" } },
    })
    const input = { billId: "bill_1", quoteId: "quote_1", confirm: true }

    // Act
    await client.payBill(input)

    // Assert
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as { body: string }).body
    )
    expect(body.variables).toEqual({ input })
    expect(body.query).toContain("payBusinessBill(input: $input)")
  })

  it("returns the created payment", async () => {
    // Arrange
    const payment = {
      id: "pay_1",
      billId: "bill_1",
      status: "PAYMENT_PENDING_FUNDING",
    }
    mockGraphql(200, { data: { payBusinessBill: payment } })

    // Act
    const result = await client.payBill({
      billId: "bill_1",
      quoteId: "quote_1",
      confirm: true,
    })

    // Assert
    expect(result).toEqual(payment)
  })

  it("surfaces a policy-denied error from the server", async () => {
    // Arrange
    mockGraphql(200, {
      errors: [{ message: "Payment denied by policy: requires approval" }],
    })

    // Act / Assert
    await expect(
      client.payBill({ billId: "bill_1", quoteId: "q", confirm: true })
    ).rejects.toThrow("Payment denied by policy: requires approval")
  })
})

describe("BlazeClient vendor methods", () => {
  it("listVendors sends the businessVendors query with params", async () => {
    // Arrange
    const fetchMock = mockGraphql(200, { data: { businessVendors: [] } })

    // Act
    await client.listVendors({ limit: 5 })

    // Assert
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as { body: string }).body
    )
    expect(body.variables).toEqual({ limit: 5 })
    expect(body.query).toContain("businessVendors(")
  })

  it("listVendors returns the vendor list", async () => {
    // Arrange
    const vendors = [{ id: "ven_1", name: "Acme" }]
    mockGraphql(200, { data: { businessVendors: vendors } })

    // Act
    const result = await client.listVendors()

    // Assert
    expect(result).toEqual(vendors)
  })

  it("getVendor sends the businessVendor query with the vendor id", async () => {
    // Arrange
    const fetchMock = mockGraphql(200, {
      data: { businessVendor: { id: "ven_1" } },
    })

    // Act
    await client.getVendor("ven_1")

    // Assert
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as { body: string }).body
    )
    expect(body.variables).toEqual({ id: "ven_1" })
    expect(body.query).toContain("businessVendor(id: $id)")
  })

  it("getVendor returns the vendor object", async () => {
    // Arrange
    const vendor = { id: "ven_1", name: "Acme", verifiedAt: null }
    mockGraphql(200, { data: { businessVendor: vendor } })

    // Act
    const result = await client.getVendor("ven_1")

    // Assert
    expect(result).toEqual(vendor)
  })
})

describe("BlazeClient Gmail integration methods", () => {
  it("generateGmailAuthUrl sends the mutation and returns the session", async () => {
    // Arrange
    const session = {
      id: "sess_1",
      status: "PENDING",
      authUrl: "https://accounts.google.com/o/oauth2/auth?x=1",
    }
    const fetchMock = mockGraphql(200, {
      data: { generateGmailAuthUrl: session },
    })

    // Act
    const result = await client.generateGmailAuthUrl()

    // Assert
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as { body: string }).body
    )
    expect(body.query).toContain("generateGmailAuthUrl")
    expect(result).toEqual(session)
  })

  it("getGmailConnectSession sends the sessionId variable", async () => {
    // Arrange
    const fetchMock = mockGraphql(200, {
      data: { gmailConnectSession: { id: "sess_1", status: "COMPLETE" } },
    })

    // Act
    await client.getGmailConnectSession("sess_1")

    // Assert
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as { body: string }).body
    )
    expect(body.variables).toEqual({ sessionId: "sess_1" })
  })

  it("listGmailIntegrations returns the integrations array", async () => {
    // Arrange
    const integrations = [{ id: "int_1", gmailAddress: "ap@acme.com" }]
    mockGraphql(200, { data: { businessGmailIntegrations: integrations } })

    // Act
    const result = await client.listGmailIntegrations()

    // Assert
    expect(result).toEqual(integrations)
  })

  it("triggerGmailSync passes the integrationId and returns the boolean", async () => {
    // Arrange
    const fetchMock = mockGraphql(200, {
      data: { triggerBusinessGmailSync: true },
    })

    // Act
    const result = await client.triggerGmailSync("int_1")

    // Assert
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as { body: string }).body
    )
    expect(body.variables).toEqual({ integrationId: "int_1" })
    expect(result).toBe(true)
  })

  it("triggerGmailSync passes undefined when no integration id is given", async () => {
    // Arrange
    const fetchMock = mockGraphql(200, {
      data: { triggerBusinessGmailSync: true },
    })

    // Act
    await client.triggerGmailSync()

    // Assert
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as { body: string }).body
    )
    expect(body.variables).toEqual({ integrationId: undefined })
  })
})

describe("BlazeClient approval-request methods", () => {
  it("listPendingBillApprovals returns the pending approvals array", async () => {
    // Arrange
    const approvals = [{ id: "ar_1", status: "PENDING", reason: "high value" }]
    mockGraphql(200, { data: { businessBillPendingApprovals: approvals } })

    // Act
    const result = await client.listPendingBillApprovals()

    // Assert
    expect(result).toEqual(approvals)
  })

  it("approveBillApprovalRequest sends the approval id", async () => {
    // Arrange
    const fetchMock = mockGraphql(200, {
      data: {
        approveBusinessBillApprovalRequest: { id: "ar_1", status: "APPROVED" },
      },
    })

    // Act
    const result = await client.approveBillApprovalRequest("ar_1")

    // Assert
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as { body: string }).body
    )
    expect(body.variables).toEqual({ id: "ar_1" })
    expect(result).toEqual({ id: "ar_1", status: "APPROVED" })
  })

  it("rejectBillApprovalRequest sends the id and reason", async () => {
    // Arrange
    const fetchMock = mockGraphql(200, {
      data: {
        rejectBusinessBillApprovalRequest: { id: "ar_1", status: "REJECTED" },
      },
    })

    // Act
    await client.rejectBillApprovalRequest("ar_1", "too risky")

    // Assert
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as { body: string }).body
    )
    expect(body.variables).toEqual({ id: "ar_1", reason: "too risky" })
  })

  it("listBillsActivityLog forwards filter params and returns entries", async () => {
    // Arrange
    const entries = [{ id: "log_1", category: "bill.pay.initiated" }]
    const fetchMock = mockGraphql(200, {
      data: { businessActivityLog: entries },
    })

    // Act
    const result = await client.listBillsActivityLog({
      category: "bill.pay.initiated",
      limit: 10,
    })

    // Assert
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as { body: string }).body
    )
    expect(body.variables).toEqual({
      category: "bill.pay.initiated",
      limit: 10,
    })
    expect(result).toEqual(entries)
  })
})
