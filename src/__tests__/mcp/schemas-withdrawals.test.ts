import * as schemas from "../../mcp/schemas"

describe("listConnectedPaymentMethodsSchema", () => {
  it("accepts empty params", () => {
    const result = schemas.listConnectedPaymentMethodsSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it("accepts an all boolean flag", () => {
    const result = schemas.listConnectedPaymentMethodsSchema.safeParse({
      all: true,
    })
    expect(result.success).toBe(true)
  })
})

describe("withdrawToPaymentMethodSchema", () => {
  it("accepts a full valid input with confirm true", () => {
    const result = schemas.withdrawToPaymentMethodSchema.safeParse({
      payment_method_id: "pm_1",
      amount: 25,
      currency: "USD",
      instant_transfer: false,
      confirm: true,
    })
    expect(result.success).toBe(true)
  })

  it("rejects confirm false because it must be literally true", () => {
    const result = schemas.withdrawToPaymentMethodSchema.safeParse({
      payment_method_id: "pm_1",
      amount: 25,
      confirm: false,
    })
    expect(result.success).toBe(false)
  })

  it("rejects a missing confirm field", () => {
    const result = schemas.withdrawToPaymentMethodSchema.safeParse({
      payment_method_id: "pm_1",
      amount: 25,
    })
    expect(result.success).toBe(false)
  })

  it("rejects a zero amount", () => {
    const result = schemas.withdrawToPaymentMethodSchema.safeParse({
      payment_method_id: "pm_1",
      amount: 0,
      confirm: true,
    })
    expect(result.success).toBe(false)
  })

  it("rejects a negative amount", () => {
    const result = schemas.withdrawToPaymentMethodSchema.safeParse({
      payment_method_id: "pm_1",
      amount: -5,
      confirm: true,
    })
    expect(result.success).toBe(false)
  })

  it("rejects a missing payment_method_id", () => {
    const result = schemas.withdrawToPaymentMethodSchema.safeParse({
      amount: 25,
      confirm: true,
    })
    expect(result.success).toBe(false)
  })
})

describe("estimateWithdrawalFeeSchema", () => {
  it("accepts a valid input with payment_method_id and amount", () => {
    const result = schemas.estimateWithdrawalFeeSchema.safeParse({
      payment_method_id: "pm_1",
      amount: 25,
      currency: "USD",
    })
    expect(result.success).toBe(true)
  })

  it("accepts an input without an optional currency", () => {
    const result = schemas.estimateWithdrawalFeeSchema.safeParse({
      payment_method_id: "pm_1",
      amount: 25,
    })
    expect(result.success).toBe(true)
  })

  it("rejects a missing payment_method_id", () => {
    const result = schemas.estimateWithdrawalFeeSchema.safeParse({
      amount: 25,
    })
    expect(result.success).toBe(false)
  })

  it("rejects a zero amount", () => {
    const result = schemas.estimateWithdrawalFeeSchema.safeParse({
      payment_method_id: "pm_1",
      amount: 0,
    })
    expect(result.success).toBe(false)
  })
})
