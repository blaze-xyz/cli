/**
 * Minimal GraphQL client for the Blaze setup flow.
 * Uses native fetch to call Blaze's GraphQL API with JWT authentication.
 */

export class BlazeGraphQLClient {
  constructor(
    private endpoint: string,
    private token: string
  ) {}

  async query<T>(
    query: string,
    variables?: Record<string, unknown>
  ): Promise<T> {
    const res = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({ query, variables }),
    })

    if (!res.ok) {
      throw new Error(`GraphQL request failed: HTTP ${res.status} ${res.statusText}`)
    }

    const json = (await res.json()) as {
      data?: T
      errors?: Array<{ message: string }>
    }

    if (json.errors && json.errors.length > 0) {
      throw new Error(json.errors[0].message)
    }

    if (!json.data) {
      throw new Error("GraphQL response missing data")
    }

    return json.data
  }
}
