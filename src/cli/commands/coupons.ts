import { Command } from "commander"
import { confirm } from "@inquirer/prompts"
import { getClient, getGlobalOpts, handleError, withSpinner } from "../utils"
import { formatOutput } from "../output"
import {
  CreateCouponInput,
  ListCouponsParams,
  UpdateCouponInput,
} from "../../sdk/types"

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
          const params: ListCouponsParams = {}
          if (opts.limit) params.limit = opts.limit
          if (opts.active) params.is_active = true
          if (opts.inactive) params.is_active = false
          const result = await withSpinner(
            "Loading coupons…",
            () => client.listCoupons(params),
            { format: globals.format }
          )
          if (globals.format === "json") {
            formatOutput(result.data, "json")
          } else if (result.data.length === 0) {
            console.log(
              "\nNo coupons found. Create one with: blaze coupons create --code SUMMER20 --type percentage --value 20\n"
            )
          } else {
            formatOutput(result.data, globals.format)
            console.log(`\n${result.data.length} coupon(s) found.`)
          }
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
    .option("-y, --yes", "Skip confirmation prompt")
    .action(
      async (opts: {
        code: string
        type: string
        value: number
        currency?: string
        maxRedemptions?: number
        expires?: string
        minimumAmount?: number
        yes?: boolean
      }) => {
        try {
          const globals = getGlobalOpts(program)
          const client = await getClient(globals)

          // Pre-checks
          if (opts.type !== "percentage" && opts.type !== "fixed_amount") {
            console.error(
              "Error: --type must be 'percentage' or 'fixed_amount'"
            )
            process.exitCode = 1
            return
          }

          if (
            opts.type === "percentage" &&
            (opts.value < 1 || opts.value > 100)
          ) {
            console.error("Error: Percentage value must be between 1 and 100")
            process.exitCode = 1
            return
          }

          if (opts.type === "fixed_amount" && !opts.currency) {
            console.error(
              "Error: --currency is required for fixed_amount discount type"
            )
            process.exitCode = 1
            return
          }

          const discountLabel =
            opts.type === "percentage"
              ? `${opts.value}% off`
              : `${opts.currency} ${(opts.value / 100).toFixed(2)} off`

          if (!opts.yes && globals.format !== "json") {
            let details = `Create coupon "${opts.code.toUpperCase()}" — ${discountLabel}`
            if (opts.maxRedemptions)
              details += ` (max ${opts.maxRedemptions} uses)`
            if (opts.expires) details += ` (expires ${opts.expires})`
            const confirmed = await confirm({ message: `${details}?` })
            if (!confirmed) {
              console.log("Cancelled.")
              return
            }
          }

          const data: CreateCouponInput = {
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

          if (globals.format === "json") {
            formatOutput(result, "json")
          } else {
            let msg = `\nYour "${result.code}" coupon has been created with ${discountLabel}`
            if (result.max_redemptions)
              msg += `, limited to ${result.max_redemptions} uses`
            if (result.expires_at)
              msg += `, expiring on ${new Date(result.expires_at).toLocaleDateString()}`
            msg += ".\n"
            console.log(msg)
          }
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

          const data: UpdateCouponInput = {}
          if (opts.maxRedemptions) data.max_redemptions = opts.maxRedemptions
          if (opts.expires)
            data.expires_at = new Date(opts.expires).toISOString()
          if (opts.active !== undefined) data.is_active = opts.active

          const result = await withSpinner(
            `Updating coupon ${id}…`,
            () => client.updateCoupon(id, data),
            { format: globals.format }
          )

          if (globals.format === "json") {
            formatOutput(result, "json")
          } else {
            console.log(
              `\nYour "${result.code}" coupon has been updated successfully.\n`
            )
          }
        } catch (err) {
          handleError(err)
        }
      }
    )

  coupons
    .command("deactivate <id>")
    .description("Deactivate a coupon")
    .option("-y, --yes", "Skip confirmation prompt")
    .action(async (id: string, opts: { yes?: boolean }) => {
      try {
        const globals = getGlobalOpts(program)
        const client = await getClient(globals)

        if (!opts.yes && globals.format !== "json") {
          const confirmed = await confirm({
            message: `Deactivate coupon ${id}? Customers will no longer be able to use it.`,
          })
          if (!confirmed) {
            console.log("Cancelled.")
            return
          }
        }

        await withSpinner(
          `Deactivating coupon ${id}…`,
          () => client.deactivateCoupon(id),
          { format: globals.format }
        )
        console.log(
          "\nYour coupon has been deactivated. Customers will no longer be able to use it.\n"
        )
      } catch (err) {
        handleError(err)
      }
    })

  coupons
    .command("validate")
    .description("Validate a coupon code against an amount")
    .requiredOption("--code <code>", "Coupon code to validate")
    .requiredOption(
      "--amount <n>",
      "Amount in minor units (e.g., 2999 = $29.99)",
      parseInt
    )
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

          if (globals.format === "json") {
            formatOutput(result, "json")
          } else if (result.valid && result.discount) {
            const originalAmount = (opts.amount / 100).toFixed(2)
            const discountAmount = (result.discount.amount_off / 100).toFixed(2)
            const finalAmount = (result.discount.final_amount / 100).toFixed(2)
            const discountLabel =
              result.discount.type === "percentage"
                ? `${result.discount.value}%`
                : `${opts.currency} ${discountAmount}`

            console.log(
              `\nCoupon "${opts.code.toUpperCase()}" is valid. It gives ${discountLabel} off, saving you ${opts.currency} ${discountAmount} on a ${opts.currency} ${originalAmount} order. Your total would be ${opts.currency} ${finalAmount}.\n`
            )
          } else {
            console.log(
              `\nCoupon "${opts.code.toUpperCase()}" is not valid. ${result.error}.\n`
            )
            process.exitCode = 1
          }
        } catch (err) {
          handleError(err)
        }
      }
    )
}
