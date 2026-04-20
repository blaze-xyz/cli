import { BlazeClient } from "@blaze-money/cli"

const client = new BlazeClient({
  apiKey: process.env.BLAZE_API_KEY!,
})

async function main() {
  const link = await client.createPaymentLink({
    amount: 50,
    currency: "USD",
    name: "Invoice #1234",
    note: "Payment for consulting services",
  })

  console.log(`Payment link created: ${link.url}`)
  console.log(`Short code: ${link.short_code}`)
  console.log(`Status: ${link.status}`)
}

main().catch(console.error)
