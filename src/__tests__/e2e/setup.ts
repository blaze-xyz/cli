import { BlazeClient } from "../../sdk/client"

export const SKIP_E2E = !process.env.BLAZE_TEST_API_KEY

export class TestContext {
  client: BlazeClient
  private createdResources: Array<{
    type: string
    id: string
    parentId?: string
  }> = []

  constructor() {
    const apiKey = process.env.BLAZE_TEST_API_KEY
    if (!apiKey) throw new Error("BLAZE_TEST_API_KEY not set")
    const baseUrl = process.env.BLAZE_TEST_BASE_URL ?? "https://api.blaze.money"
    this.client = new BlazeClient({ apiKey, baseUrl })
  }

  track(type: string, id: string, parentId?: string) {
    this.createdResources.push({ type, id, parentId })
  }

  async cleanup() {
    for (const resource of [...this.createdResources].reverse()) {
      try {
        switch (resource.type) {
          case "customer":
            await this.client.archiveCustomer(resource.id)
            break
          case "payment_link":
            await this.client.cancelPaymentLink(resource.id)
            break
          case "webhook":
            await this.client.deleteWebhook(resource.id)
            break
          case "external_account":
            if (resource.parentId) {
              await this.client.deleteExternalAccount(
                resource.parentId,
                resource.id
              )
            }
            break
        }
      } catch {
        // ignore cleanup errors
      }
    }
    this.createdResources = []
  }
}
