import { Command } from "commander"
import { getClient, getGlobalOpts, handleError } from "../utils"
import { formatOutput } from "../output"

export function registerCustomersCommands(program: Command): void {
  const customers = program.command("customers").description("Manage customers")

  customers
    .command("list")
    .description("List customers")
    .option("--limit <n>", "Number of results", parseInt)
    .option("--email <email>", "Filter by email")
    .action(async (opts: { limit?: number; email?: string }) => {
      try {
        const globals = getGlobalOpts(program)
        const client = getClient(globals)
        const result = await client.listCustomers({
          limit: opts.limit,
          email: opts.email,
        })
        formatOutput(result.data, globals.format)
      } catch (err) {
        handleError(err)
      }
    })

  customers
    .command("get <id>")
    .description("Get a customer by ID")
    .action(async (id: string) => {
      try {
        const globals = getGlobalOpts(program)
        const client = getClient(globals)
        const customer = await client.getCustomer(id)
        formatOutput(customer, globals.format)
      } catch (err) {
        handleError(err)
      }
    })

  customers
    .command("create")
    .description("Create a new customer")
    .requiredOption("--email <email>", "Customer email")
    .option("--first-name <name>", "First name")
    .option("--last-name <name>", "Last name")
    .option("--phone <phone>", "Phone number")
    .action(
      async (opts: {
        email: string
        firstName?: string
        lastName?: string
        phone?: string
      }) => {
        try {
          const globals = getGlobalOpts(program)
          const client = getClient(globals)
          const customer = await client.createCustomer({
            email: opts.email,
            first_name: opts.firstName,
            last_name: opts.lastName,
            phone: opts.phone,
          })
          formatOutput(customer, globals.format)
        } catch (err) {
          handleError(err)
        }
      }
    )

  customers
    .command("update <id>")
    .description("Update a customer")
    .option("--first-name <name>", "First name")
    .option("--last-name <name>", "Last name")
    .option("--phone <phone>", "Phone number")
    .action(
      async (
        id: string,
        opts: { firstName?: string; lastName?: string; phone?: string }
      ) => {
        try {
          const globals = getGlobalOpts(program)
          const client = getClient(globals)
          const customer = await client.updateCustomer(id, {
            first_name: opts.firstName,
            last_name: opts.lastName,
            phone: opts.phone,
          })
          formatOutput(customer, globals.format)
        } catch (err) {
          handleError(err)
        }
      }
    )

  customers
    .command("archive <id>")
    .description("Archive a customer")
    .action(async (id: string) => {
      try {
        const globals = getGlobalOpts(program)
        const client = getClient(globals)
        await client.archiveCustomer(id)
        console.log(`Customer ${id} archived.`)
      } catch (err) {
        handleError(err)
      }
    })
}
