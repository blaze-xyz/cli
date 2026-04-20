import { BlazeClient } from "@blaze-money/cli"

const client = new BlazeClient({
  apiKey: process.env.BLAZE_API_KEY!,
})

async function main() {
  // Check your balance
  const balance = await client.getBalance()
  console.log("Balance:", balance)

  // List customers
  const customers = await client.listCustomers({ limit: 5 })
  console.log(`Found ${customers.data.length} customers`)
  for (const c of customers.data) {
    console.log(`  - ${c.email} (${c.id})`)
  }
}

main().catch(console.error)
