# AI CFO Tool 4 — Scenario Modeling: Integration JSON Evidence (2026-06-08)

**Ticket:** #3491 · **Branch:** `gersly/ai-cfo-tool-4-scenario-modeling`
**Source:** `spark/src/integration-tests/flows/cfoScenario.integration.spec.ts` — supertest against a **real Postgres DB**, exercising the real chain `Controller/Resolver → ScenarioModelingService → CashFlowForecastService (Tool 1 baseline) → BusinessBalanceService + Plaid detection`.

## Coverage (6 integration cases, all green)
| # | Surface | Case |
|---|---|---|
| 1 | REST `POST /v1/cfo/scenario` | new_recurring_expense lowers ending balance vs real baseline |
| 2 | REST | empty adjustments echo the baseline (diffs 0) |
| 3 | REST | no API key → 403 |
| 4 | REST | `horizon_days: 400` → 400 (BadRequestException) |
| 5 | GraphQL `cashFlowScenario` | new_recurring_expense lowers ending balance (real resolver→service chain) |
| 6 | GraphQL | `horizonDays: 400` → error in `errors[]`, `data` null |

**Auth:** both surfaces use `X-API-Key` (scopes `TRANSACTIONS_READ`, `BALANCE_READ`). `TenantContextMiddleware` resolves the API-key context on **every** route incl. `/graphql`.

## REST ↔ GraphQL equivalence — PROVEN
Same seeded baseline, same adjustment ("Hire a senior engineer", +$24,000/mo recurring). **Both surfaces returned byte-identical projections + comparison metrics.**

### REST `POST /v1/cfo/scenario` — response body
```json
{
  "data": {
    "name": "Hire a senior engineer",
    "monthlyProjections": [
      { "month": "2026-06", "projectedRevenueCents": 0, "projectedExpensesCents": 2400000, "netCents": -2400000, "endingBalanceCents": 2600000 },
      { "month": "2026-07", "projectedRevenueCents": 0, "projectedExpensesCents": 3400000, "netCents": -3400000, "endingBalanceCents": -800000 },
      { "month": "2026-08", "projectedRevenueCents": 0, "projectedExpensesCents": 2900000, "netCents": -2900000, "endingBalanceCents": -3700000 },
      { "month": "2026-09", "projectedRevenueCents": 0, "projectedExpensesCents": 500000, "netCents": -500000, "endingBalanceCents": -4200000 }
    ],
    "runwayMonths": 1,
    "breakEvenDate": null,
    "comparisonToBaseline": {
      "runwayDiffMonths": -9,
      "monthlyBurnDiffCents": -1800000,
      "endingBalanceDiffCents": -7200000
    }
  }
}
```

### GraphQL `cashFlowScenario` — response body
```json
{
  "data": {
    "cashFlowScenario": {
      "name": "Hire a senior engineer",
      "runwayMonths": 1,
      "breakEvenDate": null,
      "monthlyProjections": [
        { "month": "2026-06", "projectedRevenueCents": 0, "projectedExpensesCents": 2400000, "netCents": -2400000, "endingBalanceCents": 2600000 },
        { "month": "2026-07", "projectedRevenueCents": 0, "projectedExpensesCents": 3400000, "netCents": -3400000, "endingBalanceCents": -800000 },
        { "month": "2026-08", "projectedRevenueCents": 0, "projectedExpensesCents": 2900000, "netCents": -2900000, "endingBalanceCents": -3700000 },
        { "month": "2026-09", "projectedRevenueCents": 0, "projectedExpensesCents": 500000, "netCents": -500000, "endingBalanceCents": -4200000 }
      ],
      "comparisonToBaseline": {
        "runwayDiffMonths": -9,
        "monthlyBurnDiffCents": -1800000,
        "endingBalanceDiffCents": -7200000
      }
    }
  }
}
```

**Adding $24k/mo recurring expense → ending balance −$72,000 (−7,200,000¢), burn −$18k/mo — identical across REST and GraphQL.** The guard (`horizonDays: 400`) correctly surfaces `BadRequestException` on both surfaces.

## Seeding (for reproducibility)
- 3 `PlaidTransaction` outflows, same merchant ("AWS"), ~30-day cadence within the 90-day lookback → forecast detects a monthly recurring burn.
- Starting balance from one `COMPLETE` `CheckoutSession` ($50,000).
- Business via the real `createBusiness` mutation; `BusinessAPIKey` seeded with `sha256(plaintext)`, scopes `[TRANSACTIONS_READ, BALANCE_READ]`.
- Per-test FK-ordered cleanup.

## How to source more JSON bodies
1. **This integration test** — `res.body` from supertest (real DB, deterministic). ← evidence above.
2. **Live staging** — `yarn start:debug:staging:local`, then `curl POST /v1/cfo/scenario` (`X-API-Key`) or `POST /graphql` (the `cashFlowScenario` query) against real Plaid data. See `cfo-tool4-scenario-2026-06-04.md`.
