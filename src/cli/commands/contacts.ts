import { Command } from "commander"
import { confirm } from "@inquirer/prompts"
import { getClient, getGlobalOpts, handleError } from "../utils"
import { formatOutput } from "../output"

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
        const data =
          result &&
          typeof result === "object" &&
          "data" in (result as Record<string, unknown>)
            ? (result as Record<string, unknown>).data
            : result
        formatOutput(data, globals.format)
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
    .command("pay <id>")
    .description("Pay a contact's bank account")
    .requiredOption("--amount <n>", "Amount to send", parseFloat)
    .option("--note <note>", "Optional payment note")
    .option("-y, --yes", "Skip confirmation prompt")
    .action(
      async (
        id: string,
        opts: { amount: number; note?: string; yes?: boolean }
      ) => {
        try {
          const globals = getGlobalOpts(program)
          const client = await getClient(globals)

          const balance = await client.getBalance()
          console.log(`Current balance:`)
          formatOutput(balance, globals.format)

          if (!opts.yes) {
            const confirmed = await confirm({
              message: `Pay ${opts.amount} to contact ${id}?`,
            })
            if (!confirmed) {
              console.log("Cancelled.")
              return
            }
          }

          const result = await client.payContact(id, {
            amount: opts.amount,
            note: opts.note,
          })
          formatOutput(result, globals.format)
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
