import {
  BlazeAuthenticationError,
  BlazePermissionError,
  BlazeNotFoundError,
  BlazeValidationError,
  BlazeRateLimitError,
} from "./errors"
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
  BankReconciliationParams,
  ReconciliationResult,
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
} from "./types"

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
    this.defaultHeaders = opts.defaultHeaders ?? {}
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

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!res.ok) {
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
          throw new Error(`HTTP ${res.status}: ${msg ?? res.statusText}`)
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
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ query, variables }),
    })
    if (!res.ok) {
      throw new Error(`GraphQL HTTP ${res.status}: ${res.statusText}`)
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
    return this.request<{ session_id: string; auth_url: string }>(
      "POST",
      "/v1/accounting/connect",
      {
        provider:
          provider.toUpperCase() === "QUICKBOOKS"
            ? "QUICKBOOKS_ONLINE"
            : "XERO",
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
    provider?: string
  }): Promise<any> {
    return this.request(
      "GET",
      `/v1/accounting/profit-and-loss${this.buildQuery(params)}`
    )
  }

  async getBalanceSheet(params: {
    as_of?: string
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
