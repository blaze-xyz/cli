import { BlazeClient } from "@blaze-money/cli"

const client = new BlazeClient({
  apiKey: process.env.BLAZE_API_KEY!,
})

async function listAllCustomers() {
  let cursor: string | undefined
  let total = 0

  while (true) {
    const page = await client.listCustomers({ limit: 10, cursor })

    for (const customer of page.data) {
      total++
      console.log(`${total}. ${customer.email} (${customer.id})`)
    }

    if (!page.has_more || !page.next_cursor) break
    cursor = page.next_cursor
  }

  console.log(`\nTotal customers: ${total}`)
}

listAllCustomers().catch(console.error)
