#!/usr/bin/env node
import { Command } from "commander"
import { agentCommand } from "./commands/agent"
import { registerAuthCommands } from "./commands/auth"
import { registerBalanceCommand } from "./commands/balance"
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
import { registerDisputesCommands } from "./commands/disputes"
import { registerInvoicesCommands } from "./commands/invoices"
import { registerSubscriptionsCommands } from "./commands/subscriptions"
import { registerFxCommands } from "./commands/fx"
import { registerSetupCommand } from "./commands/setup"

const program = new Command()

program
  .name("blaze")
  .description("Blaze CLI — manage payments from the command line")
  .version("0.1.0")
  .option("--api-key <key>", "API key (overrides config)")
  .option("--base-url <url>", "API base URL")
  .option("--format <format>", "Output format: json or table", "json")

registerAuthCommands(program)
registerBalanceCommand(program)
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
registerDisputesCommands(program)
registerInvoicesCommands(program)
registerSubscriptionsCommands(program)
registerFxCommands(program)
registerSetupCommand(program)

program.parse()
