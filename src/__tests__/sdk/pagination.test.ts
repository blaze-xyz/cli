import { paginate } from "../../sdk/pagination"
import type { PaginatedList } from "../../sdk/types"

async function collect<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const items: T[] = []
  for await (const item of gen) {
    items.push(item)
  }
  return items
}

describe("paginate", () => {
  it("yields all items from a single page", async () => {
    const fetcher = jest.fn().mockResolvedValue({
      object: "list",
      data: [{ id: "1" }, { id: "2" }],
      has_more: false,
      next_cursor: null,
    } satisfies PaginatedList<{ id: string }>)

    const items = await collect(paginate(fetcher))

    expect(items).toEqual([{ id: "1" }, { id: "2" }])
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it("yields items across multiple pages following cursors", async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce({
        object: "list",
        data: [{ id: "1" }],
        has_more: true,
        next_cursor: "cursor1",
      } satisfies PaginatedList<{ id: string }>)
      .mockResolvedValueOnce({
        object: "list",
        data: [{ id: "2" }],
        has_more: false,
        next_cursor: null,
      } satisfies PaginatedList<{ id: string }>)

    const items = await collect(paginate(fetcher))

    expect(items).toEqual([{ id: "1" }, { id: "2" }])
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(fetcher).toHaveBeenNthCalledWith(1, { cursor: undefined })
    expect(fetcher).toHaveBeenNthCalledWith(2, { cursor: "cursor1" })
  })

  it("stops when has_more is false", async () => {
    const fetcher = jest.fn().mockResolvedValue({
      object: "list",
      data: [{ id: "1" }],
      has_more: false,
      next_cursor: null,
    } satisfies PaginatedList<{ id: string }>)

    await collect(paginate(fetcher))

    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it("stops when next_cursor is null even if has_more is true", async () => {
    const fetcher = jest.fn().mockResolvedValue({
      object: "list",
      data: [{ id: "1" }],
      has_more: true,
      next_cursor: null,
    } satisfies PaginatedList<{ id: string }>)

    const items = await collect(paginate(fetcher))

    expect(items).toEqual([{ id: "1" }])
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it("handles empty first page", async () => {
    const fetcher = jest.fn().mockResolvedValue({
      object: "list",
      data: [],
      has_more: false,
      next_cursor: null,
    } satisfies PaginatedList<{ id: string }>)

    const items = await collect(paginate(fetcher))

    expect(items).toEqual([])
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
