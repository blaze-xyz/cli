export type Intent =
  | SendMoneyIntent
  | CheckBalanceIntent
  | ListTransactionsIntent

export interface SendMoneyIntent {
  type: "send_money"
  amount: number
  currency: string // default "USD"
  recipientEmail: string
  recipientName?: string
  note?: string
}

export interface CheckBalanceIntent {
  type: "check_balance"
}

export interface ListTransactionsIntent {
  type: "list_transactions"
  limit?: number
}
