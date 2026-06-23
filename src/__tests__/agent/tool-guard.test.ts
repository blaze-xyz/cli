import { BlazePermissionError, BlazeRateLimitError } from "../../sdk/errors"
import { ToolCallGuard } from "../../agent/tool-guard"

describe("ToolCallGuard", () => {
  it("not short-circuit a tool that has not failed", () => {
    // Arrange
    const guard = new ToolCallGuard()

    // Act
    const result = guard.shortCircuit("blaze_list_bills")

    // Assert
    expect(result).toBeNull()
  })

  it("short-circuit a tool after a non-retryable error", () => {
    // Arrange
    const guard = new ToolCallGuard()
    guard.recordError("blaze_list_bills", new BlazePermissionError("no access"))

    // Act
    const result = guard.shortCircuit("blaze_list_bills") as {
      not_retried: boolean
      retryable: boolean
      kind: string
    }

    // Assert
    expect(result).not.toBeNull()
    expect(result.not_retried).toBe(true)
    expect(result.retryable).toBe(false)
    expect(result.kind).toBe("permission")
  })

  it("not block after a retryable error", () => {
    // Arrange
    const guard = new ToolCallGuard()
    guard.recordError(
      "blaze_list_transfers",
      new BlazeRateLimitError("slow down")
    )

    // Act
    const result = guard.shortCircuit("blaze_list_transfers")

    // Assert
    expect(result).toBeNull()
  })

  it("track tools independently", () => {
    // Arrange
    const guard = new ToolCallGuard()
    guard.recordError(
      "blaze_get_balance",
      new BlazePermissionError("no access")
    )

    // Assert
    expect(guard.shortCircuit("blaze_get_balance")).not.toBeNull()
    expect(guard.shortCircuit("blaze_list_transactions")).toBeNull()
  })
})
