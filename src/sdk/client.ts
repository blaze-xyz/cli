import {
  BlazeError,
  BlazeAuthenticationError,
  BlazePermissionError,
  BlazeNotFoundError,
  BlazeValidationError,
  BlazeRateLimitError,
  BlazeServerError,
  BlazeNetworkError,
} from "./errors"
import {
  MAX_RETRIES,
  backoff,
  isNetworkRetryable,
  isRetryableStatus,
  sleep,
} from "./retry"
import { randomUUID } from "node:crypto"
import type {
  Balance,
  PaginatedList,
  Customer,
  CreateCustomerInput,
  UpdateCustomerInput,
  ListCustomersParams,
  ExternalAccount,
  CreateExternalAccountInput,
  Transfer,
  CreateTransferInput,
  ListTransfersParams,
  Withdrawal,
  CreateWithdrawalInput,
  ListWithdrawalsParams,
  PaymentLink,
  CreatePaymentLinkInput,
  UpdatePaymentLinkInput,
  ListPaymentLinksParams,
  VirtualAccount,
  CreateVirtualAccountInput,
  ListVirtualAccountsParams,
  Transaction,
  ListTransactionsParams,
  ApiKey,
  ApiKeyWithSecret,
  CreateApiKeyInput,
  UpdateApiKeyScopesInput,
  TeamMember,
  InviteTeamMemberInput,
  UpdateMemberRoleInput,
  TransferOwnershipInput,
  Webhook,
  WebhookWithSecret,
  CreateWebhookInput,
  UpdateWebhookInput,
  ListWebhooksParams,
  AnalyticsOverview,
  AnalyticsPeriod,
  Dispute,
  ListDisputesParams,
  SubmitDisputeEvidenceInput,
  Invoice,
  CreateInvoiceInput,
  ListInvoicesParams,
  Subscription,
  CreateSubscriptionInput,
  ListSubscriptionsParams,
  FxRates,
  FxQuote,
  Contact,
  ListContactsParams,
  TransferResponse,
  UserSearchResult,
  SendPaymentInput,
  PaymentResult,
  PaginatedListWithCount,
  SpendingSummary,
  BankTransaction,
  ListBankTransactionsParams,
  BankBalances,
  InsightsDateRangeParams,
  DuplicateScanParams,
  DuplicateScanResult,
  DuplicateCheckParams,
  DuplicateCheckResult,
  CashFlowForecast,
  ScenarioAdjustment,
  ScenarioResult,
  BankReconciliationParams,
  ReconciliationResult,
  ReconcileAccountsParams,
  AccountingReconciliationResult,
  Product,
  CreateProductInput,
  UpdateProductInput,
  ListProductsParams,
  Coupon,
  CreateCouponInput,
  UpdateCouponInput,
  ListCouponsParams,
  ValidateCouponInput,
  ValidateCouponResult,
  ConnectedPaymentMethod,
  ConnectedPaymentMethodsResult,
  WithdrawToPaymentMethodInput,
  WithdrawAccountResult,
  RampTransferStatusResult,
  WithdrawalLimits,
  ApplicableFee,
} from "./types"

// ============================================
// Consumer withdrawal GraphQL operations (withdraw own balance to own
// connected payment method). Module-level query strings in
// SCREAMING_SNAKE_CASE, mirroring the bills command convention.
// ============================================

// `mode: Withdraw` is an UNQUOTED GraphQL enum literal — a quoted string errors.
// Every selected field is verified against the live UserPaymentMethod type.
const CONNECTED_PAYMENT_METHODS_QUERY = `
  query ConnectedPaymentMethods {
    me {
      id
      paymentMethods {
        id
        type
        displayName
        nickname
        maskedAccountNumber
        canDeposit
        canWithdraw
        withdrawIneligibilityReason
        disbursementEligible
        isDefault
        rampVerificationStatus
        provider { id name }
        card { id lastFour brand }
        binData { isPrepaid type }
      }
      defaultWithdrawalMethod: defaultPaymentMethod(mode: Withdraw) { id }
      defaultResidence { country { code } }
    }
  }
`

// The @Public `applicableFee` query — the SAME fee calculation the mobile app's
// `useFeeDisplay` uses to preview a withdrawal fee BEFORE the irreversible
// mutation. Read-only; never moves money. `operationType` is the unquoted
// GraphQL enum the input expects ("Withdrawal").
const APPLICABLE_FEE_QUERY = `
  query ApplicableWithdrawalFee($input: ApplicableFeeInput!) {
    applicableFee(input: $input) {
      configId
      displayName
      flatFeeCents
      percentageFeeCents
      percentageRate
      totalFeeCents
      minFeeCents
    }
  }
`

// Irreversible money movement — must NEVER be retried (graphqlRequest does not
// retry). The CLI additionally selects `rampTransferId` (the app omits it) so
// the status can be polled.
const WITHDRAW_ACCOUNT_MUTATION = `
  mutation Withdraw($input: WithdrawInput!) {
    withdrawAccount(input: $input) {
      status
      message
      jobId
      rampTransferId
    }
  }
`

// `Amount` exposes `value` (cents) + `currency { code }` — NOT `amount`/
// `currencyCode`. An invalid field would error the whole query.
const RAMP_TRANSFER_QUERY = `
  query RampTransfer($id: ID!) {
    rampTransfer(id: $id) {
      id
      type
      status
      isInstant
      createdAt
      expectedAt
      fiatAmount { value currency { code } }
      usdcAmount { value currency { code } }
      paymentMethod { id displayName type }
      feeCollections { amountCents displayName collectionMethod feeType }
    }
  }
`

// Live consumer exchange-rate mutation — works with the bearer token. Returns
// the RATE (the `amount` value doesn't change the result). Read-only despite
// being a GraphQL mutation; never moves money. Used to suggest an accurate
// local-currency minimum (the static USD_RATES table lags the live rate).
const EXCHANGE_RATE_QUERY = `
  mutation GetExchangeRate($input: ExchangeRateInput!) {
    getExchangeRate(input: $input)
  }
`

// Mirrors the mobile app's `checkLimits` query — the authoritative source for
// the withdrawal minimum and per-user limit. Read-only; never mutates. Used to
// pre-check BEFORE the irreversible `withdrawAccount` mutation so we never
// hardcode the minimum client-side.
const CHECK_LIMITS_QUERY = `
  query CheckLimits($input: CheckLimitsInput!) {
    checkLimits(input: $input) {
      isUnderLimit
      meetsMinimum
      minimumAmountCents
      limit { amount currency { code } }
      remaining { amount currency { code } }
    }
  }
`

/**
 * Reads a numeric `Retry-After` header (seconds) from a fetch Response, if
 * present. Defensive against test mocks that omit a real `headers` object.
 */
function parseRetryAfter(res: Response): number | undefined {
  const headers = (res as { headers?: { get?: (k: string) => string | null } })
    .headers
  const raw = headers?.get?.("retry-after")
  if (!raw) return undefined
  const seconds = Number(raw)
  return Number.isFinite(seconds) ? seconds : undefined
}

export interface BlazeClientOptions {
  apiKey?: string
  bearerToken?: string
  baseUrl?: string
  defaultHeaders?: Record<string, string>
}

export class BlazeClient {
  private apiKey: string | undefined
  private bearerToken: string | undefined
  private baseUrl: string
  private defaultHeaders: Record<string, string>

  constructor(opts: BlazeClientOptions) {
    if (!opts.apiKey && !opts.bearerToken) {
      throw new Error("BlazeClient requires either apiKey or bearerToken")
    }
    this.apiKey = opts.apiKey
    this.bearerToken = opts.bearerToken
    this.baseUrl = opts.baseUrl ?? "https://api.blaze.money"
    // Copy so we never mutate the caller's object when defaulting headers below.
    this.defaultHeaders = { ...(opts.defaultHeaders ?? {}) }

    // A bearer token is a personal (consumer) session — see `authContext`. If a
    // bearer-authed request is sent with NO `x-business-id` header, the server's
    // TenantContextMiddleware auto-selects the user's first business membership,
    // classifies the request as "business", and the ConsumerOnlyGuard returns
    // 403 on every consumer endpoint — locking business owners out of all
    // personal endpoints. Defaulting to `x-blaze-personal` here keeps the
    // consumer context unless a business was explicitly selected. We only set it
    // when neither header was already provided so an explicit business/personal
    // choice is never clobbered. This applies ONLY to bearer clients; API keys
    // are business-scoped and the server resolves the business from the key.
    if (
      this.bearerToken &&
      this.defaultHeaders["x-business-id"] === undefined &&
      this.defaultHeaders["x-blaze-personal"] === undefined
    ) {
      this.defaultHeaders["x-blaze-personal"] = "true"
    }
  }

  /**
   * Which account context this client is authenticated as. A bearer token is a
   * personal (consumer) session; an API key is always business-scoped. The
   * agent uses this to route to context-appropriate tools (e.g. P2P payments
   * and contact/user search are consumer-only; customers/bills/transfers are
   * business-only) instead of calling a tool the server will reject.
   */
  get authContext(): "consumer" | "business" {
    return this.bearerToken ? "consumer" : "business"
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...this.defaultHeaders,
    }
    if (this.bearerToken) {
      headers["Authorization"] = `Bearer ${this.bearerToken}`
    } else if (this.apiKey) {
      headers["X-API-Key"] = this.apiKey
    }

    // Retry is gated on idempotent GETs only. POST/PATCH/PUT/DELETE (transfers,
    // withdrawals, send-payment, bill-pay, etc.) are NEVER retried so a partial
    // success can't be silently duplicated.
    const canRetry = method === "GET"

    // attempt 0 is the first try; up to MAX_RETRIES additional attempts.
    for (let attempt = 0; ; attempt++) {
      let res: Response
      try {
        res = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        })
      } catch (err) {
        // Network-layer failure (fetch rejected before any response).
        if (canRetry && attempt < MAX_RETRIES && isNetworkRetryable(err)) {
          await sleep(backoff(attempt))
          continue
        }
        const code =
          typeof err === "object" && err !== null
            ? (err as { code?: string }).code
            : undefined
        throw new BlazeNetworkError(
          err instanceof Error ? err.message : "Network error",
          code
        )
      }

      if (!res.ok) {
        // Transient HTTP failures (429 / 5xx) are retried on GETs.
        if (
          canRetry &&
          attempt < MAX_RETRIES &&
          isRetryableStatus(res.status)
        ) {
          const retryAfter = parseRetryAfter(res)
          await sleep(backoff(attempt, retryAfter))
          continue
        }

        const errorBody = (await res.json().catch(() => ({}))) as Record<
          string,
          unknown
        >
        const rawMsg = errorBody.message
        const msg =
          typeof rawMsg === "string"
            ? rawMsg
            : rawMsg
              ? JSON.stringify(rawMsg)
              : undefined
        switch (res.status) {
          case 401:
            throw new BlazeAuthenticationError(msg ?? "Authentication failed")
          case 403:
            throw new BlazePermissionError(msg ?? "Insufficient permissions")
          case 404:
            throw new BlazeNotFoundError(msg ?? "Resource not found")
          case 400:
            throw new BlazeValidationError(
              msg ?? "Validation failed",
              errorBody.errors as Record<string, string[]>
            )
          case 429:
            throw new BlazeRateLimitError(msg ?? "Rate limit exceeded")
          default:
            throw new BlazeServerError(
              `HTTP ${res.status}: ${msg ?? res.statusText}`,
              res.status
            )
        }
      }

      if (res.status === 204 || res.headers?.get("content-length") === "0") {
        return undefined as T
      }

      const json = (await res.json()) as Record<string, unknown>
      // List responses have { object: "list", data: [...] } at top level — return as-is.
      // Single-object responses are wrapped in { data: {...} } — unwrap.
      if (json.object === "list") {
        return json as T
      }
      return (json.data ?? json) as T
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private buildQuery(params?: Record<string, any>): string {
    if (!params) return ""
    const searchParams = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        searchParams.set(key, String(value))
      }
    }
    const qs = searchParams.toString()
    return qs ? `?${qs}` : ""
  }

  // Generic HTTP helpers for endpoints not covered by typed methods
  async get<T = unknown>(path: string): Promise<T> {
    return this.request<T>("GET", path)
  }

  // ============================================
  // Bills (AP automation) — thin wrappers over graphqlRequest
  // ============================================

  async listBills(params: Record<string, unknown> = {}) {
    const q = `query ($status: BusinessBillStatus, $vendorId: ID, $dueBefore: DateTime, $limit: Int, $cursor: String) {
      businessBills(status: $status, vendorId: $vendorId, dueBefore: $dueBefore, limit: $limit, cursor: $cursor) {
        nodes { id invoiceNumber amountInMinorUnits currencyCode dueDate status source extractionConfidence bankFieldsChanged vendor { id name } }
        pageInfo { hasNextPage endCursor totalCount }
      }
    }`
    const data = await this.graphqlRequest<{ businessBills: unknown }>(
      q,
      params
    )
    return data.businessBills
  }

  async getBill(id: string) {
    const q = `query ($id: ID!) { businessBill(id: $id) {
      id invoiceNumber amountInMinorUnits currencyCode issueDate dueDate
      source status version requiresApproval bankFieldsChanged
      extractionConfidence extractionModelUsed
      vendor { id name primaryEmailDomain defaultRoutingNumber defaultAccountLast4 defaultBankName verifiedAt }
      lineItems { id description quantity unitPriceInMinorUnits amountInMinorUnits ordinal }
      payments { id status leg1Provider leg2Provider createdAt }
    } }`
    const data = await this.graphqlRequest<{ businessBill: unknown }>(q, { id })
    return data.businessBill
  }

  async createManualBill(input: Record<string, unknown>) {
    const q = `mutation ($input: CreateManualBusinessBillInput!) {
      createManualBusinessBill(input: $input) {
        id status amountInMinorUnits currencyCode dueDate vendor { id name }
      }
    }`
    const data = await this.graphqlRequest<{
      createManualBusinessBill: unknown
    }>(q, { input })
    return data.createManualBusinessBill
  }

  async approveBill(id: string) {
    const q = `mutation ($id: ID!) { approveBusinessBill(id: $id) { id status approvedAt } }`
    const data = await this.graphqlRequest<{ approveBusinessBill: unknown }>(
      q,
      {
        id,
      }
    )
    return data.approveBusinessBill
  }

  async rejectBill(id: string, reason?: string) {
    const q = `mutation ($id: ID!, $reason: String) { rejectBusinessBill(id: $id, reason: $reason) { id status rejectionReason } }`
    const data = await this.graphqlRequest<{ rejectBusinessBill: unknown }>(q, {
      id,
      reason,
    })
    return data.rejectBusinessBill
  }

  async quoteBillPayment(input: Record<string, unknown>) {
    const q = `mutation ($input: QuoteBusinessBillPaymentInput!) {
      quoteBusinessBillPayment(input: $input) {
        id billId leg1Provider leg1FeeInMinorUnits leg2Provider leg2FeeInMinorUnits totalFeeInMinorUnits etaBusinessDays expiresAt
      }
    }`
    const data = await this.graphqlRequest<{
      quoteBusinessBillPayment: unknown
    }>(q, { input })
    return data.quoteBusinessBillPayment
  }

  async payBill(input: Record<string, unknown>) {
    const q = `mutation ($input: PayBusinessBillInput!) {
      payBusinessBill(input: $input) {
        id billId status leg1Provider leg2Provider createdAt
      }
    }`
    const data = await this.graphqlRequest<{ payBusinessBill: unknown }>(q, {
      input,
    })
    return data.payBusinessBill
  }

  async listVendors(params: Record<string, unknown> = {}) {
    const q = `query ($limit: Int, $cursor: String) {
      businessVendors(limit: $limit, cursor: $cursor) {
        id name primaryEmailDomain defaultAccountLast4 verifiedAt
      }
    }`
    const data = await this.graphqlRequest<{ businessVendors: unknown }>(
      q,
      params
    )
    return data.businessVendors
  }

  async getVendor(id: string) {
    const q = `query ($id: ID!) { businessVendor(id: $id) {
      id name primaryEmailDomain knownEmailDomains defaultRoutingNumber defaultAccountLast4 defaultBankName verifiedAt
    } }`
    const data = await this.graphqlRequest<{ businessVendor: unknown }>(q, {
      id,
    })
    return data.businessVendor
  }

  async generateGmailAuthUrl() {
    const q = `mutation { generateGmailAuthUrl { id status authUrl expiresAt } }`
    const data = await this.graphqlRequest<{
      generateGmailAuthUrl: unknown
    }>(q)
    return data.generateGmailAuthUrl
  }

  async getGmailConnectSession(sessionId: string) {
    const q = `query ($sessionId: ID!) { gmailConnectSession(sessionId: $sessionId) {
      id status authUrl errorMessage expiresAt integration { id gmailAddress status }
    } }`
    const data = await this.graphqlRequest<{
      gmailConnectSession: unknown
    }>(q, { sessionId })
    return data.gmailConnectSession
  }

  async listGmailIntegrations() {
    const q = `query { businessGmailIntegrations { id gmailAddress status lastSyncedAt lastSyncError createdAt } }`
    const data = await this.graphqlRequest<{
      businessGmailIntegrations: unknown
    }>(q)
    return data.businessGmailIntegrations
  }

  async triggerGmailSync(integrationId?: string) {
    const q = `mutation ($integrationId: ID) { triggerBusinessGmailSync(integrationId: $integrationId) }`
    const data = await this.graphqlRequest<{
      triggerBusinessGmailSync: boolean
    }>(q, { integrationId })
    return data.triggerBusinessGmailSync
  }

  async listPendingBillApprovals() {
    const q = `query { businessBillPendingApprovals {
      id resourceType resourceId reason policyRuleFired paymentIntent status expiresAt createdAt
    } }`
    const data = await this.graphqlRequest<{
      businessBillPendingApprovals: unknown
    }>(q)
    return data.businessBillPendingApprovals
  }

  async approveBillApprovalRequest(id: string) {
    const q = `mutation ($id: ID!) { approveBusinessBillApprovalRequest(id: $id) { id status } }`
    const data = await this.graphqlRequest<{
      approveBusinessBillApprovalRequest: unknown
    }>(q, { id })
    return data.approveBusinessBillApprovalRequest
  }

  async rejectBillApprovalRequest(id: string, reason?: string) {
    const q = `mutation ($id: ID!, $reason: String) { rejectBusinessBillApprovalRequest(id: $id, reason: $reason) { id status } }`
    const data = await this.graphqlRequest<{
      rejectBusinessBillApprovalRequest: unknown
    }>(q, { id, reason })
    return data.rejectBusinessBillApprovalRequest
  }

  async listBillsActivityLog(params: Record<string, unknown> = {}) {
    const q = `query ($category: String, $resourceId: ID, $limit: Int) {
      businessActivityLog(category: $category, resourceId: $resourceId, limit: $limit) {
        id category actorType outcome message resourceType resourceId policyRule createdAt
      }
    }`
    const data = await this.graphqlRequest<{ businessActivityLog: unknown }>(
      q,
      params
    )
    return data.businessActivityLog
  }

  // ============================================
  // Consumer withdrawals — withdraw own balance to own connected method.
  // Mirrors the mobile app's `withdrawAccount` flow. Consumer/bearer context
  // only (the mutation reads userId from the JWT; an API-key/business context
  // would be rejected). Distinct from the business `createWithdrawal` above.
  // ============================================

  /**
   * Lists the authenticated user's connected payment methods (banks/cards) and
   * their default withdrawal method id. Does NOT filter — callers filter on
   * `canWithdraw === true` to find valid withdrawal destinations.
   */
  async listConnectedPaymentMethods(): Promise<ConnectedPaymentMethodsResult> {
    const data = await this.graphqlRequest<{
      me: {
        id: string
        paymentMethods: ConnectedPaymentMethod[]
        defaultWithdrawalMethod?: { id: string } | null
        defaultResidence?: { country?: { code?: string | null } | null } | null
      }
    }>(CONNECTED_PAYMENT_METHODS_QUERY)
    return {
      methods: data.me.paymentMethods,
      defaultWithdrawalMethodId: data.me.defaultWithdrawalMethod?.id ?? null,
      countryCode: data.me.defaultResidence?.country?.code ?? null,
    }
  }

  /**
   * Previews the exact withdrawal fee via the @Public `applicableFee` query —
   * the SAME calculation the mobile app's `useFeeDisplay` shows. Read-only; no
   * money moves. `amountCents` is the USD/USDC amount (`usdcAmountInCents`).
   * Returns null when the server returns no fee config for the inputs. Callers
   * should treat this as best-effort — the exact fee is written to the transfer
   * at submit time regardless.
   */
  async getApplicableWithdrawalFee(input: {
    paymentMethodType: string
    providerId?: string | null
    countryCode?: string | null
    amountCents: number
  }): Promise<ApplicableFee | null> {
    const data = await this.graphqlRequest<{
      applicableFee: ApplicableFee | null
    }>(APPLICABLE_FEE_QUERY, {
      input: {
        paymentMethodType: input.paymentMethodType,
        providerId: input.providerId ?? null,
        countryCode: input.countryCode ?? null,
        operationType: "Withdrawal",
        amountCents: input.amountCents,
      },
    })
    return data.applicableFee ?? null
  }

  /**
   * Pre-checks a withdrawal against the server's authoritative minimum and
   * per-user limit via the same `checkLimits` query the mobile app uses. The
   * minimum is server-sourced (currently $5.00 USD-equivalent) — never
   * hardcode it. Read-only; safe to call before the irreversible mutation.
   * The server STILL enforces minimums/limits on submit, so callers should
   * treat this as best-effort and proceed on a thrown error.
   */
  async checkWithdrawalLimits(input: {
    paymentMethodId: string
    fiatAmountInCents: number
    currencyCode: string
  }): Promise<WithdrawalLimits> {
    const data = await this.graphqlRequest<{
      checkLimits: {
        isUnderLimit: boolean
        meetsMinimum: boolean
        minimumAmountCents: number
        limit?: { amount: number } | null
        remaining?: { amount: number } | null
      }
    }>(CHECK_LIMITS_QUERY, {
      input: {
        amountEntered: {
          amount: input.fiatAmountInCents,
          scale: 2,
          currency: {
            code: input.currencyCode.toUpperCase(),
            base: 10,
            exponent: 2,
          },
        },
        type: "Withdrawal",
        paymentMethodId: input.paymentMethodId,
      },
    })
    const c = data.checkLimits
    return {
      meetsMinimum: c.meetsMinimum,
      minimumAmountCents: c.minimumAmountCents,
      isUnderLimit: c.isUnderLimit,
      limitUsdCents: c.limit?.amount ?? null,
      remainingUsdCents: c.remaining?.amount ?? null,
    }
  }

  /**
   * Live consumer exchange rate: 1 unit of `from` = N units of `to`.
   * e.g. getExchangeRate("MXN", "USD") → ~0.0567. Used to suggest an accurate
   * local minimum (the static USD_RATES table lags the live rate). Read-only.
   */
  async getExchangeRate(from: string, to: string): Promise<number> {
    const data = await this.graphqlRequest<{ getExchangeRate: number }>(
      EXCHANGE_RATE_QUERY,
      { input: { from: from.toUpperCase(), to: to.toUpperCase(), amount: 1 } }
    )
    return data.getExchangeRate
  }

  /**
   * Withdraws the user's own balance to their own connected payment method.
   *
   * IRREVERSIBLE money movement. This is NOT retried (graphqlRequest performs
   * no retries) so a partial success can never be silently duplicated. Amount
   * derivation (`usdcAmountInCents`/`fiatAmountInCents`) is the caller's
   * responsibility — see the withdrawals command. The server enforces
   * eligibility/limits and returns a human-readable message on rejection;
   * surface it verbatim.
   */
  async withdrawToPaymentMethod(
    input: WithdrawToPaymentMethodInput
  ): Promise<WithdrawAccountResult> {
    const data = await this.graphqlRequest<{
      withdrawAccount: WithdrawAccountResult
    }>(WITHDRAW_ACCOUNT_MUTATION, { input })
    // Null-result guard: a successful HTTP/GraphQL response with no
    // `withdrawAccount` payload means we can't confirm the withdrawal landed.
    // It is irreversible and never retried, so surface a clear message telling
    // the user to check recent activity before trying again.
    if (!data.withdrawAccount) {
      throw new BlazeServerError(
        "Your withdrawal didn't return a result. Check your recent activity before retrying — it may already be processing."
      )
    }
    return data.withdrawAccount
  }

  /**
   * Fetches the status of a withdrawal (RampTransfer) by id. Auth-required but
   * not super-admin — a normal user can poll their own returned transfer id.
   */
  async getRampTransfer(id: string): Promise<RampTransferStatusResult> {
    let data: { rampTransfer: RampTransferStatusResult }
    try {
      data = await this.graphqlRequest<{
        rampTransfer: RampTransferStatusResult
      }>(RAMP_TRANSFER_QUERY, { id })
    } catch (err) {
      // graphqlRequest already throws typed BlazeErrors for network/HTTP/auth
      // failures — re-throw those unchanged. For a GraphQL-level error on a
      // valid request, the id not resolving to a RampTransfer surfaces as a
      // non-null violation OR a masked generic message ("An unexpected error
      // occurred…"); map those to a clear not-found, but leave unmapped HTTP
      // errors and genuinely unrelated GraphQL errors alone.
      if (err instanceof BlazeError) throw err
      const message = err instanceof Error ? err.message : String(err)
      if (
        /cannot return null|non-nullable|unexpected error|not found/i.test(
          message
        )
      ) {
        throw new BlazeNotFoundError(
          `No withdrawal found with id ${id}. Double-check the id from your withdrawal confirmation.`
        )
      }
      throw err
    }
    if (!data.rampTransfer) {
      throw new BlazeNotFoundError(
        `No withdrawal found with id ${id}. Double-check the id from your withdrawal confirmation.`
      )
    }
    return data.rampTransfer
  }

  // Generic GraphQL helper — bills surfaces are GraphQL-only on the
  // server side; this lets the existing apiKey / bearerToken /
  // x-business-id auth flow apply unchanged.
  async graphqlRequest<T>(
    query: string,
    variables?: Record<string, unknown>
  ): Promise<T> {
    const url = `${this.baseUrl}/graphql`
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...this.defaultHeaders,
    }
    if (this.bearerToken) {
      headers["Authorization"] = `Bearer ${this.bearerToken}`
    } else if (this.apiKey) {
      headers["X-API-Key"] = this.apiKey
    }
    let res: Response
    try {
      res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ query, variables }),
      })
    } catch {
      // Network-layer failure (fetch rejected before any response).
      throw new BlazeNetworkError(
        "Couldn't reach Blaze — check your connection and try again."
      )
    }
    if (!res.ok) {
      // Map HTTP status to a typed, user-safe error. GraphQL-level errors
      // (inside a 200 body) are handled below and surfaced verbatim.
      switch (res.status) {
        case 401:
          throw new BlazeAuthenticationError(
            "Your session is invalid or expired. Run `blaze auth` to log in again."
          )
        case 403:
          throw new BlazePermissionError(
            "You don't have permission to do that."
          )
        case 429:
          throw new BlazeRateLimitError(
            "Too many requests right now — wait a moment and try again."
          )
        default:
          if (res.status >= 500) {
            throw new BlazeServerError(
              "Blaze had a temporary problem. Try again shortly.",
              res.status
            )
          }
          throw new Error(`GraphQL HTTP ${res.status}: ${res.statusText}`)
      }
    }
    const json = (await res.json()) as {
      data?: T
      errors?: Array<{ message: string }>
    }
    if (json.errors?.length) {
      throw new Error(json.errors[0].message)
    }
    if (!json.data) {
      throw new Error("GraphQL response missing data")
    }
    return json.data
  }

  // Balance
  async getBalance(): Promise<Balance> {
    return this.request<Balance>("GET", "/v1/balance")
  }

  // Customers
  async listCustomers(
    params?: ListCustomersParams
  ): Promise<PaginatedList<Customer>> {
    return this.request<PaginatedList<Customer>>(
      "GET",
      `/v1/customers${this.buildQuery(params)}`
    )
  }

  async getCustomer(id: string): Promise<Customer> {
    return this.request<Customer>("GET", `/v1/customers/${id}`)
  }

  async createCustomer(data: CreateCustomerInput): Promise<Customer> {
    return this.request<Customer>("POST", "/v1/customers", data)
  }

  async updateCustomer(
    id: string,
    data: UpdateCustomerInput
  ): Promise<Customer> {
    return this.request<Customer>("PATCH", `/v1/customers/${id}`, data)
  }

  async archiveCustomer(id: string): Promise<void> {
    await this.request<void>("DELETE", `/v1/customers/${id}`)
  }

  // External Accounts
  async listExternalAccounts(
    customerId: string
  ): Promise<PaginatedList<ExternalAccount>> {
    return this.request<PaginatedList<ExternalAccount>>(
      "GET",
      `/v1/customers/${customerId}/external_accounts`
    )
  }

  async createExternalAccount(
    customerId: string,
    data: CreateExternalAccountInput
  ): Promise<ExternalAccount> {
    return this.request<ExternalAccount>(
      "POST",
      `/v1/customers/${customerId}/external_accounts`,
      data
    )
  }

  async deleteExternalAccount(
    customerId: string,
    accountId: string
  ): Promise<void> {
    await this.request<void>(
      "DELETE",
      `/v1/customers/${customerId}/external_accounts/${accountId}`
    )
  }

  // Transfers
  async listTransfers(
    params?: ListTransfersParams
  ): Promise<PaginatedList<Transfer>> {
    return this.request<PaginatedList<Transfer>>(
      "GET",
      `/v1/transfers${this.buildQuery(params)}`
    )
  }

  async getTransfer(id: string): Promise<Transfer> {
    return this.request<Transfer>("GET", `/v1/transfers/${id}`)
  }

  async createTransfer(data: CreateTransferInput): Promise<Transfer> {
    return this.request<Transfer>("POST", "/v1/transfers", data)
  }

  // Withdrawals
  async listWithdrawals(
    params?: ListWithdrawalsParams
  ): Promise<PaginatedList<Withdrawal>> {
    return this.request<PaginatedList<Withdrawal>>(
      "GET",
      `/v1/withdrawals${this.buildQuery(params)}`
    )
  }

  async getWithdrawal(id: string): Promise<Withdrawal> {
    return this.request<Withdrawal>("GET", `/v1/withdrawals/${id}`)
  }

  async createWithdrawal(data: CreateWithdrawalInput): Promise<Withdrawal> {
    return this.request<Withdrawal>("POST", "/v1/withdrawals", data)
  }

  // Payment Links
  async listPaymentLinks(
    params?: ListPaymentLinksParams
  ): Promise<PaginatedList<PaymentLink>> {
    return this.request<PaginatedList<PaymentLink>>(
      "GET",
      `/v1/payment-links${this.buildQuery(params)}`
    )
  }

  async getPaymentLink(id: string): Promise<PaymentLink> {
    return this.request<PaymentLink>("GET", `/v1/payment-links/${id}`)
  }

  async createPaymentLink(data: CreatePaymentLinkInput): Promise<PaymentLink> {
    return this.request<PaymentLink>("POST", "/v1/payment-links", data)
  }

  async updatePaymentLink(
    id: string,
    data: UpdatePaymentLinkInput
  ): Promise<PaymentLink> {
    return this.request<PaymentLink>("PATCH", `/v1/payment-links/${id}`, data)
  }

  async cancelPaymentLink(id: string): Promise<void> {
    await this.request<void>("DELETE", `/v1/payment-links/${id}`)
  }

  // Virtual Accounts
  async listVirtualAccounts(
    customerId: string,
    params?: ListVirtualAccountsParams
  ): Promise<PaginatedList<VirtualAccount>> {
    return this.request<PaginatedList<VirtualAccount>>(
      "GET",
      `/v1/customers/${customerId}/virtual_accounts${this.buildQuery(params)}`
    )
  }

  async getVirtualAccount(
    customerId: string,
    vaId: string
  ): Promise<VirtualAccount> {
    return this.request<VirtualAccount>(
      "GET",
      `/v1/customers/${customerId}/virtual_accounts/${vaId}`
    )
  }

  async createVirtualAccount(
    customerId: string,
    data?: CreateVirtualAccountInput
  ): Promise<VirtualAccount> {
    return this.request<VirtualAccount>(
      "POST",
      `/v1/customers/${customerId}/virtual_accounts`,
      data
    )
  }

  // Transactions
  async listTransactions(
    params?: ListTransactionsParams
  ): Promise<PaginatedList<Transaction>> {
    return this.request<PaginatedList<Transaction>>(
      "GET",
      `/v1/transactions${this.buildQuery(params)}`
    )
  }

  async getTransaction(id: string): Promise<Transaction> {
    return this.request<Transaction>("GET", `/v1/transactions/${id}`)
  }

  // API Keys
  async listApiKeys(): Promise<{ object: "list"; data: ApiKey[] }> {
    return this.request("GET", "/v1/api-keys")
  }

  async createApiKey(data: CreateApiKeyInput): Promise<ApiKeyWithSecret> {
    return this.request("POST", "/v1/api-keys", data)
  }

  async updateApiKeyScopes(
    id: string,
    data: UpdateApiKeyScopesInput
  ): Promise<ApiKey> {
    return this.request("PATCH", `/v1/api-keys/${id}`, data)
  }

  async revokeApiKey(id: string, reason?: string): Promise<void> {
    await this.request<void>(
      "DELETE",
      `/v1/api-keys/${id}`,
      reason ? { reason } : undefined
    )
  }

  // Team Members
  async listTeamMembers(): Promise<{ object: "list"; data: TeamMember[] }> {
    return this.request("GET", "/v1/team-members")
  }

  async listPendingInvitations(): Promise<{
    object: "list"
    data: TeamMember[]
  }> {
    return this.request("GET", "/v1/team-members/invitations")
  }

  async inviteTeamMember(data: InviteTeamMemberInput): Promise<TeamMember> {
    return this.request("POST", "/v1/team-members/invite", data)
  }

  async updateMemberRole(
    id: string,
    data: UpdateMemberRoleInput
  ): Promise<TeamMember> {
    return this.request("PATCH", `/v1/team-members/${id}/role`, data)
  }

  async removeMember(id: string): Promise<void> {
    await this.request<void>("DELETE", `/v1/team-members/${id}`)
  }

  async transferOwnership(data: TransferOwnershipInput): Promise<TeamMember> {
    return this.request("POST", "/v1/team-members/transfer-ownership", data)
  }

  // Webhooks
  async listWebhooks(
    params?: ListWebhooksParams
  ): Promise<PaginatedList<Webhook>> {
    return this.request<PaginatedList<Webhook>>(
      "GET",
      `/v1/webhooks${this.buildQuery(params)}`
    )
  }

  async getWebhook(id: string): Promise<Webhook> {
    return this.request<Webhook>("GET", `/v1/webhooks/${id}`)
  }

  async createWebhook(data: CreateWebhookInput): Promise<WebhookWithSecret> {
    return this.request<WebhookWithSecret>("POST", "/v1/webhooks", data)
  }

  async updateWebhook(id: string, data: UpdateWebhookInput): Promise<Webhook> {
    return this.request<Webhook>("PATCH", `/v1/webhooks/${id}`, data)
  }

  async deleteWebhook(id: string): Promise<void> {
    await this.request<void>("DELETE", `/v1/webhooks/${id}`)
  }

  // Analytics
  async getAnalyticsOverview(
    period?: AnalyticsPeriod
  ): Promise<AnalyticsOverview> {
    const qs = period ? `?period=${period}` : ""
    return this.request<AnalyticsOverview>("GET", `/v1/analytics/overview${qs}`)
  }

  // Disputes
  async listDisputes(
    params?: ListDisputesParams
  ): Promise<PaginatedList<Dispute>> {
    return this.request<PaginatedList<Dispute>>(
      "GET",
      `/v1/disputes${this.buildQuery(params)}`
    )
  }

  async getDispute(id: string): Promise<Dispute> {
    return this.request<Dispute>("GET", `/v1/disputes/${id}`)
  }

  async submitDisputeEvidence(
    id: string,
    data: SubmitDisputeEvidenceInput
  ): Promise<Dispute> {
    return this.request<Dispute>("POST", `/v1/disputes/${id}/evidence`, data)
  }

  async closeDispute(id: string): Promise<Dispute> {
    return this.request<Dispute>("POST", `/v1/disputes/${id}/close`)
  }

  // Invoices
  async listInvoices(
    params?: ListInvoicesParams
  ): Promise<PaginatedList<Invoice>> {
    return this.request<PaginatedList<Invoice>>(
      "GET",
      `/v1/invoices${this.buildQuery(params)}`
    )
  }

  async getInvoice(id: string): Promise<Invoice> {
    return this.request<Invoice>("GET", `/v1/invoices/${id}`)
  }

  async createInvoice(data: CreateInvoiceInput): Promise<Invoice> {
    return this.request<Invoice>("POST", "/v1/invoices", data)
  }

  async sendInvoice(id: string): Promise<Invoice> {
    return this.request<Invoice>("POST", `/v1/invoices/${id}/send`)
  }

  async markInvoicePaid(id: string): Promise<Invoice> {
    return this.request<Invoice>("POST", `/v1/invoices/${id}/mark-paid`)
  }

  async voidInvoice(id: string): Promise<Invoice> {
    return this.request<Invoice>("POST", `/v1/invoices/${id}/void`)
  }

  // Subscriptions
  async listSubscriptions(
    params?: ListSubscriptionsParams
  ): Promise<PaginatedList<Subscription>> {
    return this.request<PaginatedList<Subscription>>(
      "GET",
      `/v1/subscriptions${this.buildQuery(params)}`
    )
  }

  async getSubscription(id: string): Promise<Subscription> {
    return this.request<Subscription>("GET", `/v1/subscriptions/${id}`)
  }

  async createSubscription(
    data: CreateSubscriptionInput
  ): Promise<Subscription> {
    return this.request<Subscription>("POST", "/v1/subscriptions", data)
  }

  async cancelSubscription(
    id: string,
    cancelImmediately?: boolean
  ): Promise<Subscription> {
    return this.request<Subscription>(
      "POST",
      `/v1/subscriptions/${id}/cancel`,
      cancelImmediately !== undefined
        ? { cancel_immediately: cancelImmediately }
        : undefined
    )
  }

  async pauseSubscription(id: string): Promise<Subscription> {
    return this.request<Subscription>("POST", `/v1/subscriptions/${id}/pause`)
  }

  async resumeSubscription(id: string): Promise<Subscription> {
    return this.request<Subscription>("POST", `/v1/subscriptions/${id}/resume`)
  }

  // Insights (Plaid-derived business spend, read-only)
  async getInsightsSummary(
    params?: InsightsDateRangeParams
  ): Promise<SpendingSummary> {
    return this.request<SpendingSummary>(
      "GET",
      `/v1/insights/summary${this.buildQuery(params)}`
    )
  }

  async listBankTransactions(
    params?: ListBankTransactionsParams
  ): Promise<PaginatedListWithCount<BankTransaction>> {
    return this.request<PaginatedListWithCount<BankTransaction>>(
      "GET",
      `/v1/insights/transactions${this.buildQuery(params)}`
    )
  }

  async getBankBalances(): Promise<BankBalances> {
    return this.request<BankBalances>("GET", "/v1/insights/balances")
  }

  // FX Rates & Quotes
  async getFxRates(base?: string): Promise<FxRates> {
    const qs = base ? `?base=${base}` : ""
    return this.request<FxRates>("GET", `/v1/fx/rates${qs}`)
  }

  async createFxQuote(data: {
    from_currency: string
    to_currency: string
    amount: number
  }): Promise<FxQuote> {
    return this.request<FxQuote>("POST", "/v1/fx/quotes", data)
  }

  // Profile (consumer)
  async getMe(): Promise<unknown> {
    return this.request<unknown>("GET", "/v1/me")
  }

  async updateMe(data: unknown): Promise<unknown> {
    return this.request<unknown>("PATCH", "/v1/me", data)
  }

  async setBlazetag(blazetag: string): Promise<unknown> {
    return this.request<unknown>("PUT", "/v1/me/blazetag", { blazetag })
  }

  // Contacts (consumer recipients)
  async listContacts(
    params?: ListContactsParams
  ): Promise<PaginatedList<Contact>> {
    return this.request<PaginatedList<Contact>>(
      "GET",
      `/v1/recipients${this.buildQuery(params)}`
    )
  }

  async getContact(id: string): Promise<Contact> {
    return this.request<Contact>("GET", `/v1/recipients/${id}`)
  }

  async createContact(data: unknown): Promise<Contact> {
    return this.request<Contact>("POST", "/v1/recipients", data)
  }

  async deleteContact(id: string): Promise<void> {
    await this.request<void>("DELETE", `/v1/recipients/${id}`)
  }

  async payContact(
    recipientId: string,
    bankAccountId: string,
    opts: {
      amount: number
      currencyId: string
      usdcAmountInCents: number
      note?: string
    }
  ): Promise<TransferResponse> {
    const idempotencyKey = randomUUID()
    const valueInCents = Math.round(opts.amount * 100)

    return this.request<TransferResponse>(
      "POST",
      `/v1/recipients/${recipientId}/transfers`,
      {
        type: "BankTransfer",
        bankAccountId,
        fiatAmount: { value: valueInCents, currencyId: opts.currencyId },
        usdcAmount: { value: opts.usdcAmountInCents, currencyId: "USD" },
        idempotencyKey,
      }
    )
  }

  /**
   * Send USDC to a contact's external crypto address (Stellar/EVM/Solana).
   *
   * Posts the consumer crypto-transfer body the backend expects:
   * `type:"CryptoTransfer"`, `cryptoAddressId`, and `usdcAmount` in **cents**
   * (`currencyId:"USD"`). Crucially it sends NO `bankAccountId`/`fiatAmount` —
   * a crypto send moves USDC 1:1 with no fiat conversion leg.
   *
   * Crypto sends are irreversible once submitted on-chain. Amount validation
   * (per-chain minimum, >$3k Travel Rule beneficiary data) is the caller's
   * responsibility — the backend will reject sub-minimum/dust sends and >$3k
   * sends lacking beneficiary data, but callers should pre-validate for a
   * better UX.
   */
  async payContactCrypto(
    recipientId: string,
    cryptoAddressId: string,
    opts: {
      usdcAmountInCents: number
      amount?: number
      note?: string
    }
  ): Promise<TransferResponse> {
    const idempotencyKey = randomUUID()

    return this.request<TransferResponse>(
      "POST",
      `/v1/recipients/${recipientId}/transfers`,
      {
        type: "CryptoTransfer",
        cryptoAddressId,
        usdcAmount: { value: opts.usdcAmountInCents, currencyId: "USD" },
        idempotencyKey,
      }
    )
  }

  // User Search (P2P network)
  async searchUsers(
    query: string,
    limit?: number
  ): Promise<PaginatedList<UserSearchResult>> {
    const params: Record<string, string> = { q: query }
    if (limit) params.limit = String(limit)
    return this.request<PaginatedList<UserSearchResult>>(
      "GET",
      `/v1/users/search${this.buildQuery(params)}`
    )
  }

  async getUserByBlazetag(blazetag: string): Promise<UserSearchResult> {
    return this.request<UserSearchResult>(
      "GET",
      `/v1/users/by-tag/${encodeURIComponent(blazetag)}`
    )
  }

  // Duplicate Payment Detection (AI CFO Tool 6)
  async scanDuplicates(
    params?: DuplicateScanParams
  ): Promise<DuplicateScanResult> {
    return this.request<DuplicateScanResult>(
      "GET",
      `/v1/duplicates/scan${this.buildQuery(params)}`
    )
  }

  async checkDuplicate(
    data: DuplicateCheckParams
  ): Promise<DuplicateCheckResult> {
    return this.request<DuplicateCheckResult>(
      "POST",
      "/v1/duplicates/check",
      data
    )
  }

  // Cash Flow Forecast (AI CFO Tool 1)
  async getCashFlowForecast(params: {
    horizon_days?: number
  }): Promise<CashFlowForecast> {
    return this.request<CashFlowForecast>(
      "POST",
      "/v1/cfo/cash-flow-forecast",
      { horizon_days: params.horizon_days ?? 90 }
    )
  }

  // Payroll Intelligence (AI CFO Tool 8)
  async getPayrollAnalysis(params?: { window_days?: number }): Promise<any> {
    return this.request<any>("GET", `/v1/cfo/payroll${this.buildQuery(params)}`)
  }

  // Scenario Modeling (AI CFO Tool 4)
  async modelScenario(params: {
    name: string
    adjustments: ScenarioAdjustment[]
    horizon_days?: number
  }): Promise<ScenarioResult> {
    return this.request<ScenarioResult>("POST", "/v1/cfo/scenario", {
      name: params.name,
      adjustments: params.adjustments,
      horizon_days: params.horizon_days ?? 90,
    })
  }

  // Bank Reconciliation (AI CFO Tool 3)
  async reconcileBankAccounts(
    params: BankReconciliationParams
  ): Promise<ReconciliationResult> {
    return this.request<ReconciliationResult>(
      "POST",
      "/v1/cfo/bank-reconciliation",
      {
        period_start: params.period_start,
        period_end: params.period_end,
        ...(params.account_id ? { account_id: params.account_id } : {}),
      }
    )
  }

  // Payments (P2P)
  async sendPayment(data: SendPaymentInput): Promise<PaymentResult> {
    return this.request<PaymentResult>("POST", "/v1/payments", data)
  }

  async listPayments(params?: { limit?: number }): Promise<unknown> {
    return this.request<unknown>(
      "GET",
      `/v1/payments${this.buildQuery(params)}`
    )
  }

  async getPayment(id: string): Promise<unknown> {
    return this.request<unknown>("GET", `/v1/payments/${id}`)
  }

  // Accounting integrations
  async connectAccounting(
    provider: string
  ): Promise<{ session_id: string; auth_url: string }> {
    const providerMap: Record<string, string> = {
      QUICKBOOKS: "QUICKBOOKS_ONLINE",
      QUICKBOOKS_ONLINE: "QUICKBOOKS_ONLINE",
      XERO: "XERO",
      PUZZLE: "PUZZLE",
    }
    const normalizedProvider = providerMap[provider.toUpperCase()]
    if (!normalizedProvider) {
      throw new Error(`Unsupported accounting provider: ${provider}`)
    }
    return this.request<{ session_id: string; auth_url: string }>(
      "POST",
      "/v1/accounting/connect",
      {
        provider: normalizedProvider,
      }
    )
  }

  async getAccountingSession(
    sessionId: string
  ): Promise<{ status: string; error?: string }> {
    return this.request<{ status: string; error?: string }>(
      "GET",
      `/v1/accounting/sessions/${sessionId}`
    )
  }

  async getAccountingIntegrations(): Promise<any[]> {
    return this.request<any[]>("GET", "/v1/accounting/integrations")
  }

  async disconnectAccounting(integrationId: string): Promise<void> {
    await this.request("DELETE", `/v1/accounting/integrations/${integrationId}`)
  }

  async getProfitAndLoss(params: {
    start_date: string
    end_date: string
    basis?: "cash" | "accrual"
    provider?: string
  }): Promise<any> {
    return this.request(
      "GET",
      `/v1/accounting/profit-and-loss${this.buildQuery(params)}`
    )
  }

  async getBalanceSheet(params: {
    as_of?: string
    basis?: "cash" | "accrual"
    provider?: string
  }): Promise<any> {
    return this.request(
      "GET",
      `/v1/accounting/balance-sheet${this.buildQuery(params)}`
    )
  }

  async getChartOfAccounts(params?: { provider?: string }): Promise<any> {
    return this.request(
      "GET",
      `/v1/accounting/chart-of-accounts${this.buildQuery(params ?? {})}`
    )
  }

  async getTrialBalance(params: {
    start_date: string
    end_date: string
    basis?: "cash" | "accrual"
    provider?: string
  }): Promise<any> {
    return this.request(
      "GET",
      `/v1/accounting/trial-balance${this.buildQuery(params)}`
    )
  }

  async getCashActivity(params: {
    start_date: string
    end_date: string
    provider?: string
  }): Promise<any> {
    return this.request(
      "GET",
      `/v1/accounting/cash-activity-statement${this.buildQuery(params)}`
    )
  }

  async getVendorSpending(params: {
    start_date: string
    end_date: string
    provider?: string
  }): Promise<any> {
    return this.request(
      "GET",
      `/v1/accounting/vendor-spending${this.buildQuery(params)}`
    )
  }

  async getAccountingTransactions(params?: {
    start_date?: string
    end_date?: string
    limit?: number
    offset?: number
    provider?: string
  }): Promise<any> {
    return this.request(
      "GET",
      `/v1/accounting/transactions${this.buildQuery(params ?? {})}`
    )
  }

  async getAccountingBills(params?: {
    status?: string
    start_date?: string
    end_date?: string
    limit?: number
    offset?: number
    provider?: string
  }): Promise<any> {
    return this.request(
      "GET",
      `/v1/accounting/bills${this.buildQuery(params ?? {})}`
    )
  }

  async getAccountingInvoices(params?: {
    status?: string
    start_date?: string
    end_date?: string
    limit?: number
    offset?: number
    provider?: string
  }): Promise<any> {
    return this.request(
      "GET",
      `/v1/accounting/invoices${this.buildQuery(params ?? {})}`
    )
  }

  async createJournalEntry(entry: {
    date: string
    memo?: string
    idempotency_key?: string
    lines: {
      accountId: string
      amount: string
      type: string
      description?: string
    }[]
  }): Promise<{ id: string }> {
    return this.request<{ id: string }>(
      "POST",
      "/v1/accounting/journal-entries",
      {
        date: entry.date,
        memo: entry.memo,
        idempotency_key: entry.idempotency_key,
        lines: entry.lines.map(l => ({
          account_id: l.accountId,
          amount: l.amount,
          type: l.type,
          description: l.description,
        })),
      }
    )
  }

  // Accounting sync triggers (pull/reconcile data with the connected provider).
  // Each returns a { processed, created, skipped } summary. `provider` is
  // optional — the single connected integration is resolved when omitted.
  async syncBillsFromAccounting(params?: {
    provider?: string
  }): Promise<{ processed: number; created: number; skipped: number }> {
    return this.request("POST", "/v1/accounting/sync/bills", params ?? {})
  }

  async syncInvoicesFromAccounting(params?: {
    provider?: string
  }): Promise<{ processed: number; created: number; skipped: number }> {
    return this.request("POST", "/v1/accounting/sync/invoices", params ?? {})
  }

  async syncVendors(params?: {
    provider?: string
  }): Promise<{ processed: number; created: number; skipped: number }> {
    return this.request("POST", "/v1/accounting/sync/vendors", params ?? {})
  }

  async syncCustomers(params?: {
    provider?: string
  }): Promise<{ processed: number; created: number; skipped: number }> {
    return this.request("POST", "/v1/accounting/sync/customers", params ?? {})
  }

  /**
   * Reconcile the connected accounting provider's books against Blaze's
   * internal ledger for a period. Read-only. Only Puzzle is supported today —
   * QuickBooks/Xero return a not-supported error. `provider` is optional and
   * resolves to the single connected integration when omitted.
   */
  async reconcileAccounts(
    params: ReconcileAccountsParams
  ): Promise<AccountingReconciliationResult> {
    return this.request<AccountingReconciliationResult>(
      "POST",
      "/v1/accounting/reconcile",
      {
        period_start: params.period_start,
        period_end: params.period_end,
        ...(params.provider ? { provider: params.provider } : {}),
      }
    )
  }

  /**
   * Push a Blaze bill to the connected accounting provider's books (Blaze →
   * Puzzle). WRITE. Only Puzzle is supported today — QuickBooks/Xero return a
   * not-supported error. `provider` is optional and resolves to the single
   * connected integration when omitted.
   */
  async pushBillToAccounting(
    billId: string,
    provider?: string
  ): Promise<{ externalId: string; pending: boolean }> {
    return this.request("POST", "/v1/accounting/bills", {
      bill_id: billId,
      ...(provider ? { provider } : {}),
    })
  }

  /**
   * Push a Blaze invoice to the connected accounting provider's books (Blaze →
   * Puzzle). WRITE. Mirrors pushBillToAccounting.
   */
  async pushInvoiceToAccounting(
    invoiceId: string,
    provider?: string
  ): Promise<{ externalId: string; pending: boolean }> {
    return this.request("POST", "/v1/accounting/invoices", {
      invoice_id: invoiceId,
      ...(provider ? { provider } : {}),
    })
  }

  /**
   * Read the computed month-end close status for a period — reconciliation rate
   * / reconciled flag and whether the trial balance balances. Read-only;
   * data-only (no UI). Only Puzzle is supported today — QuickBooks/Xero return a
   * not-supported error. `provider` is optional.
   */
  async getCloseStatus(params: {
    start: string
    end: string
    provider?: string
  }): Promise<{
    period: { start: string; end: string }
    reconciliation: { rate: number; reconciled: boolean }
    trialBalanceBalances: boolean
  }> {
    return this.request(
      "GET",
      `/v1/accounting/close-status${this.buildQuery(params)}`
    )
  }

  // ============================================
  // Products
  // ============================================

  async listProducts(
    params?: ListProductsParams
  ): Promise<PaginatedList<Product>> {
    return this.request<PaginatedList<Product>>(
      "GET",
      `/v1/products${this.buildQuery(params)}`
    )
  }

  async getProduct(id: string): Promise<Product> {
    return this.request<Product>("GET", `/v1/products/${id}`)
  }

  async createProduct(data: CreateProductInput): Promise<Product> {
    return this.request<Product>("POST", "/v1/products", data)
  }

  async updateProduct(id: string, data: UpdateProductInput): Promise<Product> {
    return this.request<Product>("PATCH", `/v1/products/${id}`, data)
  }

  async archiveProduct(id: string): Promise<Product> {
    return this.request<Product>("DELETE", `/v1/products/${id}`)
  }

  // ============================================
  // Coupons
  // ============================================

  async listCoupons(
    params?: ListCouponsParams
  ): Promise<PaginatedList<Coupon>> {
    return this.request<PaginatedList<Coupon>>(
      "GET",
      `/v1/coupons${this.buildQuery(params)}`
    )
  }

  async getCoupon(id: string): Promise<Coupon> {
    return this.request<Coupon>("GET", `/v1/coupons/${id}`)
  }

  async createCoupon(data: CreateCouponInput): Promise<Coupon> {
    return this.request<Coupon>("POST", "/v1/coupons", data)
  }

  async updateCoupon(id: string, data: UpdateCouponInput): Promise<Coupon> {
    return this.request<Coupon>("PATCH", `/v1/coupons/${id}`, data)
  }

  async deactivateCoupon(id: string): Promise<void> {
    await this.request<void>("DELETE", `/v1/coupons/${id}`)
  }

  async validateCoupon(
    data: ValidateCouponInput
  ): Promise<ValidateCouponResult> {
    return this.request<ValidateCouponResult>(
      "POST",
      "/v1/coupons/validate",
      data
    )
  }
}
