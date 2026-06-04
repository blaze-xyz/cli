# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1 – 1.0.3] - 2026-05-28

The 1.0.0 launch shipped three patch releases in quick succession to address
CI/lint cleanup, UX polish, and a few real bug fixes. Patch-by-patch attribution
is approximate — see `git log` on `blaze-cli/` for exact commits. Highlights:

### Added

- `feat(cli): business/personal context flags and command guards` — `--business <id>`
  and `--personal` global flags; commands that require business context now fail
  fast with a clear hint if none is active.
- `feat(cli): personal mode with x-blaze-personal header` — explicit consumer
  mode that ignores the active business override.
- `feat(cli): MCP server supports bearer token auth` — the MCP server now accepts
  the saved bearer token from `blaze auth` in addition to an API key.
- `feat(cli): ship unified blaze skill with CLI package` — the `blaze` agent skill
  is bundled with `@blaze-money/cli` so `claude skill add` works out of the box
  after a global install.
- `fix(cli): add 'blaze login' command and make 'blaze auth login' open browser` —
  `blaze login` is now a top-level alias and `auth login` triggers the OAuth
  flow automatically.

### Fixed

- `fix(cli): balance NaN display by handling nested amount objects` — `blaze balance`
  no longer renders `$NaN` when the API returns nested currency objects.
- `fix(cli): show context hint even when transactions list is empty` — empty
  results now still tell you which business / mode you're in.
- `fix(blaze-cli): resolve ESLint errors and warnings` — repo-wide lint pass.
- Build / packaging hygiene: `chore: remove package-lock.json from blaze-cli
  (yarn project)`.

## [1.0.0] - 2026-05-27

### Added

**MCP Server (74 tools total)**
- **Insights (3 tools)** - Plaid-based business spend analytics
  - `blaze_get_spending_summary` - Aggregated spend by category and merchant
  - `blaze_list_bank_transactions` - Transaction-level details with filtering
  - `blaze_get_bank_balances` - Current account balances across connected banks
- **Bills / AP Automation (16 tools)** - Gmail-synced bill extraction and payment
  - Bill management: `blaze_list_bills`, `blaze_get_bill`
  - Approval workflow: `blaze_approve_bill`, `blaze_reject_bill`
  - Payment execution: `blaze_quote_bill_payment`, `blaze_pay_bill` (quote-then-confirm pattern)
  - Audit trail: `blaze_list_bills_activity_log`
  - Vendor management: `blaze_list_bill_vendors`, `blaze_get_bill_vendor`
  - Gmail integration: `blaze_connect_gmail_start`, `blaze_connect_gmail_finalize`, `blaze_list_gmail_integrations`, `blaze_sync_bills`
  - Approval requests: `blaze_list_pending_bill_approvals`, `blaze_approve_bill_approval_request`, `blaze_reject_bill_approval_request`

**Documentation**
- Comprehensive Codex integration guide (`docs/codex-integration.md`)
- 5 publication-ready use case examples:
  - AI-powered spend insights (CloudOps Inc case study)
  - Automated bill payment with human-in-the-loop (Pixel Studios)
  - P2P freelancer payouts at scale (DesignHub marketplace)
  - Payment link generation for sales teams (ProTools B2B SaaS)
  - Webhook-driven accounting reconciliation (MarketConnect)

**Security**
- Read-only production database access via Insights tools
- Scoped API keys with principle of least privilege
- Two-phase payment pattern (quote-then-confirm) for bill payments
- OAuth-based Gmail integration with read-only permissions

### Changed
- Updated README tool count (55 → 74 tools)
- Enhanced MCP server with business operations support
- Improved error handling for Insights and Bills tools

### Core Features (from 0.1.0)
- TypeScript SDK with typed client for all Blaze API endpoints
- CLI with commands for balance, customers, transfers, withdrawals, payment links, accounts, recipients, and transactions
- MCP server with 55 core tools for AI assistant integration
- Natural language agent mode for common payment operations
- Authentication via API key (flag, environment variable, or config file)
- Support for 8 currencies (USD, MXN, EUR, GBP, BRL, COP, PEN, ARS)
- Comprehensive error handling with typed exceptions

## [0.1.0] - 2024-XX-XX

Initial development release (unreleased).
