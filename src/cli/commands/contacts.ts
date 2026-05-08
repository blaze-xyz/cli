import { Command } from "commander"
import { confirm, select } from "@inquirer/prompts"
import { getClient, getGlobalOpts, handleError } from "../utils"
import { formatOutput } from "../output"
import type { Contact, ContactBankAccount } from "../../sdk/types"

async function resolveBankAccount(
  contact: Contact
): Promise<ContactBankAccount> {
  const accounts = contact.bank_accounts || []
  if (accounts.length === 0) {
    throw new Error(
      `Contact "${contact.first_name || contact.business_name}" has no bank accounts.`
    )
  }
  if (accounts.length === 1) return accounts[0]

  const choice = await select({
    message: `${contact.first_name || contact.business_name} has ${accounts.length} bank accounts:`,
    choices: accounts.map(a => ({
      name: `${a.bank_name || "Bank"} — ${a.currency_id || "USD"} (****${(a.account_number || "").slice(-4)})`,
      value: a.id,
    })),
  })
  const resolved = accounts.find(a => a.id === choice)
  if (!resolved) {
    throw new Error("Selected bank account not found.")
  }
  return resolved
}

export function registerContactsCommands(program: Command): void {
  const contacts = program
    .command("contacts")
    .description("Manage your contacts")

  contacts
    .command("list")
    .description("List your contacts")
    .option("--search <term>", "Search by name or tag")
    .action(async (opts: { search?: string }) => {
      try {
        const globals = getGlobalOpts(program)
        const client = await getClient(globals)
        const result = await client.listContacts({ search: opts.search })
        formatOutput(result.data, globals.format)
      } catch (err) {
        handleError(err)
      }
    })

  contacts
    .command("add")
    .description("Add a new contact")
    .requiredOption("--name <name>", "Contact name")
    .option("--blazetag <tag>", "Blaze tag")
    .option("--type <type>", "Account type: bank, clabe, crypto", "bank")
    .option("--routing-number <n>", "US routing number")
    .option("--account-number <n>", "US account number")
    .option("--clabe <n>", "CLABE (Mexico)")
    .option("--wallet-address <address>", "Crypto wallet address")
    .option("--network <network>", "Blockchain network: stellar, ethereum")
    .action(
      async (opts: {
        name: string
        blazetag?: string
        type: string
        routingNumber?: string
        accountNumber?: string
        clabe?: string
        walletAddress?: string
        network?: string
      }) => {
        try {
          const globals = getGlobalOpts(program)
          const client = await getClient(globals)
          const data: Record<string, unknown> = {
            name: opts.name,
            type: opts.type,
          }
          if (opts.blazetag) data.blazetag = opts.blazetag
          if (opts.routingNumber) data.routing_number = opts.routingNumber
          if (opts.accountNumber) data.account_number = opts.accountNumber
          if (opts.clabe) data.clabe = opts.clabe
          if (opts.walletAddress) data.wallet_address = opts.walletAddress
          if (opts.network) data.network = opts.network

          const result = await client.createContact(data)
          formatOutput(result, globals.format)
        } catch (err) {
          handleError(err)
        }
      }
    )

  contacts
    .command("pay <nameOrId>")
    .description("Pay a contact's bank account (accepts name or ID)")
    .requiredOption("--amount <n>", "Amount to send", parseFloat)
    .option(
      "--currency <code>",
      "Currency code (inferred from bank account if omitted)"
    )
    .option("--bank-account-id <id>", "Bank account ID (prompts if multiple)")
    .option("--note <note>", "Optional payment note")
    .option("-y, --yes", "Skip confirmation prompt")
    .action(
      async (
        nameOrId: string,
        opts: {
          amount: number
          currency?: string
          bankAccountId?: string
          note?: string
          yes?: boolean
        }
      ) => {
        try {
          const globals = getGlobalOpts(program)
          const client = await getClient(globals)

          let contact: Contact
          const isCuid = /^c[a-z0-9]{24}$/.test(nameOrId)

          if (isCuid) {
            contact = await client.getContact(nameOrId)
          } else {
            const result = await client.listContacts({ search: nameOrId })
            const contacts = result.data
            if (contacts.length === 0) {
              console.error(`No contacts found matching "${nameOrId}"`)
              process.exit(1)
            }
            if (contacts.length === 1) {
              contact = contacts[0]
            } else {
              const choice = await select({
                message: `Multiple contacts match "${nameOrId}":`,
                choices: contacts.map(c => ({
                  name: `${c.first_name || ""} ${c.last_name || c.business_name || ""} — ${c.bank_accounts?.[0]?.bank_name || c.type}`,
                  value: c.id,
                })),
              })
              contact = contacts.find(c => c.id === choice)!
            }
          }

          let bankAccount: ContactBankAccount
          if (opts.bankAccountId) {
            const found = (contact.bank_accounts || []).find(
              a => a.id === opts.bankAccountId
            )
            if (!found) {
              console.error(
                `Bank account ID "${opts.bankAccountId}" not found on this contact.`
              )
              process.exit(1)
            }
            bankAccount = found
          } else {
            bankAccount = await resolveBankAccount(contact)
          }

          const currency = (
            opts.currency ||
            bankAccount.currency_id ||
            "USD"
          ).toUpperCase()

          let conversionNote = ""
          if (currency !== "USD" && currency !== "USDC") {
            try {
              const quote = await client.createFxQuote({
                from_currency: currency,
                to_currency: "USD",
                amount: opts.amount,
              })
              conversionNote = ` (~$${quote.converted_amount.toFixed(2)} USD from your balance)`
            } catch {
              // FX quote is informational — don't block payment if it fails
            }
          }

          if (!opts.yes) {
            const displayName = contact.first_name
              ? `${contact.first_name} ${contact.last_name || ""}`.trim()
              : contact.business_name || contact.id
            const accountInfo = `${bankAccount.bank_name || "Bank"} — ${currency} (****${(bankAccount.account_number || "").slice(-4)})`
            const confirmed = await confirm({
              message: `Pay ${opts.amount} ${currency}${conversionNote} to ${displayName} — ${accountInfo}?`,
            })
            if (!confirmed) {
              console.log("Cancelled.")
              return
            }
          }

          try {
            const result = await client.payContact(contact.id, bankAccount.id, {
              amount: opts.amount,
              currencyId: currency,
              note: opts.note,
            })
            console.log(`Payment submitted. Transfer ID: ${result.id}`)
            console.log(`Status: ${result.status}`)
            formatOutput(result, globals.format)
          } catch (err: any) {
            const code = err?.statusCode || err?.status
            if (code === 402) {
              console.error("Insufficient balance. Check with: blaze balance")
            } else if (code === 422) {
              console.error(`Payment rejected: ${err.message}`)
            } else if (code === 429) {
              console.error("Rate limited. Please wait a moment and try again.")
            } else {
              console.error(`Payment failed: ${err?.message || err}`)
            }
            process.exit(1)
          }
        } catch (err) {
          handleError(err)
        }
      }
    )

  contacts
    .command("remove <id>")
    .description("Remove a contact")
    .option("-y, --yes", "Skip confirmation prompt")
    .action(async (id: string, opts: { yes?: boolean }) => {
      try {
        if (!opts.yes) {
          const confirmed = await confirm({
            message: `Remove contact ${id}?`,
          })
          if (!confirmed) {
            console.log("Cancelled.")
            return
          }
        }
        const globals = getGlobalOpts(program)
        const client = await getClient(globals)
        await client.deleteContact(id)
        console.log(`Contact ${id} removed.`)
      } catch (err) {
        handleError(err)
      }
    })
}
