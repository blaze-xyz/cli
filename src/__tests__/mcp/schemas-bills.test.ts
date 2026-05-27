import * as schemas from "../../mcp/schemas"

describe("listBillsSchema", () => {
  it("accepts an empty object since every field is optional", () => {
    const result = schemas.listBillsSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it("accepts a valid status enum value", () => {
    const result = schemas.listBillsSchema.safeParse({ status: "READY_TO_PAY" })
    expect(result.success).toBe(true)
  })

  it("rejects a status value outside the enum", () => {
    const result = schemas.listBillsSchema.safeParse({ status: "ARCHIVED" })
    expect(result.success).toBe(false)
  })

  it("rejects a non-integer limit", () => {
    const result = schemas.listBillsSchema.safeParse({ limit: 10.5 })
    expect(result.success).toBe(false)
  })

  it("accepts vendor_id, due_before, limit and cursor together", () => {
    const result = schemas.listBillsSchema.safeParse({
      status: "PAID",
      vendor_id: "ven_1",
      due_before: "2026-06-01",
      limit: 25,
      cursor: "abc",
    })
    expect(result.success).toBe(true)
  })
})

describe("createManualBillSchema", () => {
  it("requires vendor_name and amount_in_minor_units", () => {
    const result = schemas.createManualBillSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it("accepts the minimal required fields", () => {
    const result = schemas.createManualBillSchema.safeParse({
      vendor_name: "Acme Corp",
      amount_in_minor_units: 10000,
    })
    expect(result.success).toBe(true)
  })

  it("rejects a zero or negative amount", () => {
    const result = schemas.createManualBillSchema.safeParse({
      vendor_name: "Acme Corp",
      amount_in_minor_units: 0,
    })
    expect(result.success).toBe(false)
  })

  it("rejects a non-integer amount", () => {
    const result = schemas.createManualBillSchema.safeParse({
      vendor_name: "Acme Corp",
      amount_in_minor_units: 99.99,
    })
    expect(result.success).toBe(false)
  })

  it("accepts the full set of vendor banking fields", () => {
    const result = schemas.createManualBillSchema.safeParse({
      vendor_name: "Acme Corp",
      vendor_email_domain: "acme.com",
      invoice_number: "INV-100",
      amount_in_minor_units: 10000,
      currency: "USD",
      due_date: "2026-07-01",
      vendor_routing_number: "021000021",
      vendor_account_number: "123456789",
      vendor_bank_name: "Chase",
    })
    expect(result.success).toBe(true)
  })
})

describe("payBillSchema", () => {
  it("requires confirm to be literally true", () => {
    const result = schemas.payBillSchema.safeParse({
      bill_id: "bill_1",
      quote_id: "quote_1",
      confirm: false,
    })
    expect(result.success).toBe(false)
  })

  it("accepts the input when confirm is true", () => {
    const result = schemas.payBillSchema.safeParse({
      bill_id: "bill_1",
      quote_id: "quote_1",
      confirm: true,
    })
    expect(result.success).toBe(true)
  })

  it("rejects the input when quote_id is missing", () => {
    const result = schemas.payBillSchema.safeParse({
      bill_id: "bill_1",
      confirm: true,
    })
    expect(result.success).toBe(false)
  })
})

describe("quoteBillPaymentSchema", () => {
  it("requires bill_id", () => {
    const result = schemas.quoteBillPaymentSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it("accepts bill_id alone", () => {
    const result = schemas.quoteBillPaymentSchema.safeParse({
      bill_id: "bill_1",
    })
    expect(result.success).toBe(true)
  })

  it("rejects an expedite_option outside the enum", () => {
    const result = schemas.quoteBillPaymentSchema.safeParse({
      bill_id: "bill_1",
      expedite_option: "instant",
    })
    expect(result.success).toBe(false)
  })

  it("accepts a valid expedite_option and funding account", () => {
    const result = schemas.quoteBillPaymentSchema.safeParse({
      bill_id: "bill_1",
      source_funding_account_id: "acct_1",
      expedite_option: "fast",
    })
    expect(result.success).toBe(true)
  })
})

describe("simple bills id schemas", () => {
  it("getBillSchema requires an id", () => {
    expect(schemas.getBillSchema.safeParse({}).success).toBe(false)
    expect(schemas.getBillSchema.safeParse({ id: "bill_1" }).success).toBe(true)
  })

  it("approveBillSchema requires an id", () => {
    expect(schemas.approveBillSchema.safeParse({}).success).toBe(false)
    expect(schemas.approveBillSchema.safeParse({ id: "bill_1" }).success).toBe(
      true
    )
  })

  it("rejectBillSchema accepts an optional reason", () => {
    expect(schemas.rejectBillSchema.safeParse({ id: "bill_1" }).success).toBe(
      true
    )
    expect(
      schemas.rejectBillSchema.safeParse({ id: "bill_1", reason: "spam" })
        .success
    ).toBe(true)
  })

  it("getVendorSchema requires an id", () => {
    expect(schemas.getVendorSchema.safeParse({}).success).toBe(false)
    expect(schemas.getVendorSchema.safeParse({ id: "ven_1" }).success).toBe(
      true
    )
  })

  it("getGmailSessionSchema requires a session_id", () => {
    expect(schemas.getGmailSessionSchema.safeParse({}).success).toBe(false)
    expect(
      schemas.getGmailSessionSchema.safeParse({ session_id: "sess_1" }).success
    ).toBe(true)
  })

  it("approveBillApprovalRequestSchema requires an id", () => {
    expect(schemas.approveBillApprovalRequestSchema.safeParse({}).success).toBe(
      false
    )
    expect(
      schemas.approveBillApprovalRequestSchema.safeParse({ id: "ar_1" }).success
    ).toBe(true)
  })
})

describe("empty-object bills schemas", () => {
  it("generateGmailAuthUrlSchema accepts an empty object", () => {
    expect(schemas.generateGmailAuthUrlSchema.safeParse({}).success).toBe(true)
  })

  it("listGmailIntegrationsSchema accepts an empty object", () => {
    expect(schemas.listGmailIntegrationsSchema.safeParse({}).success).toBe(true)
  })

  it("listPendingApprovalsSchema accepts an empty object", () => {
    expect(schemas.listPendingApprovalsSchema.safeParse({}).success).toBe(true)
  })
})

describe("listBillsActivityLogSchema", () => {
  it("accepts an empty object", () => {
    expect(schemas.listBillsActivityLogSchema.safeParse({}).success).toBe(true)
  })

  it("rejects a non-integer limit", () => {
    const result = schemas.listBillsActivityLogSchema.safeParse({ limit: 2.5 })
    expect(result.success).toBe(false)
  })

  it("accepts category, bill_id and limit", () => {
    const result = schemas.listBillsActivityLogSchema.safeParse({
      category: "bill.pay.initiated",
      bill_id: "bill_1",
      limit: 50,
    })
    expect(result.success).toBe(true)
  })
})

describe("triggerGmailSyncSchema", () => {
  it("accepts an empty object", () => {
    expect(schemas.triggerGmailSyncSchema.safeParse({}).success).toBe(true)
  })

  it("accepts an optional integration_id", () => {
    const result = schemas.triggerGmailSyncSchema.safeParse({
      integration_id: "int_1",
    })
    expect(result.success).toBe(true)
  })
})
