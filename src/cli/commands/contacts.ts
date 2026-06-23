import { Command } from "commander"
import { confirm, select } from "@inquirer/prompts"
import { getClient, getGlobalOpts, handleError, withSpinner } from "../utils"
import { formatOutput } from "../output"
import { NETWORK_MAP, SUPPORTED_NETWORKS } from "../../sdk/contact-payload"
import type {
  Contact,
  ContactBankAccount,
  ContactCryptoAddress,
  ContactWalletType,
  CreateContactCryptoAddressData,
} from "../../sdk/types"
import { estimateUsdAmount } from "../../constants/fx-rates"

// Wallet custody types accepted on the `--wallet-type` flag (Travel Rule).
const WALLET_TYPE_MAP: Record<string, ContactWalletType> = {
  "self-custodied": "SelfCustodied",
  selfcustodied: "SelfCustodied",
  hosted: "Hosted",
  external: "External",
}

// Travel Rule threshold: sends of $3,000 or more (300,000 cents) require
// beneficiary data on the crypto address (legal name + address + wallet type).
const TRAVEL_RULE_THRESHOLD_CENTS = 300_000

// Per-chain USDC minimum. $1 = 100 cents on every chain today (Bridge Route
// Explorer). Dust below the minimum is neither credited nor returned.
const CRYPTO_MINIMUM_CENTS = 100

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + "…" : str
}

// Shortens a wallet address to `0x1234…5678` form for compact display.
function shortenAddress(address: string): string {
  if (address.length <= 12) return address
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

// Formats a contact's crypto addresses as `Ethereum (0x1234…5678)` for the
// account column in `contacts list`.
function formatCryptoAddresses(addresses: ContactCryptoAddress[]): string {
  return addresses
    .map(ca => `${ca.network} (${shortenAddress(ca.address)})`)
    .join(", ")
}

// A Stablecoin/crypto contact is one whose type is Stablecoin, or which has
// crypto addresses and no usable bank account to fall back on.
function isCryptoContact(contact: Contact): boolean {
  const type = (contact.type || "").toLowerCase()
  if (type === "stablecoin" || type === "crypto") return true
  const hasCrypto = (contact.crypto_addresses || []).length > 0
  const hasBank = (contact.bank_accounts || []).length > 0
  return hasCrypto && !hasBank
}

function formatDate(iso: string | undefined): string {
  if (!iso) return "–"
  const d = new Date(iso)
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

async function resolveBankAccount(
  contact: Contact
): Promise<ContactBankAccount> {
  const accounts = contact.bank_accounts || []
  if (accounts.length === 0) {
    throw new Error(
      `Contact "${contact.first_name || contact.business_name}" has no bank accounts.`
    )
  }
  if (accounts.length === 1) return accounts[0]

  const choice = await select({
    message: `${contact.first_name || contact.business_name} has ${accounts.length} bank accounts:`,
    choices: accounts.map(a => ({
      name: `${a.bank_name || "Bank"} — ${a.currency_id || "USD"} (****${(a.account_number || "").slice(-4)})`,
      value: a.id,
    })),
  })
  const resolved = accounts.find(a => a.id === choice)
  if (!resolved) {
    throw new Error("Selected bank account not found.")
  }
  return resolved
}

async function resolveCryptoAddress(
  contact: Contact
): Promise<ContactCryptoAddress> {
  const addresses = contact.crypto_addresses || []
  if (addresses.length === 0) {
    throw new Error(
      `Contact "${contact.first_name || contact.business_name}" has no crypto addresses.`
    )
  }
  if (addresses.length === 1) return addresses[0]

  const choice = await select({
    message: `${contact.first_name || contact.business_name} has ${addresses.length} crypto addresses:`,
    choices: addresses.map(ca => ({
      name: `${ca.network} — ${shortenAddress(ca.address)}`,
      value: ca.id,
    })),
  })
  const resolved = addresses.find(ca => ca.id === choice)
  if (!resolved) {
    throw new Error("Selected crypto address not found.")
  }
  return resolved
}

// Checks whether a crypto address carries the beneficiary data the Travel Rule
// requires for sends over $3,000. The legal name is resolved separately from
// the contact's name; this validates the address-side fields.
//
// Hosted/custodial wallets additionally require a wallet-ownership attestation
// timestamp — Bridge rejects hosted beneficiaries without it. SelfCustodied and
// External (self-hosted) wallets do NOT require the attestation.
function hasTravelRuleBeneficiaryData(address: ContactCryptoAddress): boolean {
  const hasBaseBeneficiaryData = Boolean(
    address.wallet_type &&
    address.beneficiary_street_line1 &&
    address.beneficiary_city &&
    address.beneficiary_postal_code &&
    address.beneficiary_country_code
  )
  if (!hasBaseBeneficiaryData) return false

  if (address.wallet_type === "Hosted") {
    return Boolean(address.wallet_ownership_attested_at)
  }

  return true
}

// True when a crypto address is missing only the hosted-wallet attestation
// timestamp (it otherwise has complete base beneficiary data). Used to give a
// hosted recipient a precise, actionable error instead of the generic one.
function isMissingHostedAttestation(address: ContactCryptoAddress): boolean {
  return (
    address.wallet_type === "Hosted" &&
    Boolean(
      address.beneficiary_street_line1 &&
      address.beneficiary_city &&
      address.beneficiary_postal_code &&
      address.beneficiary_country_code
    ) &&
    !address.wallet_ownership_attested_at
  )
}

export function registerContactsCommands(program: Command): void {
  const contacts = program
    .command("contacts")
    .description("Manage your contacts")

  contacts
    .command("list")
    .description("List your contacts")
    .option("--search <term>", "Search by name or tag")
    .action(async (opts: { search?: string }) => {
      try {
        const globals = getGlobalOpts(program)
        const client = await getClient(globals)
        const result = await withSpinner(
          "Loading contacts…",
          () => client.listContacts({ search: opts.search }),
          { format: globals.format }
        )
        const formatted = (result.data as Contact[]).map(c => {
          const name =
            c.business_name ||
            [c.first_name, c.last_name].filter(Boolean).join(" ") ||
            "–"
          const bankAccount = c.bank_accounts
            ?.map(ba => {
              const bank = truncate(ba.bank_name || "Bank", 12)
              const last4 = (ba.account_number || "").slice(-4)
              return last4 ? `${bank} (****${last4})` : bank
            })
            .join(", ")
          const cryptoAccount = c.crypto_addresses?.length
            ? formatCryptoAddresses(c.crypto_addresses)
            : ""
          return {
            name: truncate(name, 24),
            type: c.type,
            account: bankAccount || cryptoAccount || "–",
            email: truncate(c.email || "–", 22),
            favorite: c.is_favorite ? "★" : "",
            added: formatDate(c.created_at),
          }
        })
        formatOutput(formatted, globals.format)
      } catch (err) {
        handleError(err)
      }
    })

  contacts
    .command("add")
    .description("Add a new contact")
    .requiredOption("--first-name <name>", "First name")
    .requiredOption("--last-name <name>", "Last name")
    .requiredOption("--phone <number>", "Phone number (E.164 format)")
    .option("--type <type>", "Account type: bank, clabe, crypto", "bank")
    .option("--category <cat>", "Category: Personal, Business", "Personal")
    .option("--email <email>", "Email address")
    .option("--routing-number <n>", "US routing number")
    .option("--account-number <n>", "US account number")
    .option("--clabe <n>", "CLABE (Mexico)")
    .option("--wallet-address <address>", "Crypto wallet address")
    .option(
      "--network <network>",
      `Blockchain network: ${SUPPORTED_NETWORKS.join(", ")}`
    )
    .option(
      "--memo <memo>",
      "Destination memo (provided by the recipient/exchange). Required for Stellar recipients to receive USDC."
    )
    .option(
      "--wallet-type <type>",
      "Wallet custody (Travel Rule, >$3k sends): self-custodied, hosted, external"
    )
    .option(
      "--attest-ownership",
      "Record that you attest the recipient owns this hosted/custodial wallet (sets the attestation timestamp to now). Required for hosted wallets on $3,000+ sends."
    )
    .option(
      "--wallet-attested-at <iso>",
      "Explicit wallet-ownership attestation timestamp (ISO-8601). Overrides --attest-ownership's 'now'."
    )
    .option("--street-line1 <line>", "Beneficiary street line 1 (Travel Rule)")
    .option("--street-line2 <line>", "Beneficiary street line 2 (Travel Rule)")
    .option("--city <city>", "Beneficiary city (Travel Rule)")
    .option("--state <state>", "Beneficiary state/province (Travel Rule)")
    .option("--postal-code <code>", "Beneficiary postal code (Travel Rule)")
    .option(
      "--country-code <code>",
      "Beneficiary country code, e.g. US (Travel Rule)"
    )
    .action(
      async (opts: {
        firstName: string
        lastName: string
        phone: string
        type: string
        category: string
        email?: string
        routingNumber?: string
        accountNumber?: string
        clabe?: string
        walletAddress?: string
        network?: string
        memo?: string
        walletType?: string
        attestOwnership?: boolean
        walletAttestedAt?: string
        streetLine1?: string
        streetLine2?: string
        city?: string
        state?: string
        postalCode?: string
        countryCode?: string
      }) => {
        try {
          const globals = getGlobalOpts(program)
          const client = await getClient(globals)

          const data: Record<string, unknown> = {
            type:
              opts.type === "clabe" || opts.type === "bank"
                ? "Bank"
                : "Stablecoin",
            category: opts.category,
            firstName: opts.firstName,
            lastName: opts.lastName,
            phoneNumber: opts.phone,
          }

          if (opts.email) data.email = opts.email

          if (opts.type === "clabe" && opts.clabe) {
            data.bankAccountData = {
              countryId: "MX",
              accountNumber: opts.clabe,
            }
          } else if (opts.type === "bank") {
            if (!opts.accountNumber) {
              console.error(
                "Error: --account-number is required for US bank accounts"
              )
              process.exit(1)
            }
            data.bankAccountData = {
              countryId: "US",
              accountNumber: opts.accountNumber,
              routingNumber: opts.routingNumber,
            }
          }

          if (opts.type === "crypto" && opts.walletAddress) {
            // Validate the network up front — reject unknown values instead of
            // silently defaulting to Stellar (which would send to the wrong
            // chain). Default to Stellar only when --network is omitted.
            const networkKey = (opts.network || "stellar").toLowerCase()
            const network = NETWORK_MAP[networkKey]
            if (!network) {
              console.error(
                `That network isn't supported. Pick one of: ${SUPPORTED_NETWORKS.join(", ")}, then try again.`
              )
              process.exit(1)
            }

            // Fail fast: a Stellar contact is unusable without a destination
            // memo (Bridge rejects a stellar-rail destination without one, and
            // the memo routes funds to the right account). Reject here before
            // calling the API so we never create a contact that can't be paid.
            if (network === "Stellar" && !opts.memo) {
              console.error(
                "Stellar contacts need a destination memo so your USDC reaches the right account — add one with --memo <memo> (you'll find it on the recipient's deposit details)."
              )
              process.exit(1)
            }

            const cryptoAddressData: CreateContactCryptoAddressData = {
              address: opts.walletAddress,
              network,
            }

            // Destination memo (required for Stellar recipients to receive USDC).
            if (opts.memo) cryptoAddressData.memo = opts.memo

            if (opts.walletType) {
              const walletType =
                WALLET_TYPE_MAP[
                  opts.walletType.toLowerCase().replace(/_/g, "-")
                ]
              if (!walletType) {
                console.error(
                  `That wallet type isn't recognized. Use one of: self-custodied, hosted, or external, then try again.`
                )
                process.exit(1)
              }
              cryptoAddressData.walletType = walletType
            }

            // Wallet-ownership attestation (Travel Rule, hosted/custodial
            // wallets on $3,000+ sends). An explicit --wallet-attested-at wins;
            // otherwise --attest-ownership stamps the current time. Must be a
            // deliberate flag, never auto-set, for compliance.
            if (opts.walletAttestedAt) {
              const attestedAt = new Date(opts.walletAttestedAt)
              if (Number.isNaN(attestedAt.getTime())) {
                console.error(
                  `That --wallet-attested-at value isn't a valid date. Use an ISO-8601 timestamp, e.g. 2026-06-17T00:00:00Z, then try again.`
                )
                process.exit(1)
              }
              cryptoAddressData.walletOwnershipAttestedAt =
                attestedAt.toISOString()
            } else if (opts.attestOwnership) {
              cryptoAddressData.walletOwnershipAttestedAt =
                new Date().toISOString()
            }

            if (opts.streetLine1)
              cryptoAddressData.beneficiaryStreetLine1 = opts.streetLine1
            if (opts.streetLine2)
              cryptoAddressData.beneficiaryStreetLine2 = opts.streetLine2
            if (opts.city) cryptoAddressData.beneficiaryCity = opts.city
            if (opts.state)
              cryptoAddressData.beneficiaryStateProvince = opts.state
            if (opts.postalCode)
              cryptoAddressData.beneficiaryPostalCode = opts.postalCode
            if (opts.countryCode)
              cryptoAddressData.beneficiaryCountryCode = opts.countryCode

            data.cryptoAddressData = cryptoAddressData
          }

          const result = await client.createContact(data)
          if (globals.format === "json") {
            formatOutput(result, "json")
          } else {
            console.log(
              `\n${opts.firstName} ${opts.lastName} has been added to your contacts.\n`
            )
          }
        } catch (err) {
          handleError(err)
        }
      }
    )

  contacts
    .command("pay <nameOrId>")
    .description(
      "Pay a contact's bank account or crypto wallet (accepts name or ID)"
    )
    .requiredOption("--amount <n>", "Amount to send", parseFloat)
    .option(
      "--currency <code>",
      "Currency code (inferred from bank account if omitted)"
    )
    .option("--bank-account-id <id>", "Bank account ID (prompts if multiple)")
    .option(
      "--crypto-address-id <id>",
      "Crypto address ID for a Stablecoin contact (prompts if multiple)"
    )
    .option("--note <note>", "Optional payment note")
    .option("-y, --yes", "Skip confirmation prompt")
    .action(
      async (
        nameOrId: string,
        opts: {
          amount: number
          currency?: string
          bankAccountId?: string
          cryptoAddressId?: string
          note?: string
          yes?: boolean
        }
      ) => {
        try {
          const globals = getGlobalOpts(program)
          const client = await getClient(globals)

          let contact: Contact
          const isCuid = /^c[a-z0-9]{24}$/.test(nameOrId)

          if (isCuid) {
            contact = await client.getContact(nameOrId)
          } else {
            const result = await client.listContacts({ search: nameOrId })
            const contacts = result.data
            if (contacts.length === 0) {
              console.error(`No contacts found matching "${nameOrId}"`)
              process.exit(1)
            }
            if (contacts.length === 1) {
              contact = contacts[0]
            } else {
              const choice = await select({
                message: `Multiple contacts match "${nameOrId}":`,
                choices: contacts.map(c => ({
                  name: `${c.first_name || ""} ${c.last_name || c.business_name || ""} — ${c.bank_accounts?.[0]?.bank_name || c.type}`,
                  value: c.id,
                })),
              })
              contact = contacts.find(c => c.id === choice)!
            }
          }

          const displayName = contact.first_name
            ? `${contact.first_name} ${contact.last_name || ""}`.trim()
            : contact.business_name || "your contact"

          // Route Stablecoin/crypto contacts down the crypto path; only real
          // Bank contacts reach the bank-account resolution (and its
          // "no bank accounts" error) below.
          if (isCryptoContact(contact)) {
            await payCryptoContact({
              client,
              contact,
              displayName,
              amount: opts.amount,
              cryptoAddressId: opts.cryptoAddressId,
              note: opts.note,
              yes: opts.yes,
              format: globals.format,
            })
            return
          }

          let bankAccount: ContactBankAccount
          if (opts.bankAccountId) {
            const found = (contact.bank_accounts || []).find(
              a => a.id === opts.bankAccountId
            )
            if (!found) {
              console.error(
                `Bank account ID "${opts.bankAccountId}" not found on this contact.`
              )
              process.exit(1)
            }
            bankAccount = found
          } else {
            bankAccount = await resolveBankAccount(contact)
          }

          const currency = (
            opts.currency ||
            bankAccount.currency_id ||
            "USD"
          ).toUpperCase()

          let conversionNote = ""
          let usdcAmountInCents: number
          if (currency !== "USD" && currency !== "USDC") {
            const estimatedUsd = estimateUsdAmount(opts.amount, currency)
            usdcAmountInCents = Math.round(estimatedUsd * 100)
            conversionNote = ` (~$${estimatedUsd.toFixed(2)} USD from your balance)`
          } else {
            usdcAmountInCents = Math.round(opts.amount * 100)
          }

          // Balance pre-check
          const balance = await client.getBalance()
          const availableCents =
            typeof balance.available === "object"
              ? balance.available.amount
              : balance.available
          if (availableCents < usdcAmountInCents) {
            console.error(
              `Insufficient balance. You have $${(availableCents / 100).toFixed(2)} available but this requires ~$${(usdcAmountInCents / 100).toFixed(2)}.`
            )
            process.exit(1)
          }

          const minimumAmount = getMinimumTransferAmount(currency)
          if (opts.amount < minimumAmount) {
            console.error(
              `Minimum transfer amount for ${currency} is ${minimumAmount} ${currency}. You requested ${opts.amount} ${currency}.`
            )
            process.exit(1)
          }

          const accountLabel = `${bankAccount.bank_name || "Bank"} (****${(bankAccount.account_number || "").slice(-4)})`

          if (!opts.yes) {
            const confirmed = await confirm({
              message: `Pay ${opts.amount} ${currency}${conversionNote} to ${displayName} — ${accountLabel}?`,
            })
            if (!confirmed) {
              console.log("Cancelled.")
              return
            }
          }

          try {
            const result = await client.payContact(contact.id, bankAccount.id, {
              amount: opts.amount,
              currencyId: currency,
              usdcAmountInCents,
              note: opts.note,
            })
            if (globals.format === "json") {
              formatOutput(result, "json")
            } else {
              const noteClause = opts.note
                ? ` with the note "${opts.note}"`
                : ""
              const debitClause = conversionNote
                ? ` ${conversionNote.trim()}`
                : ""
              console.log(
                `\nYour payment of ${opts.amount} ${currency} to ${displayName} (${accountLabel}) has been submitted${noteClause}.${debitClause}\n`
              )
            }
          } catch (err: unknown) {
            reportPaymentError(err)
            process.exit(1)
          }
        } catch (err) {
          handleError(err)
        }
      }
    )

  contacts
    .command("remove <id>")
    .description("Remove a contact")
    .option("-y, --yes", "Skip confirmation prompt")
    .action(async (id: string, opts: { yes?: boolean }) => {
      try {
        if (!opts.yes) {
          const confirmed = await confirm({
            message: `Remove contact ${id}?`,
          })
          if (!confirmed) {
            console.log("Cancelled.")
            return
          }
        }
        const globals = getGlobalOpts(program)
        const client = await getClient(globals)
        await client.deleteContact(id)
        console.log("\nContact removed.\n")
      } catch (err) {
        handleError(err)
      }
    })
}

const BRIDGE_TRANSFER_MINIMUMS_LOCAL: Record<string, number> = {
  USD: 1,
  MXN: 50,
  BRL: 10,
  EUR: 5,
  GBP: 5,
}

function getMinimumTransferAmount(currency: string): number {
  return BRIDGE_TRANSFER_MINIMUMS_LOCAL[currency.toUpperCase()] || 5
}

// Maps a payment API error to a friendly console message. Shared by the bank
// and crypto pay paths so both surface the same guidance.
function reportPaymentError(err: unknown): void {
  const error = err as {
    message?: string
    statusCode?: number
    status?: number
  }
  const code = error?.statusCode || error?.status
  // Surface the server's human-readable pre-check message as a friendly
  // sentence. The backend may reject with 400 (validation) or 422 (business
  // rule) — both carry a usable message — so treat them the same.
  if (code === 402) {
    console.error(
      error?.message
        ? `Insufficient balance. ${error.message}`
        : "Insufficient balance. Check with: blaze balance"
    )
  } else if (code === 400 || code === 422) {
    console.error(`Payment rejected: ${error.message}`)
  } else if (code === 429) {
    console.error("Rate limited. Please wait a moment and try again.")
  } else {
    // Strip any leading "HTTP NNN:" so 5xx errors read as a plain sentence.
    const message = (error?.message ?? String(err)).replace(/^HTTP \d+:\s*/, "")
    console.error(`Payment failed: ${message}`)
  }
}

/**
 * Sends USDC to a Stablecoin contact's crypto wallet.
 *
 * Crypto sends move USDC 1:1 with no fiat conversion. The amount is the USDC
 * amount in major units (e.g. `5` = 5 USDC). Enforces the per-chain minimum
 * ($1 USDC; dust below it is neither credited nor returned) and the Travel
 * Rule beneficiary requirement for sends over $3,000 BEFORE submitting, since
 * on-chain sends are irreversible.
 */
async function payCryptoContact(args: {
  client: Awaited<ReturnType<typeof getClient>>
  contact: Contact
  displayName: string
  amount: number
  cryptoAddressId?: string
  note?: string
  yes?: boolean
  format?: string
}): Promise<void> {
  const { client, contact, displayName, amount, note } = args

  let cryptoAddress: ContactCryptoAddress
  if (args.cryptoAddressId) {
    const found = (contact.crypto_addresses || []).find(
      ca => ca.id === args.cryptoAddressId
    )
    if (!found) {
      console.error(
        `Crypto address ID "${args.cryptoAddressId}" not found on this contact.`
      )
      process.exit(1)
    }
    cryptoAddress = found
  } else {
    cryptoAddress = await resolveCryptoAddress(contact)
  }

  // Crypto sends are denominated in USDC (1:1 with USD). value is in cents.
  const usdcAmountInCents = Math.round(amount * 100)

  // Per-chain minimum: dust below $1 USDC is neither credited nor returned.
  if (usdcAmountInCents < CRYPTO_MINIMUM_CENTS) {
    console.error(
      `Minimum crypto send is $${(CRYPTO_MINIMUM_CENTS / 100).toFixed(2)} USDC. You requested $${amount.toFixed(2)} USDC — amounts below the minimum are lost on-chain.`
    )
    process.exit(1)
  }

  // Travel Rule: sends of $3,000 or more require beneficiary data on the
  // address. Hosted/custodial wallets additionally require an ownership
  // attestation — give those a precise re-add instruction.
  if (
    usdcAmountInCents >= TRAVEL_RULE_THRESHOLD_CENTS &&
    !hasTravelRuleBeneficiaryData(cryptoAddress)
  ) {
    if (isMissingHostedAttestation(cryptoAddress)) {
      console.error(
        `This recipient's wallet is hosted/custodial and needs an ownership attestation to send $3,000 or more.\n` +
          `Re-add the contact with: blaze contacts add ... --type crypto --wallet-type hosted --attest-ownership --street-line1 <...> --city <...> --postal-code <...> --country-code <...>`
      )
    } else {
      console.error(
        `This recipient needs beneficiary details to send $3,000 or more: add legal name, address, and wallet type.\n` +
          `Update the contact with: blaze contacts add ... --type crypto --wallet-type <type> --street-line1 <...> --city <...> --postal-code <...> --country-code <...>`
      )
    }
    process.exit(1)
  }

  // Balance pre-check.
  const balance = await client.getBalance()
  const availableCents =
    typeof balance.available === "object"
      ? balance.available.amount
      : balance.available
  if (availableCents < usdcAmountInCents) {
    console.error(
      `Insufficient balance. You have $${(availableCents / 100).toFixed(2)} available but this requires $${(usdcAmountInCents / 100).toFixed(2)}.`
    )
    process.exit(1)
  }

  const accountLabel = `${cryptoAddress.network} (${shortenAddress(cryptoAddress.address)})`

  if (!args.yes) {
    const confirmed = await confirm({
      message: `Send ${amount} USDC to ${displayName} — ${accountLabel}? Crypto sends are irreversible and can't be cancelled once submitted.`,
    })
    if (!confirmed) {
      console.log("Cancelled.")
      return
    }
  }

  try {
    const result = await client.payContactCrypto(contact.id, cryptoAddress.id, {
      usdcAmountInCents,
      amount,
      note,
    })
    if (args.format === "json") {
      formatOutput(result, "json")
    } else {
      const noteClause = note ? ` with the note "${note}"` : ""
      console.log(
        `\nYour crypto send of ${amount} USDC to ${displayName} on ${accountLabel} has been submitted${noteClause}. Crypto sends are irreversible and usually settle on-chain within about 30 minutes.\n`
      )
    }
  } catch (err: unknown) {
    reportPaymentError(err)
    process.exit(1)
  }
}
