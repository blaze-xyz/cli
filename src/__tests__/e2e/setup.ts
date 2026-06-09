import { BlazeClient } from "../../sdk/client"

export const SKIP_E2E = !process.env.BLAZE_TEST_API_KEY
export const SKIP_CONSUMER_E2E = !process.env.BLAZE_TEST_JWT

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

  /**
   * Consumer (bearer-token) client for P2P / consumer-scoped flows. Gated by
   * SKIP_CONSUMER_E2E (BLAZE_TEST_JWT). Lets consumer-context cases run under the
   * correct auth instead of a business API key (which 401/403s on /v1/users etc).
   */
  consumerClient(): BlazeClient {
    const jwt = process.env.BLAZE_TEST_JWT
    if (!jwt) throw new Error("BLAZE_TEST_JWT not set")
    const baseUrl = process.env.BLAZE_TEST_BASE_URL ?? "https://api.blaze.money"
    return new BlazeClient({ bearerToken: jwt, baseUrl })
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
