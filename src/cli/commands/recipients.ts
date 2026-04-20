import { Command } from "commander"
import { getClient, getGlobalOpts, handleError } from "../utils"
import { formatOutput } from "../output"
import type { ExternalAccountType, CryptoNetwork } from "../../sdk/types"

export function registerRecipientsCommands(program: Command): void {
  const recipients = program
    .command("recipients")
    .description("Manage recipient external accounts")

  recipients
    .command("list")
    .description("List external accounts for a customer")
    .requiredOption("--customer-id <id>", "Customer ID")
    .action(async (opts: { customerId: string }) => {
      try {
        const globals = getGlobalOpts(program)
        const client = getClient(globals)
        const result = await client.listExternalAccounts(opts.customerId)
        formatOutput(result.data, globals.format)
      } catch (err) {
        handleError(err)
      }
    })

  recipients
    .command("add")
    .description("Add an external account to a customer")
    .requiredOption("--customer-id <id>", "Customer ID")
    .requiredOption(
      "--type <type>",
      "Account type: us_bank, iban, or crypto_wallet"
    )
    .option("--account-holder-name <name>", "Account holder name")
    .option("--bank-name <name>", "Bank name")
    .option("--routing-number <number>", "Routing number (us_bank)")
    .option("--account-number <number>", "Account number (us_bank)")
    .option("--iban <iban>", "IBAN (iban type)")
    .option("--country-code <code>", "Country code")
    .option("--wallet-address <address>", "Wallet address (crypto_wallet)")
    .option(
      "--network <network>",
      "Crypto network: stellar, ethereum, polygon, solana, base"
    )
    .action(
      async (opts: {
        customerId: string
        type: string
        accountHolderName?: string
        bankName?: string
        routingNumber?: string
        accountNumber?: string
        iban?: string
        countryCode?: string
        walletAddress?: string
        network?: string
      }) => {
        try {
          const globals = getGlobalOpts(program)
          const client = getClient(globals)
          const account = await client.createExternalAccount(opts.customerId, {
            type: opts.type as ExternalAccountType,
            account_holder_name: opts.accountHolderName,
            bank_name: opts.bankName,
            routing_number: opts.routingNumber,
            account_number: opts.accountNumber,
            iban: opts.iban,
            country_code: opts.countryCode,
            wallet_address: opts.walletAddress,
            network: opts.network as CryptoNetwork | undefined,
          })
          formatOutput(account, globals.format)
        } catch (err) {
          handleError(err)
        }
      }
    )

  recipients
    .command("remove")
    .description("Remove an external account from a customer")
    .requiredOption("--customer-id <id>", "Customer ID")
    .requiredOption("--account-id <id>", "External account ID")
    .action(async (opts: { customerId: string; accountId: string }) => {
      try {
        const globals = getGlobalOpts(program)
        const client = getClient(globals)
        await client.deleteExternalAccount(opts.customerId, opts.accountId)
        console.log(`External account ${opts.accountId} removed.`)
      } catch (err) {
        handleError(err)
      }
    })
}
