import type { CreateContactCryptoAddressData } from "./types"

// Enabled blockchain networks for crypto sends, mapped from the lowercase agent/
// CLI value to the PascalCase enum the backend (BlockchainNetwork) expects. This
// is the single source of truth shared by the `contacts add` CLI command and the
// `blaze_add_contact` agent tool so the two can never map networks differently.
export const NETWORK_MAP: Record<string, string> = {
  stellar: "Stellar",
  ethereum: "Ethereum",
  polygon: "Polygon",
  solana: "Solana",
  base: "Base",
  arbitrum: "Arbitrum",
  optimism: "Optimism",
  avalanche: "Avalanche",
}

export const SUPPORTED_NETWORKS = Object.keys(NETWORK_MAP)

// Flat contact shape the agent tool receives from the model. Mirrors the
// blaze_add_contact tool input_schema.
export interface AgentContactInput {
  name: string
  blazetag?: string
  type?: "blaze" | "bank" | "clabe" | "crypto"
  category?: string
  phone?: string
  email?: string
  routing_number?: string
  account_number?: string
  clabe?: string
  wallet_address?: string
  network?: string
  memo?: string
}

// Nested REST payload accepted by POST /v1/recipients (CreateRecipientDto).
export interface CreateContactPayload {
  type: "Bank" | "Stablecoin"
  category: string
  firstName: string
  lastName: string
  phoneNumber: string
  email?: string
  bankAccountData?: {
    countryId: string
    accountNumber: string
    routingNumber?: string
  }
  cryptoAddressData?: CreateContactCryptoAddressData
}

/**
 * Splits a single display name into first and last name on the first space.
 * The REST service requires BOTH firstName and lastName for Personal recipients
 * (it throws "firstName and lastName required for Personal recipients"), so a
 * single-token name is rejected here with an actionable message rather than
 * failing opaquely server-side.
 */
function splitName(name: string): { firstName: string; lastName: string } {
  const trimmed = (name || "").trim()
  const spaceIdx = trimmed.indexOf(" ")
  if (spaceIdx === -1) {
    throw new Error(
      `A contact needs a first and last name. Ask the user for ${trimmed || "the contact"}'s full name (e.g. "Ada Lovelace"), then try again.`
    )
  }
  return {
    firstName: trimmed.slice(0, spaceIdx),
    lastName: trimmed.slice(spaceIdx + 1).trim(),
  }
}

/**
 * Transforms the flat agent contact input into the nested REST payload that
 * POST /v1/recipients expects. PURE and THROWS on invalid input — callers
 * surface the thrown message to the user. Mirrors the construction in the
 * `contacts add` CLI command so the agent and CLI cannot diverge.
 */
export function buildCreateContactPayload(
  input: AgentContactInput
): CreateContactPayload {
  const type = input.type ?? "blaze"

  // No blazetag-based create path exists on POST /v1/recipients
  // (CreateRecipientDto has no blazetag field), so a Blaze-user contact cannot
  // be created via the agent. Fail loudly instead of silently dropping data.
  if (type === "blaze") {
    throw new Error(
      "Adding a Blaze-user contact by blazetag isn't supported via the agent yet. Add a bank, CLABE, or crypto contact, or use the Blaze app to save a Blaze user."
    )
  }

  if (!input.phone) {
    throw new Error(
      "A phone number is required to add a contact. Ask the user for the contact's phone number (E.164 format, e.g. +14155550123), then try again."
    )
  }

  const { firstName, lastName } = splitName(input.name)
  const category = input.category ?? "Personal"

  const payload: CreateContactPayload = {
    type: type === "crypto" ? "Stablecoin" : "Bank",
    category,
    firstName,
    lastName,
    phoneNumber: input.phone,
  }

  if (input.email) {
    payload.email = input.email
  }

  if (type === "clabe") {
    if (!input.clabe) {
      throw new Error(
        "A CLABE number is required to add a CLABE contact. Ask the user for the 18-digit CLABE, then try again."
      )
    }
    payload.bankAccountData = {
      countryId: "MX",
      accountNumber: input.clabe,
    }
    return payload
  }

  if (type === "bank") {
    if (!input.account_number) {
      throw new Error(
        "An account number is required to add a US bank contact. Ask the user for the account number, then try again."
      )
    }
    payload.bankAccountData = {
      countryId: "US",
      accountNumber: input.account_number,
      routingNumber: input.routing_number,
    }
    return payload
  }

  // type === "crypto"
  if (!input.wallet_address) {
    throw new Error(
      "A wallet address is required to add a crypto contact. Ask the user for the recipient's wallet address, then try again."
    )
  }

  // Validate the network up front — reject unknown values instead of silently
  // defaulting to Stellar (which would send to the wrong chain). Default to
  // Stellar only when network is omitted, mirroring the CLI.
  const networkKey = (input.network || "stellar").toLowerCase()
  const network = NETWORK_MAP[networkKey]
  if (!network) {
    throw new Error(
      `That network isn't supported. Pick one of: ${SUPPORTED_NETWORKS.join(", ")}, then try again.`
    )
  }

  // Fail fast: a Stellar contact is unusable without a destination memo (Bridge
  // rejects a stellar-rail destination without one, and the memo routes funds to
  // the right account). Reject here before calling the API so we never create a
  // contact that can't be paid. Mirrors the CLI's message.
  if (network === "Stellar" && !input.memo) {
    throw new Error(
      "Stellar contacts need a destination memo so your USDC reaches the right account — add one with the memo (you'll find it on the recipient's deposit details) before adding the contact."
    )
  }

  const cryptoAddressData: CreateContactCryptoAddressData = {
    address: input.wallet_address,
    network,
  }
  if (input.memo) {
    cryptoAddressData.memo = input.memo
  }
  payload.cryptoAddressData = cryptoAddressData

  return payload
}
