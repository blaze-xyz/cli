import { BlazeClient } from "../../sdk/client"
import {
  BlazeAuthenticationError,
  BlazeNetworkError,
  BlazeNotFoundError,
  BlazePermissionError,
  BlazeRateLimitError,
  BlazeServerError,
} from "../../sdk/errors"

/**
 * Mocks `global.fetch` for the GraphQL consumer-withdrawal surface. The new
 * withdrawal SDK methods (listConnectedPaymentMethods, withdrawToPaymentMethod,
 * getRampTransfer) all funnel through `graphqlRequest`, which POSTs to
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

function bodyOf(fetchMock: jest.Mock): { query: string; variables: unknown } {
  return JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body)
}

const client = new BlazeClient({ bearerToken: "jwt_consumer" })

afterEach(() => {
  jest.restoreAllMocks()
})

describe("BlazeClient.listConnectedPaymentMethods", () => {
  it("sends the ConnectedPaymentMethods query with the unquoted Withdraw enum mode", async () => {
    // Arrange
    const fetchMock = mockGraphql(200, {
      data: {
        me: { id: "u_1", paymentMethods: [], defaultWithdrawalMethod: null },
      },
    })

    // Act
    await client.listConnectedPaymentMethods()

    // Assert
    const body = bodyOf(fetchMock)
    expect(body.query).toContain("paymentMethods {")
    expect(body.query).toContain("defaultPaymentMethod(mode: Withdraw)")
    expect(body.query).not.toContain('mode: "Withdraw"')
    expect(body.variables).toBeUndefined()
  })

  it("selects the default residence country code in the query", async () => {
    // Arrange
    const fetchMock = mockGraphql(200, {
      data: {
        me: {
          id: "u_1",
          paymentMethods: [],
          defaultWithdrawalMethod: null,
          defaultResidence: null,
        },
      },
    })

    // Act
    await client.listConnectedPaymentMethods()

    // Assert
    const body = bodyOf(fetchMock)
    expect(body.query).toContain("defaultResidence { country { code } }")
  })

  it("returns the methods array, default withdrawal method id, and residence country code", async () => {
    // Arrange
    const methods = [
      { id: "pm_1", type: "Bank", canWithdraw: true },
      { id: "pm_2", type: "Card", canWithdraw: false },
    ]
    mockGraphql(200, {
      data: {
        me: {
          id: "u_1",
          paymentMethods: methods,
          defaultWithdrawalMethod: { id: "pm_1" },
          defaultResidence: { country: { code: "MX" } },
        },
      },
    })

    // Act
    const result = await client.listConnectedPaymentMethods()

    // Assert
    expect(result.methods).toEqual(methods)
    expect(result.defaultWithdrawalMethodId).toBe("pm_1")
    expect(result.countryCode).toBe("MX")
  })

  it("returns a null countryCode when there is no default residence", async () => {
    // Arrange
    mockGraphql(200, {
      data: {
        me: {
          id: "u_1",
          paymentMethods: [],
          defaultWithdrawalMethod: null,
          defaultResidence: null,
        },
      },
    })

    // Act
    const result = await client.listConnectedPaymentMethods()

    // Assert
    expect(result.countryCode).toBeNull()
  })

  it("returns null defaultWithdrawalMethodId when there is no default method", async () => {
    // Arrange
    mockGraphql(200, {
      data: {
        me: { id: "u_1", paymentMethods: [], defaultWithdrawalMethod: null },
      },
    })

    // Act
    const result = await client.listConnectedPaymentMethods()

    // Assert
    expect(result.defaultWithdrawalMethodId).toBeNull()
  })

  it("does NOT filter methods by canWithdraw — the caller filters", async () => {
    // Arrange
    const methods = [
      { id: "pm_1", canWithdraw: true },
      { id: "pm_2", canWithdraw: false },
    ]
    mockGraphql(200, {
      data: {
        me: {
          id: "u_1",
          paymentMethods: methods,
          defaultWithdrawalMethod: null,
        },
      },
    })

    // Act
    const result = await client.listConnectedPaymentMethods()

    // Assert
    expect(result.methods).toHaveLength(2)
  })
})

describe("BlazeClient.withdrawToPaymentMethod", () => {
  it("sends the exact withdrawAccount variables for a USD withdrawal", async () => {
    // Arrange — regression guard: the bug class is sending the wrong
    // amount/field on irreversible money movement. Assert the EXACT input.
    const fetchMock = mockGraphql(200, {
      data: {
        withdrawAccount: {
          status: "PENDING",
          message: null,
          jobId: null,
          rampTransferId: "rt_1",
        },
      },
    })

    // Act
    await client.withdrawToPaymentMethod({
      paymentMethodId: "pm_1",
      usdcAmountInCents: 2500,
      fiatAmountInCents: 2500,
      currencyCode: "USD",
      instantTransfer: false,
    })

    // Assert
    const body = bodyOf(fetchMock)
    expect(body.query).toContain("withdrawAccount(input: $input)")
    expect(body.variables).toEqual({
      input: {
        paymentMethodId: "pm_1",
        usdcAmountInCents: 2500,
        fiatAmountInCents: 2500,
        currencyCode: "USD",
        instantTransfer: false,
      },
    })
  })

  it("forwards non-USD FX-derived usdc cents distinct from fiat cents", async () => {
    // Arrange
    const fetchMock = mockGraphql(200, {
      data: {
        withdrawAccount: { status: "PENDING", rampTransferId: "rt_2" },
      },
    })

    // Act — caller derived usdc cents via FX; client must forward verbatim.
    await client.withdrawToPaymentMethod({
      paymentMethodId: "pm_9",
      usdcAmountInCents: 583,
      fiatAmountInCents: 10000,
      currencyCode: "MXN",
      instantTransfer: true,
    })

    // Assert
    const body = bodyOf(fetchMock) as {
      variables: {
        input: { usdcAmountInCents: number; fiatAmountInCents: number }
      }
    }
    expect(body.variables.input.usdcAmountInCents).toBe(583)
    expect(body.variables.input.fiatAmountInCents).toBe(10000)
  })

  it("returns the withdrawAccount response including a null rampTransferId", async () => {
    // Arrange
    mockGraphql(200, {
      data: {
        withdrawAccount: {
          status: "PENDING",
          message: "Submitted",
          jobId: null,
          rampTransferId: null,
        },
      },
    })

    // Act
    const result = await client.withdrawToPaymentMethod({
      paymentMethodId: "pm_1",
      usdcAmountInCents: 100,
      fiatAmountInCents: 100,
      currencyCode: "USD",
    })

    // Assert
    expect(result.status).toBe("PENDING")
    expect(result.rampTransferId).toBeNull()
  })

  it("propagates the server's GraphQL error message verbatim", async () => {
    // Arrange — server rejection carries eligibility/limit reasons.
    mockGraphql(200, {
      errors: [{ message: "Daily withdrawal limit exceeded" }],
    })

    // Act / Assert
    await expect(
      client.withdrawToPaymentMethod({
        paymentMethodId: "pm_1",
        usdcAmountInCents: 100,
        fiatAmountInCents: 100,
        currencyCode: "USD",
      })
    ).rejects.toThrow("Daily withdrawal limit exceeded")
  })

  it("throws a server error when the response has a null withdrawAccount", async () => {
    // Arrange — a 200 with data but no withdrawAccount payload (and no errors).
    mockGraphql(200, { data: { withdrawAccount: null } })

    // Act / Assert — irreversible movement must not silently return undefined.
    await expect(
      client.withdrawToPaymentMethod({
        paymentMethodId: "pm_1",
        usdcAmountInCents: 100,
        fiatAmountInCents: 100,
        currencyCode: "USD",
      })
    ).rejects.toThrow(BlazeServerError)
    await expect(
      client.withdrawToPaymentMethod({
        paymentMethodId: "pm_1",
        usdcAmountInCents: 100,
        fiatAmountInCents: 100,
        currencyCode: "USD",
      })
    ).rejects.toThrow("didn't return a result")
  })

  it("issues exactly one fetch call — the withdrawal is never retried", async () => {
    // Arrange
    const fetchMock = mockGraphql(200, {
      data: { withdrawAccount: { status: "PENDING", rampTransferId: "rt_3" } },
    })

    // Act
    await client.withdrawToPaymentMethod({
      paymentMethodId: "pm_1",
      usdcAmountInCents: 100,
      fiatAmountInCents: 100,
      currencyCode: "USD",
    })

    // Assert
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe("BlazeClient.checkWithdrawalLimits", () => {
  it("sends the CheckLimits query with the Withdrawal amountEntered snapshot and method id", async () => {
    // Arrange
    const fetchMock = mockGraphql(200, {
      data: {
        checkLimits: {
          isUnderLimit: true,
          meetsMinimum: true,
          minimumAmountCents: 500,
          limit: null,
          remaining: null,
        },
      },
    })

    // Act
    await client.checkWithdrawalLimits({
      paymentMethodId: "pm_1",
      fiatAmountInCents: 2500,
      currencyCode: "usd",
    })

    // Assert
    const body = bodyOf(fetchMock)
    expect(body.query).toContain("checkLimits(input: $input)")
    expect(body.variables).toEqual({
      input: {
        amountEntered: {
          amount: 2500,
          scale: 2,
          currency: { code: "USD", base: 10, exponent: 2 },
        },
        type: "Withdrawal",
        paymentMethodId: "pm_1",
      },
    })
  })

  it("maps the checkLimits response to the WithdrawalLimits shape", async () => {
    // Arrange
    mockGraphql(200, {
      data: {
        checkLimits: {
          isUnderLimit: false,
          meetsMinimum: true,
          minimumAmountCents: 500,
          limit: { amount: 100000, currency: { code: "USD" } },
          remaining: { amount: 2500, currency: { code: "USD" } },
        },
      },
    })

    // Act
    const result = await client.checkWithdrawalLimits({
      paymentMethodId: "pm_1",
      fiatAmountInCents: 50000,
      currencyCode: "USD",
    })

    // Assert
    expect(result).toEqual({
      meetsMinimum: true,
      minimumAmountCents: 500,
      isUnderLimit: false,
      limitUsdCents: 100000,
      remainingUsdCents: 2500,
    })
  })

  it("maps absent limit/remaining objects to null", async () => {
    // Arrange
    mockGraphql(200, {
      data: {
        checkLimits: {
          isUnderLimit: true,
          meetsMinimum: false,
          minimumAmountCents: 500,
          limit: null,
          remaining: null,
        },
      },
    })

    // Act
    const result = await client.checkWithdrawalLimits({
      paymentMethodId: "pm_1",
      fiatAmountInCents: 100,
      currencyCode: "USD",
    })

    // Assert
    expect(result.limitUsdCents).toBeNull()
    expect(result.remainingUsdCents).toBeNull()
    expect(result.meetsMinimum).toBe(false)
  })
})

describe("BlazeClient.getExchangeRate", () => {
  it("sends the getExchangeRate mutation with uppercased from/to and amount 1", async () => {
    // Arrange
    const fetchMock = mockGraphql(200, { data: { getExchangeRate: 0.0567 } })

    // Act
    await client.getExchangeRate("mxn", "usd")

    // Assert
    const body = bodyOf(fetchMock)
    expect(body.query).toContain("getExchangeRate(input: $input)")
    expect(body.variables).toEqual({
      input: { from: "MXN", to: "USD", amount: 1 },
    })
  })

  it("returns the Float rate from the response", async () => {
    // Arrange
    mockGraphql(200, { data: { getExchangeRate: 0.0567 } })

    // Act
    const rate = await client.getExchangeRate("MXN", "USD")

    // Assert
    expect(rate).toBe(0.0567)
  })
})

describe("BlazeClient.getApplicableWithdrawalFee", () => {
  it("sends the applicableFee query with the unquoted Withdrawal operationType and inputs", async () => {
    // Arrange
    const fetchMock = mockGraphql(200, {
      data: {
        applicableFee: {
          configId: "c",
          displayName: "Card Withdrawal Fee",
          flatFeeCents: 0,
          percentageFeeCents: 50,
          percentageRate: 0.02,
          totalFeeCents: 200,
          minFeeCents: 200,
        },
      },
    })

    // Act
    await client.getApplicableWithdrawalFee({
      paymentMethodType: "Card",
      providerId: "prov_coinflow",
      countryCode: "MX",
      amountCents: 2500,
    })

    // Assert
    const body = bodyOf(fetchMock)
    expect(body.query).toContain("applicableFee(input: $input)")
    expect(body.query).not.toContain('operationType: "Withdrawal"')
    expect(body.variables).toEqual({
      input: {
        paymentMethodType: "Card",
        providerId: "prov_coinflow",
        countryCode: "MX",
        operationType: "Withdrawal",
        amountCents: 2500,
      },
    })
  })

  it("defaults a missing providerId and countryCode to null in the input", async () => {
    // Arrange
    const fetchMock = mockGraphql(200, {
      data: { applicableFee: { configId: "c", totalFeeCents: 200 } },
    })

    // Act
    await client.getApplicableWithdrawalFee({
      paymentMethodType: "Bank",
      amountCents: 5000,
    })

    // Assert
    const body = bodyOf(fetchMock) as {
      variables: { input: { providerId: null; countryCode: null } }
    }
    expect(body.variables.input.providerId).toBeNull()
    expect(body.variables.input.countryCode).toBeNull()
  })

  it("returns the applicableFee result with its totalFeeCents", async () => {
    // Arrange
    const fee = {
      configId: "c",
      displayName: "Card Withdrawal Fee",
      flatFeeCents: 0,
      percentageFeeCents: 50,
      percentageRate: 0.02,
      totalFeeCents: 200,
      minFeeCents: 200,
    }
    mockGraphql(200, { data: { applicableFee: fee } })

    // Act
    const result = await client.getApplicableWithdrawalFee({
      paymentMethodType: "Card",
      amountCents: 2500,
    })

    // Assert
    expect(result).toEqual(fee)
  })

  it("returns null when the server returns no applicableFee", async () => {
    // Arrange
    mockGraphql(200, { data: { applicableFee: null } })

    // Act
    const result = await client.getApplicableWithdrawalFee({
      paymentMethodType: "Other",
      amountCents: 2500,
    })

    // Assert
    expect(result).toBeNull()
  })
})

describe("BlazeClient.getRampTransfer", () => {
  it("sends the rampTransfer query with the id and selects value/currency.code amounts plus feeCollections", async () => {
    // Arrange
    const fetchMock = mockGraphql(200, {
      data: {
        rampTransfer: { id: "rt_1", status: "Pending", type: "Withdrawal" },
      },
    })

    // Act
    await client.getRampTransfer("rt_1")

    // Assert
    const body = bodyOf(fetchMock)
    expect(body.variables).toEqual({ id: "rt_1" })
    expect(body.query).toContain("rampTransfer(id: $id)")
    expect(body.query).toContain("fiatAmount { value currency { code } }")
    expect(body.query).toContain(
      "feeCollections { amountCents displayName collectionMethod feeType }"
    )
    expect(body.query).not.toContain("currencyCode")
  })

  it("returns the rampTransfer with its feeCollections exposed", async () => {
    // Arrange
    const transfer = {
      id: "rt_1",
      type: "Withdrawal",
      status: "Pending",
      fiatAmount: { value: 2500, currency: { code: "USD" } },
      feeCollections: [
        {
          amountCents: 200,
          displayName: "Withdrawal fee",
          collectionMethod: "Deducted",
          feeType: "Withdrawal",
        },
      ],
    }
    mockGraphql(200, { data: { rampTransfer: transfer } })

    // Act
    const result = await client.getRampTransfer("rt_1")

    // Assert
    expect(result.feeCollections).toEqual([
      {
        amountCents: 200,
        displayName: "Withdrawal fee",
        collectionMethod: "Deducted",
        feeType: "Withdrawal",
      },
    ])
  })

  it("returns the rampTransfer status object", async () => {
    // Arrange
    const transfer = {
      id: "rt_1",
      type: "Withdrawal",
      status: "Completed",
      fiatAmount: { value: 2500, currency: { code: "USD" } },
    }
    mockGraphql(200, { data: { rampTransfer: transfer } })

    // Act
    const result = await client.getRampTransfer("rt_1")

    // Assert
    expect(result).toEqual(transfer)
  })

  it("maps a non-nullable-field GraphQL error to a not-found error", async () => {
    // Arrange — the server raises a non-nullable error when the id resolves to nothing.
    mockGraphql(200, {
      errors: [
        {
          message:
            "Cannot return null for non-nullable field Query.rampTransfer.",
        },
      ],
    })

    // Act / Assert
    await expect(client.getRampTransfer("rt_missing")).rejects.toThrow(
      BlazeNotFoundError
    )
    await expect(client.getRampTransfer("rt_missing")).rejects.toThrow(
      "No withdrawal found with id rt_missing"
    )
  })

  it("maps a null rampTransfer payload to a not-found error", async () => {
    // Arrange
    mockGraphql(200, { data: { rampTransfer: null } })

    // Act / Assert
    await expect(client.getRampTransfer("rt_missing")).rejects.toThrow(
      BlazeNotFoundError
    )
  })

  it("maps the server's masked 'unexpected error' message to a not-found error", async () => {
    // Arrange — production masks the non-null violation into a generic message.
    mockGraphql(200, {
      errors: [{ message: "An unexpected error occurred. Please try again." }],
    })

    // Act / Assert
    await expect(client.getRampTransfer("rt_missing")).rejects.toThrow(
      BlazeNotFoundError
    )
    await expect(client.getRampTransfer("rt_missing")).rejects.toThrow(
      "No withdrawal found with id rt_missing"
    )
  })

  it("re-throws an unrelated GraphQL error unchanged", async () => {
    // Arrange
    mockGraphql(200, { errors: [{ message: "Some other problem" }] })

    // Act / Assert
    await expect(client.getRampTransfer("rt_1")).rejects.toThrow(
      "Some other problem"
    )
  })
})

describe("BlazeClient.graphqlRequest HTTP and network mapping", () => {
  it("maps a fetch network rejection to a BlazeNetworkError", async () => {
    // Arrange
    global.fetch = jest.fn().mockRejectedValue(new Error("ECONNREFUSED"))

    // Act / Assert
    await expect(client.getRampTransfer("rt_1")).rejects.toThrow(
      BlazeNetworkError
    )
    await expect(client.getRampTransfer("rt_1")).rejects.toThrow(
      "Couldn't reach Blaze"
    )
  })

  it("maps a 401 response to a BlazeAuthenticationError", async () => {
    // Arrange
    mockGraphql(401, {}, "Unauthorized")

    // Act / Assert
    await expect(client.getRampTransfer("rt_1")).rejects.toThrow(
      BlazeAuthenticationError
    )
    await expect(client.getRampTransfer("rt_1")).rejects.toThrow("blaze auth")
  })

  it("maps a 403 response to a BlazePermissionError", async () => {
    // Arrange
    mockGraphql(403, {}, "Forbidden")

    // Act / Assert
    await expect(client.getRampTransfer("rt_1")).rejects.toThrow(
      BlazePermissionError
    )
  })

  it("maps a 429 response to a BlazeRateLimitError", async () => {
    // Arrange
    mockGraphql(429, {}, "Too Many Requests")

    // Act / Assert
    await expect(client.getRampTransfer("rt_1")).rejects.toThrow(
      BlazeRateLimitError
    )
  })

  it("maps a 500 response to a BlazeServerError", async () => {
    // Arrange
    mockGraphql(500, {}, "Internal Server Error")

    // Act / Assert
    await expect(client.getRampTransfer("rt_1")).rejects.toThrow(
      BlazeServerError
    )
  })

  it("falls back to a generic error for an unmapped 4xx status", async () => {
    // Arrange — a non-2xx, non-mapped status keeps the generic HTTP error.
    mockGraphql(418, {}, "I'm a teapot")

    // Act / Assert
    await expect(client.getRampTransfer("rt_1")).rejects.toThrow(
      "GraphQL HTTP 418"
    )
  })
})
