import { BlazeClient } from "../sdk/client"
import type { Currency } from "../sdk/types"
import type {
  SendMoneyIntent,
  CheckBalanceIntent,
  ListTransactionsIntent,
  Intent,
} from "./intents"

type LogType = "step" | "found" | "created" | "info" | "success" | "error"

export class Orchestrator {
  constructor(private client: BlazeClient) {}

  async execute(intent: Intent): Promise<void> {
    switch (intent.type) {
      case "send_money":
        return this.executeSendMoney(intent)
      case "check_balance":
        return this.executeCheckBalance(intent)
      case "list_transactions":
        return this.executeListTransactions(intent)
    }
  }

  private async executeSendMoney(intent: SendMoneyIntent): Promise<void> {
    // Step 1: Look up customer by email
    this.log("step", `Looking up customer: ${intent.recipientEmail}`)
    const customers = await this.client.listCustomers({
      email: intent.recipientEmail,
    })

    let customerId: string
    if (customers.data.length > 0) {
      const c = customers.data[0]
      customerId = c.id
      this.log(
        "found",
        `Customer found: ${c.first_name} ${c.last_name} (${customerId})`
      )
    } else {
      // Step 2: Create customer
      this.log("step", "Customer not found. Creating new customer...")
      const nameParts = intent.recipientName?.split(" ") ?? []
      const customer = await this.client.createCustomer({
        email: intent.recipientEmail,
        first_name: nameParts[0] ?? intent.recipientEmail.split("@")[0],
        last_name: nameParts.slice(1).join(" ") || undefined,
      })
      customerId = customer.id
      this.log("created", `Customer created: ${customer.id}`)
    }

    // Step 3: Check external accounts
    this.log("step", "Checking external accounts...")
    const accounts = await this.client.listExternalAccounts(customerId)

    let destinationId: string | undefined
    let destinationType: string | undefined
    if (accounts.data.length === 1) {
      const acct = accounts.data[0]
      destinationId = acct.id
      destinationType = "external_account"
      this.log(
        "found",
        `Using account: ${acct.type} ending in ${acct.account_last4}`
      )
    } else if (accounts.data.length > 1) {
      // Use the first one (future: interactive prompt)
      destinationId = accounts.data[0].id
      destinationType = "external_account"
      this.log(
        "info",
        `${accounts.data.length} accounts found. Using first account.`
      )
    } else {
      this.log(
        "info",
        "No external accounts found. Creating transfer without destination (wallet-to-wallet)."
      )
    }

    // Step 4: Create transfer
    this.log("step", `Creating transfer: $${intent.amount} ${intent.currency}`)
    const transfer = await this.client.createTransfer({
      amount: intent.amount,
      currency: intent.currency as Currency,
      customer_id: customerId,
      destination_type: destinationType as "external_account" | undefined,
      destination_id: destinationId,
      note: intent.note,
    })

    this.log("success", "Transfer created!")
    console.log(JSON.stringify(transfer, null, 2))
  }

  private async executeCheckBalance(
    _intent: CheckBalanceIntent
  ): Promise<void> {
    const balance = await this.client.getBalance()
    this.log(
      "success",
      `Balance: $${balance.available} ${balance.currency} (pending: $${balance.pending})`
    )
  }

  private async executeListTransactions(
    intent: ListTransactionsIntent
  ): Promise<void> {
    const txns = await this.client.listTransactions({
      limit: intent.limit ?? 10,
    })
    console.log(JSON.stringify(txns, null, 2))
  }

  private log(type: LogType, message: string): void {
    const icons: Record<LogType, string> = {
      step: ">>>",
      found: " ->",
      created: " + ",
      info: " i ",
      success: " OK",
      error: "ERR",
    }
    console.log(`[${icons[type]}] ${message}`)
  }
}
