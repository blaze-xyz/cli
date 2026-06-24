import { shouldShowBusinessContext } from "../../cli/commands/whoami"

describe("shouldShowBusinessContext", () => {
  it("returns false when forced personal even with a selected business", () => {
    expect(
      shouldShowBusinessContext({
        personal: true,
        isApiKey: false,
        hasSelectedBusiness: true,
      })
    ).toBe(false)
  })

  it("returns false for a bearer token with no business selected (defaults to personal)", () => {
    expect(
      shouldShowBusinessContext({
        personal: false,
        isApiKey: false,
        hasSelectedBusiness: false,
      })
    ).toBe(false)
  })

  it("returns true for a bearer token with an explicitly selected business", () => {
    expect(
      shouldShowBusinessContext({
        personal: false,
        isApiKey: false,
        hasSelectedBusiness: true,
      })
    ).toBe(true)
  })

  it("returns true for an API key even with no business selected", () => {
    expect(
      shouldShowBusinessContext({
        personal: false,
        isApiKey: true,
        hasSelectedBusiness: false,
      })
    ).toBe(true)
  })

  it("returns false for an API key when forced personal", () => {
    expect(
      shouldShowBusinessContext({
        personal: true,
        isApiKey: true,
        hasSelectedBusiness: false,
      })
    ).toBe(false)
  })
})
