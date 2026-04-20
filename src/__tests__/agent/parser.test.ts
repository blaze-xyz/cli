import { parseIntent } from "../../agent/parser"

describe("parseIntent", () => {
  describe("send money", () => {
    it('parses "send $500 to john@example.com"', () => {
      const result = parseIntent("send $500 to john@example.com")
      expect(result).toEqual({
        type: "send_money",
        amount: 500,
        currency: "USD",
        recipientEmail: "john@example.com",
      })
    })

    it('parses "pay 500 USD to john@example.com"', () => {
      const result = parseIntent("pay 500 USD to john@example.com")
      expect(result).toMatchObject({
        type: "send_money",
        amount: 500,
        currency: "USD",
      })
    })

    it('parses "transfer $1,000.50 to jane@example.com"', () => {
      const result = parseIntent("transfer $1,000.50 to jane@example.com")
      expect(result).toMatchObject({
        type: "send_money",
        amount: 1000.5,
      })
    })

    it('parses "send $500 to John Doe at john@example.com"', () => {
      const result = parseIntent("send $500 to John Doe at john@example.com")
      expect(result).toMatchObject({
        type: "send_money",
        recipientName: "John Doe",
        recipientEmail: "john@example.com",
      })
    })

    it('parses send with note: send $100 to x@y.com note "invoice 123"', () => {
      const result = parseIntent('send $100 to x@y.com note "invoice 123"')
      expect(result).toMatchObject({
        type: "send_money",
        amount: 100,
        recipientEmail: "x@y.com",
        note: "invoice 123",
      })
    })

    it("defaults currency to USD when not specified", () => {
      const result = parseIntent("send $200 to test@example.com")
      expect(result).toMatchObject({
        type: "send_money",
        currency: "USD",
      })
    })

    it("strips commas from amounts", () => {
      const result = parseIntent("send $1,000 to x@y.com")
      expect(result).toMatchObject({
        type: "send_money",
        amount: 1000,
      })
    })

    it("handles decimal amounts", () => {
      const result = parseIntent("send $99.99 to x@y.com")
      expect(result).toMatchObject({
        type: "send_money",
        amount: 99.99,
      })
    })

    it("is case insensitive", () => {
      const result = parseIntent("SEND $50 to x@y.com")
      expect(result).toMatchObject({
        type: "send_money",
        amount: 50,
        recipientEmail: "x@y.com",
      })
    })
  })

  describe("check balance", () => {
    it('parses "balance"', () => {
      const result = parseIntent("balance")
      expect(result).toEqual({ type: "check_balance" })
    })

    it('parses "check balance"', () => {
      const result = parseIntent("check balance")
      expect(result).toEqual({ type: "check_balance" })
    })

    it("is case insensitive", () => {
      const result = parseIntent("CHECK BALANCE")
      expect(result).toEqual({ type: "check_balance" })
    })
  })

  describe("list transactions", () => {
    it('parses "list transactions" with no limit', () => {
      const result = parseIntent("list transactions")
      expect(result).toEqual({ type: "list_transactions" })
    })

    it('parses "show transactions"', () => {
      const result = parseIntent("show transactions")
      expect(result).toEqual({ type: "list_transactions" })
    })

    it('parses "list transactions 5" with limit', () => {
      const result = parseIntent("list transactions 5")
      expect(result).toEqual({ type: "list_transactions", limit: 5 })
    })

    it('parses singular "list transaction"', () => {
      const result = parseIntent("list transaction")
      expect(result).toEqual({ type: "list_transactions" })
    })
  })

  describe("unrecognized input", () => {
    it("returns null for empty string", () => {
      expect(parseIntent("")).toBeNull()
    })

    it("returns null for random text", () => {
      expect(parseIntent("hello world")).toBeNull()
    })

    it("returns null for partial match without amount/email", () => {
      expect(parseIntent("send money")).toBeNull()
    })

    it('returns null for "check" alone', () => {
      expect(parseIntent("check")).toBeNull()
    })
  })
})
