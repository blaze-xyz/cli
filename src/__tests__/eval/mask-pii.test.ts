import { collectPii, maskPii } from "../../../eval/mask-pii"

describe("collectPii", () => {
  it("collect names, email, phone, blazetag, and stellar key from a tool result", () => {
    // Arrange
    const result = {
      object: "list",
      data: [
        {
          amount: 250000,
          currency: "MXN",
          customer: {
            first_name: "Jorge",
            last_name: "Luis Sanchez",
            email: "jls@example.com",
          },
        },
      ],
      owner: {
        blazetag: "gerson_test",
        phone: "+14155550123",
        stellar_public_key: `G${"A".repeat(55)}`,
      },
    }
    const pii = new Set<string>()

    // Act
    collectPii(result, pii)

    // Assert
    expect(pii.has("Jorge")).toBe(true)
    expect(pii.has("Luis Sanchez")).toBe(true)
    expect(pii.has("jls@example.com")).toBe(true)
    expect(pii.has("gerson_test")).toBe(true)
    expect(pii.has("+14155550123")).toBe(true)
  })
})

describe("maskPii", () => {
  it("mask known names everywhere, including free-text tables", () => {
    // Arrange
    const known = new Set(["Jorge", "Luis Sanchez"])

    // Act
    const result = maskPii("| Jorge Luis Sanchez | 2,500.00 MXN |", known)

    // Assert
    expect(result).toBe("| ***** ***** | 2,500.00 MXN |")
  })

  it("regex-mask emails, stellar keys, and E.164 phones without a dictionary", () => {
    // Arrange
    const text = `email a@b.com phone +14155550123 wallet G${"B".repeat(55)}`

    // Act
    const result = maskPii(text)

    // Assert
    expect(result).not.toContain("a@b.com")
    expect(result).not.toContain("+14155550123")
    expect(result).not.toMatch(/G[A-Z2-7]{55}/)
  })

  it("not mask ordinary amounts, counts, or dates", () => {
    // Arrange
    const text = "Total 2,500.00 MXN across 14 payments on 2026-06-18"

    // Act + Assert
    expect(maskPii(text)).toBe(text)
  })
})
