import type {
  Intent,
  SendMoneyIntent,
  CheckBalanceIntent,
  ListTransactionsIntent,
} from "./intents"

/**
 * Named regex patterns for parsing natural language payment commands.
 * Tried in order — first match wins.
 */

const EMAIL_RE = "[\\w.+-]+@[\\w.-]+\\.[a-zA-Z]{2,}"
const AMOUNT_RE = "\\$?([\\d,]+(?:\\.\\d{1,2})?)"
const CURRENCY_RE = "([A-Z]{3})"
const NOTE_RE = '(?:\\s+note\\s+"([^"]+)")?'

interface PatternDef {
  regex: RegExp
  build: (match: RegExpMatchArray) => Intent
}

function parseAmount(raw: string): number {
  return Number(raw.replace(/,/g, ""))
}

/**
 * Send/pay/transfer patterns:
 *
 *   send $500 to john@example.com
 *   send 500 USD to john@example.com
 *   send $500 USD to john@example.com
 *   pay $500 to John Doe at john@example.com
 *   transfer $500 to john@example.com note "invoice 123"
 *   send 1000 MXN to john@example.com
 */
const sendPatterns: PatternDef[] = [
  // "pay $500 to John Doe at john@example.com" (with recipient name)
  {
    regex: new RegExp(
      `^(?:send|pay|transfer)\\s+${AMOUNT_RE}(?:\\s+${CURRENCY_RE})?\\s+to\\s+(.+?)\\s+at\\s+(${EMAIL_RE})${NOTE_RE}$`,
      "i"
    ),
    build: m => {
      const currency = m[2] ?? "USD"
      const intent: SendMoneyIntent = {
        type: "send_money",
        amount: parseAmount(m[1]),
        currency: currency.toUpperCase(),
        recipientName: m[3].trim(),
        recipientEmail: m[4],
      }
      if (m[5]) intent.note = m[5]
      return intent
    },
  },
  // "send $500 USD to john@example.com note 'invoice 123'"
  {
    regex: new RegExp(
      `^(?:send|pay|transfer)\\s+${AMOUNT_RE}(?:\\s+${CURRENCY_RE})?\\s+to\\s+(${EMAIL_RE})${NOTE_RE}$`,
      "i"
    ),
    build: m => {
      const currency = m[2] ?? "USD"
      const intent: SendMoneyIntent = {
        type: "send_money",
        amount: parseAmount(m[1]),
        currency: currency.toUpperCase(),
        recipientEmail: m[3],
      }
      if (m[4]) intent.note = m[4]
      return intent
    },
  },
]

const balancePatterns: PatternDef[] = [
  {
    regex: /^(?:check\s+)?balance$/i,
    build: (): CheckBalanceIntent => ({ type: "check_balance" }),
  },
]

const transactionPatterns: PatternDef[] = [
  {
    regex: /^(?:list|show)\s+transactions?(?:\s+(\d+))?$/i,
    build: (m): ListTransactionsIntent => {
      const intent: ListTransactionsIntent = { type: "list_transactions" }
      if (m[1]) intent.limit = Number(m[1])
      return intent
    },
  },
]

const allPatterns: PatternDef[] = [
  ...sendPatterns,
  ...balancePatterns,
  ...transactionPatterns,
]

/**
 * Parse a natural language input string into a structured Intent.
 * Returns null if no pattern matches.
 */
export function parseIntent(input: string): Intent | null {
  const trimmed = input.trim()
  for (const pattern of allPatterns) {
    const match = trimmed.match(pattern.regex)
    if (match) {
      return pattern.build(match)
    }
  }
  return null
}
