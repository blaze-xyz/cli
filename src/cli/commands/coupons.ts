import { Command } from "commander"
import { getClient, getGlobalOpts, handleError, withSpinner } from "../utils"
import { formatOutput } from "../output"

export function registerCouponsCommands(program: Command): void {
  const coupons = program
    .command("coupons")
    .description("Manage discount coupons")

  coupons
    .command("list")
    .description("List coupons")
    .option("--limit <n>", "Number of results", parseInt)
    .option("--active", "Only active coupons")
    .option("--inactive", "Only inactive coupons")
    .action(
      async (opts: {
        limit?: number
        active?: boolean
        inactive?: boolean
      }) => {
        try {
          const globals = getGlobalOpts(program)
          const client = await getClient(globals)
          const params: any = {}
          if (opts.limit) params.limit = opts.limit
          if (opts.active) params.is_active = true
          if (opts.inactive) params.is_active = false
          const result = await withSpinner(
            "Loading coupons…",
            () => client.listCoupons(params),
            { format: globals.format }
          )
          formatOutput(result.data, globals.format)
        } catch (err) {
          handleError(err)
        }
      }
    )

  coupons
    .command("get <id>")
    .description("Get a coupon by ID")
    .action(async (id: string) => {
      try {
        const globals = getGlobalOpts(program)
        const client = await getClient(globals)
        const result = await withSpinner(
          `Loading coupon ${id}…`,
          () => client.getCoupon(id),
          { format: globals.format }
        )
        formatOutput(result, globals.format)
      } catch (err) {
        handleError(err)
      }
    })

  coupons
    .command("create")
    .description("Create a new coupon")
    .requiredOption("--code <code>", "Coupon code (e.g., SUMMER20)")
    .requiredOption(
      "--type <type>",
      "Discount type: percentage or fixed_amount"
    )
    .requiredOption("--value <n>", "Discount value", parseInt)
    .option("--currency <code>", "Currency (required for fixed_amount)")
    .option("--max-redemptions <n>", "Maximum redemptions", parseInt)
    .option("--expires <date>", "Expiration date (YYYY-MM-DD)")
    .option(
      "--minimum-amount <n>",
      "Minimum order amount in minor units",
      parseInt
    )
    .action(
      async (opts: {
        code: string
        type: string
        value: number
        currency?: string
        maxRedemptions?: number
        expires?: string
        minimumAmount?: number
      }) => {
        try {
          const globals = getGlobalOpts(program)
          const client = await getClient(globals)

          const data: any = {
            code: opts.code,
            discount_type: opts.type,
            discount_value: opts.value,
          }
          if (opts.currency) data.currency = opts.currency
          if (opts.maxRedemptions) data.max_redemptions = opts.maxRedemptions
          if (opts.expires)
            data.expires_at = new Date(opts.expires).toISOString()
          if (opts.minimumAmount) data.minimum_amount = opts.minimumAmount

          const result = await withSpinner(
            "Creating coupon…",
            () => client.createCoupon(data),
            { format: globals.format }
          )
          formatOutput(result, globals.format)
        } catch (err) {
          handleError(err)
        }
      }
    )

  coupons
    .command("update <id>")
    .description("Update a coupon")
    .option("--max-redemptions <n>", "Maximum redemptions", parseInt)
    .option("--expires <date>", "Expiration date (YYYY-MM-DD)")
    .option("--active <bool>", "Set active status", v => v === "true")
    .action(
      async (
        id: string,
        opts: {
          maxRedemptions?: number
          expires?: string
          active?: boolean
        }
      ) => {
        try {
          const globals = getGlobalOpts(program)
          const client = await getClient(globals)

          const data: any = {}
          if (opts.maxRedemptions) data.max_redemptions = opts.maxRedemptions
          if (opts.expires)
            data.expires_at = new Date(opts.expires).toISOString()
          if (opts.active !== undefined) data.is_active = opts.active

          const result = await withSpinner(
            `Updating coupon ${id}…`,
            () => client.updateCoupon(id, data),
            { format: globals.format }
          )
          formatOutput(result, globals.format)
        } catch (err) {
          handleError(err)
        }
      }
    )

  coupons
    .command("deactivate <id>")
    .description("Deactivate a coupon")
    .action(async (id: string) => {
      try {
        const globals = getGlobalOpts(program)
        const client = await getClient(globals)
        await withSpinner(
          `Deactivating coupon ${id}…`,
          () => client.deactivateCoupon(id),
          { format: globals.format }
        )
        console.log("Coupon deactivated successfully.")
      } catch (err) {
        handleError(err)
      }
    })

  coupons
    .command("validate")
    .description("Validate a coupon code")
    .requiredOption("--code <code>", "Coupon code to validate")
    .requiredOption("--amount <n>", "Amount in minor units", parseInt)
    .requiredOption("--currency <code>", "Currency code")
    .action(
      async (opts: { code: string; amount: number; currency: string }) => {
        try {
          const globals = getGlobalOpts(program)
          const client = await getClient(globals)
          const result = await withSpinner(
            "Validating coupon…",
            () =>
              client.validateCoupon({
                code: opts.code,
                amount: opts.amount,
                currency: opts.currency,
              }),
            { format: globals.format }
          )
          formatOutput(result, globals.format)
        } catch (err) {
          handleError(err)
        }
      }
    )
}
