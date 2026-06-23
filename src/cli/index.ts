#!/usr/bin/env node
import { Command, CommanderError } from "commander"
import packageJson from "../../package.json"
import { agentCommand } from "./commands/agent"
import { registerAuthCommands } from "./commands/auth"
import { registerBalanceCommand } from "./commands/balance"
import { registerBusinessesCommands } from "./commands/businesses"
import { registerCustomersCommands } from "./commands/customers"
import { registerRecipientsCommands } from "./commands/recipients"
import { registerTransfersCommands } from "./commands/transfers"
import { registerWithdrawalsCommands } from "./commands/withdrawals"
import { registerPaylinksCommands } from "./commands/paylinks"
import { registerAccountsCommands } from "./commands/accounts"
import { registerTransactionsCommands } from "./commands/transactions"
import { registerApiKeysCommands } from "./commands/api-keys"
import { registerTeamCommands } from "./commands/team"
import { registerWebhooksCommands } from "./commands/webhooks"
import { registerAnalyticsCommands } from "./commands/analytics"
import { registerInsightsCommands } from "./commands/insights"
import { registerDisputesCommands } from "./commands/disputes"
import { registerInvoicesCommands } from "./commands/invoices"
import { registerSubscriptionsCommands } from "./commands/subscriptions"
import { registerFxCommands } from "./commands/fx"
import { registerSetupCommand } from "./commands/setup"
import { registerMeCommands } from "./commands/me"
import { registerSendCommand } from "./commands/send"
import { registerContactsCommands } from "./commands/contacts"
import { registerPaymentsCommands } from "./commands/payments"
import { registerMemoryCommands } from "./commands/memory"
import { registerBillsCommands } from "./commands/bills"
import { registerAccountingCommands } from "./commands/accounting"
import { registerProductsCommands } from "./commands/products"
import { registerCouponsCommands } from "./commands/coupons"
import { registerWhoamiCommands } from "./commands/whoami"
import { checkForUpdates } from "./update-notifier"

const program = new Command()

program
  .name("blaze")
  .description("Blaze CLI — manage payments from the command line")
  .version(packageJson.version)
  .option("--api-key <key>", "API key (overrides config)")
  .option("--base-url <url>", "API base URL")
  .option("--format <format>", "Output format: json or table", "table")
  .option(
    "--business <id>",
    "Override: use this business context for the command"
  )
  .option(
    "--personal",
    "Override: use personal account (ignore active business)"
  )
  .exitOverride()

registerAuthCommands(program)
registerBalanceCommand(program)
registerBusinessesCommands(program)
registerCustomersCommands(program)
registerRecipientsCommands(program)
registerTransfersCommands(program)
registerWithdrawalsCommands(program)
registerPaylinksCommands(program)
registerAccountsCommands(program)
registerTransactionsCommands(program)
program.addCommand(agentCommand)
registerApiKeysCommands(program)
registerTeamCommands(program)
registerWebhooksCommands(program)
registerAnalyticsCommands(program)
registerInsightsCommands(program)
registerDisputesCommands(program)
registerInvoicesCommands(program)
registerSubscriptionsCommands(program)
registerFxCommands(program)
registerSetupCommand(program)
registerMeCommands(program)
registerSendCommand(program)
registerContactsCommands(program)
registerPaymentsCommands(program)
registerMemoryCommands(program)
registerBillsCommands(program)
registerAccountingCommands(program)
registerProductsCommands(program)
registerCouponsCommands(program)
registerWhoamiCommands(program)

async function main(): Promise<void> {
  // Non-blocking: surfaces a cached "update available" notice and refreshes the
  // cache in a detached background process. Never throws, never delays commands.
  await checkForUpdates({
    name: packageJson.name,
    version: packageJson.version,
    argv: process.argv,
  })

  try {
    program.parse()
  } catch (err) {
    if (err instanceof CommanderError) {
      process.exitCode = err.exitCode
    } else {
      console.error(err instanceof Error ? err.message : err)
      process.exitCode = 1
    }
  }
}

void main()
