import {
  BlazeAuthenticationError,
  BlazePermissionError,
  BlazeNotFoundError,
  BlazeValidationError,
  BlazeRateLimitError,
} from "./errors"
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
} from "./types"

export interface BlazeClientOptions {
  apiKey: string
  baseUrl?: string
}

export class BlazeClient {
  private apiKey: string
  private baseUrl: string

  constructor(opts: BlazeClientOptions) {
    this.apiKey = opts.apiKey
    this.baseUrl = opts.baseUrl ?? "https://api.blaze.money"
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const headers: Record<string, string> = {
      "X-API-Key": this.apiKey,
      "Content-Type": "application/json",
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
      const msg = (errorBody.message as string) ?? undefined
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
}
