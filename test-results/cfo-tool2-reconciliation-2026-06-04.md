# AI CFO Tool 2 — Bank Reconciliation — Test Report (2026-06-04)

Ticket: #3489 · Branch: `gersly/cfo-bank-reconciliation` (off `main`) · PR: #3533
Endpoint: `POST /v1/cfo/bank-reconciliation` (stateless; no shared tool-executor framework)

## Environment
Local Spark against a copy of the staging DB (`blaze_staging_local`), business
`EarlyStageJobs` (`cmos6sfry0051i1o352bn3en2`: real Plaid txns + 2 seeded internal
`BusinessTransaction` records), read-only scope (`TRANSACTIONS_READ`).
Path: SDK `reconcileBankAccounts` / `blaze_cfo_reconcile` → REST → `BankReconciliationService` → real data.

## Results
| Check | Result |
|---|---|
| `tsc --noEmit` (Finance + BusinessAPI) | ✅ 0 errors |
| Unit test `bankReconciliation.service.spec.ts` | ✅ 7/7 pass |
| eslint (touched files) | ✅ 0 errors |
| blaze-cli `yarn build` | ✅ pass |
| blaze-cli reconcile tests (sdk + schema + tool) | ✅ pass (suite: 282 passed) |
| **Live reconcile against real Plaid data** | ✅ matched 2 @ confidence 1.0 |

### Live reconcile output (real Plaid data)
```json
{
  "reconciliationRate": 1.6,
  "totalPlaidTransactions": 128,
  "totalInternalRecords": 2,
  "matched": 2,
  "lowConfidenceMatches": 0,
  "unmatchedBank": 126,
  "unmatchedInternal": 0
}
```
Both matches via Pass 1 (`provider_reference`, confidence 1.0) against the real Plaid
transaction IDs (Rippling, Chase). Rate = matched / totalPlaidTransactions.

## How matching works (verified)
5 decreasing-confidence passes, each Plaid txn matched at most once:
1. provider reference (1.0) · 2. exact amount + date (0.95) · 3. exact amount + ≤3-day (0.85)
· 4. amount ≤5% + vendor-name fuzzy + ≤5-day (0.70) · 5. amount ≤2% + ≤2-day (0.50).
≥0.85 → matched; Passes 4–5 → low-confidence/review; rest → unmatched. Internal records
come from `BusinessTransaction` (Withdrawals), `BusinessBillPayment` (POSTED), and
`CheckoutSession` (COMPLETE).

## Hybrid vendor-name scorer (the one engine change)
`calculateNameSimilarity` = `max(token-set Jaccard, normalized Levenshtein ratio)` with
exact/substring short-circuits — robust to bank-descriptor noise (`SQ *ACME`, token
reordering, typos). Replaces the scaffold's char-set Jaccard (order/frequency-blind).
Covered by the 7 unit tests.

## Scope
Stateless reconciliation only — engine + dedicated REST endpoint + `blaze_cfo_reconcile`
CLI tool + unit tests. No persistence/migration, no cron, no GraphQL resolver, no generic
tool executor/registry. Matches the shipped pattern of Tool 1 (forecast) and Tools 3 & 6.
