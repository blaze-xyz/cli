import { BlazeClient, BlazeNotFoundError } from "@blaze-money/cli"

const client = new BlazeClient({
  apiKey: process.env.BLAZE_API_KEY!,
})

async function sendMoney(email: string, amount: number) {
  // Step 1: Find or create the customer
  const customers = await client.listCustomers({ email })
  let customer = customers.data[0]

  if (!customer) {
    console.log(`Customer ${email} not found, creating...`)
    customer = await client.createCustomer({ email })
  }

  console.log(`Customer: ${customer.id}`)

  // Step 2: Create the transfer
  const transfer = await client.createTransfer({
    amount,
    currency: "USD",
    customer_id: customer.id,
  })

  console.log(`Transfer created: ${transfer.id} (${transfer.status})`)
  return transfer
}

sendMoney("maria@example.com", 100).catch(console.error)
