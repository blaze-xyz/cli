import type { PaginatedList, PaginationParams } from "./types"

/**
 * Auto-paginate through all results from a paginated endpoint.
 * Usage:
 *   for await (const customer of paginate((params) => client.listCustomers(params))) {
 *     console.log(customer)
 *   }
 */
export async function* paginate<T>(
  fetcher: (params: PaginationParams) => Promise<PaginatedList<T>>,
  params?: Omit<PaginationParams, "cursor">
): AsyncGenerator<T> {
  let cursor: string | undefined = undefined

  while (true) {
    const page = await fetcher({ ...params, cursor })
    for (const item of page.data) {
      yield item
    }
    if (!page.has_more || !page.next_cursor) break
    cursor = page.next_cursor
  }
}
