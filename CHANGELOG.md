# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-05-27

### Added

**MCP Server (72 tools total)**
- **Insights (3 tools)** - Plaid-based business spend analytics
  - `blaze_get_spending_summary` - Aggregated spend by category and merchant
  - `blaze_list_bank_transactions` - Transaction-level details with filtering
  - `blaze_get_bank_balances` - Current account balances across connected banks
- **Bills / AP Automation (17 tools)** - Gmail-synced bill extraction and payment
  - Bill management: `blaze_list_bills`, `blaze_get_bill`, `blaze_create_bill`, `blaze_update_bill`
  - Approval workflow: `blaze_approve_bill`, `blaze_reject_bill`
  - Payment execution: `blaze_quote_bill_payment`, `blaze_pay_bill` (quote-then-confirm pattern)
  - Audit trail: `blaze_list_bills_activity_log`
  - Account management: `blaze_list_connected_accounts`, `blaze_connect_bank_account`
  - Gmail sync: `blaze_connect_gmail`, `blaze_disconnect_gmail`, `blaze_list_extracted_invoices`, `blaze_create_bill_from_invoice`
  - Payment settings: `blaze_get_bill_payment_methods`, `blaze_set_bill_payment_policy`

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
- Updated README tool count (55 → 72 tools)
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
