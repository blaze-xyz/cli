import { Command } from "commander"
import { getClient, getGlobalOpts, handleError, withSpinner } from "../utils"
import { formatOutput } from "../output"
import * as fs from "fs"
import * as path from "path"

export function registerProductsCommands(program: Command): void {
  const products = program
    .command("products")
    .description("Manage products in your catalog")

  products
    .command("list")
    .description("List products")
    .option("--limit <n>", "Number of results", parseInt)
    .option("--active", "Only active products")
    .option("--inactive", "Only archived products")
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
            "Loading products…",
            () => client.listProducts(params),
            { format: globals.format }
          )
          formatOutput(result.data, globals.format)
        } catch (err) {
          handleError(err)
        }
      }
    )

  products
    .command("get <id>")
    .description("Get a product by ID")
    .action(async (id: string) => {
      try {
        const globals = getGlobalOpts(program)
        const client = await getClient(globals)
        const result = await withSpinner(
          `Loading product ${id}…`,
          () => client.getProduct(id),
          { format: globals.format }
        )
        formatOutput(result, globals.format)
      } catch (err) {
        handleError(err)
      }
    })

  products
    .command("create")
    .description("Create a new product")
    .requiredOption("--name <name>", "Product name")
    .requiredOption("--price <amount>", "Price (e.g., 29.99)", parseFloat)
    .option("--currency <code>", "Currency code (default: USD)")
    .option("--description <text>", "Product description")
    .option("--image <path>", "Local image file to upload")
    .option("--image-url <url>", "Image URL (alternative to --image)")
    .option("--recurring", "Mark as recurring product")
    .option("--interval <interval>", "Recurring interval: month, year, week")
    .action(
      async (opts: {
        name: string
        price: number
        currency?: string
        description?: string
        image?: string
        imageUrl?: string
        recurring?: boolean
        interval?: string
      }) => {
        try {
          const globals = getGlobalOpts(program)
          const client = await getClient(globals)

          const data: any = {
            name: opts.name,
            price: opts.price,
          }
          if (opts.currency) data.currency = opts.currency
          if (opts.description) data.description = opts.description
          if (opts.recurring) data.is_recurring = true
          if (opts.interval) data.recurring_interval = opts.interval

          if (opts.image) {
            const filePath = path.resolve(opts.image)
            const fileBuffer = fs.readFileSync(filePath)
            data.image_base64 = fileBuffer.toString("base64")
            data.image_file_name = path.basename(filePath)
            const ext = path.extname(filePath).toLowerCase().slice(1)
            const mimeMap: Record<string, string> = {
              jpg: "image/jpeg",
              jpeg: "image/jpeg",
              png: "image/png",
              webp: "image/webp",
              gif: "image/gif",
            }
            data.image_mime_type = mimeMap[ext] || "image/jpeg"
          } else if (opts.imageUrl) {
            data.image_url = opts.imageUrl
          }

          const result = await withSpinner(
            "Creating product…",
            () => client.createProduct(data),
            { format: globals.format }
          )
          formatOutput(result, globals.format)
        } catch (err) {
          handleError(err)
        }
      }
    )

  products
    .command("update <id>")
    .description("Update a product")
    .option("--name <name>", "Product name")
    .option("--price <amount>", "Price", parseFloat)
    .option("--currency <code>", "Currency code")
    .option("--description <text>", "Product description")
    .option("--image <path>", "Local image file to upload")
    .option("--active <bool>", "Set active status", v => v === "true")
    .action(
      async (
        id: string,
        opts: {
          name?: string
          price?: number
          currency?: string
          description?: string
          image?: string
          active?: boolean
        }
      ) => {
        try {
          const globals = getGlobalOpts(program)
          const client = await getClient(globals)

          const data: any = {}
          if (opts.name) data.name = opts.name
          if (opts.price) data.price = opts.price
          if (opts.currency) data.currency = opts.currency
          if (opts.description) data.description = opts.description
          if (opts.active !== undefined) data.is_active = opts.active

          if (opts.image) {
            const filePath = path.resolve(opts.image)
            const fileBuffer = fs.readFileSync(filePath)
            data.image_base64 = fileBuffer.toString("base64")
            data.image_file_name = path.basename(filePath)
            const ext = path.extname(filePath).toLowerCase().slice(1)
            const mimeMap: Record<string, string> = {
              jpg: "image/jpeg",
              jpeg: "image/jpeg",
              png: "image/png",
              webp: "image/webp",
              gif: "image/gif",
            }
            data.image_mime_type = mimeMap[ext] || "image/jpeg"
          }

          const result = await withSpinner(
            `Updating product ${id}…`,
            () => client.updateProduct(id, data),
            { format: globals.format }
          )
          formatOutput(result, globals.format)
        } catch (err) {
          handleError(err)
        }
      }
    )

  products
    .command("archive <id>")
    .description("Archive a product")
    .action(async (id: string) => {
      try {
        const globals = getGlobalOpts(program)
        const client = await getClient(globals)
        await withSpinner(
          `Archiving product ${id}…`,
          () => client.archiveProduct(id),
          { format: globals.format }
        )
        console.log("Product archived successfully.")
      } catch (err) {
        handleError(err)
      }
    })
}
