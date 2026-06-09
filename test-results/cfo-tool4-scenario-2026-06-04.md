# AI CFO Tool 4 — Scenario Modeling — Test Report (2026-06-04)

Ticket: #3491 · Branch: `gersly/ai-cfo-tool-4-scenario-modeling` (based on Tool 1's `gersly/ai-cfo-tool-1-forecasting`)
Endpoint: `POST /v1/cfo/scenario` (decoupled; mirrors Tool 1's REST + CLI pattern, no GraphQL, no Agent/Tools scaffold dependency)

## What was built
- **Service:** `spark/src/modules/Finance/services/scenario.modeling.service.ts` — `modelScenario({ name, adjustments, horizonDays })`, layered on Tool 1's `CashFlowForecastService.getForecast()` baseline. Six adjustment types: `revenue_change_percent`, `new_recurring_expense`, `remove_recurring_expense`, `one_time_cost`, `one_time_income`, `delay_receivable`. Returns monthly projections + runway + break-even + comparison-to-baseline. Added a `horizonDays > 365` input guard.
- **Controller:** `spark/src/modules/BusinessAPI/controllers/cfo-scenario.controller.ts` — `POST /v1/cfo/scenario`, `@BusinessScopes(TRANSACTIONS_READ)`, snake_case body → camelCase service input, returns `{ data: ScenarioResult }`.
- **CLI surface (blaze-cli):** SDK `modelScenario` + types, MCP tool `blaze_cfo_scenario` (tool 78) + schema, agent tool + system-prompt entry. Mirrors Tool 1's `blaze_cfo_forecast` wiring (agent/MCP/SDK only — no top-level CLI command).

## Environment
Unit-level validation (no infra). The scenario engine is pure computation over Tool 1's forecast baseline — which was already validated live against staging — so it is tested with a **deterministic mocked baseline** via the NestJS testing module. `CashFlowForecastService.getForecast` and `TenantContextService.requireBusinessFilter` are mocked; all scenario math runs for real.

## Results
| Check | Result |
|---|---|
| `tsc --noEmit` (Finance + BusinessAPI + scenario/cfo paths) | ✅ 0 errors |
| Unit spec `scenario.modeling.service.spec.ts` | ✅ **9/9 pass** (0.96 s) |
| eslint (new spec, `--fix` applied) | ✅ 0 errors |
| blaze-cli `yarn build` (CJS + DTS type-check) | ✅ pass |

## Unit coverage (what each test proves)
**Tenant isolation & guards**
- Enforces `requireBusinessFilter()` before modeling (tenant isolation).
- Rejects `horizonDays > 365` (issue-required edge case).

**Baseline fidelity**
- Zero adjustments reproduce the baseline exactly — `runwayDiff = 0`, `burnDiff = 0`, `endingBalanceDiff = 0`. Guards against drift in the clone/recompute path.

**Revenue adjustments**
- `revenue_change_percent: -100` flips a healthy (infinite-runway) baseline to a finite positive runway; ending balance drops. (Models "lose all revenue".)
- `revenue_change_percent: +50` on 20,000/day inflow ⇒ ending balance rises by exactly **+900,000** cents over the 90-day window (compounding correctness).

**Expense adjustments**
- `new_recurring_expense` 100,000/mo lands on days 0/30/60 ⇒ ending balance drops by exactly **−300,000** (occurrence cadence correctness).
- `remove_recurring_expense` of 999,999 against a real 10,000/day outflow clamps at zero ⇒ recovers only the real **+30,000**, never goes negative (remove-non-existent edge case).
- `one_time_cost` 50,000 on a target date hits **only** that day ⇒ ending balance −50,000.

**Receivable timing**
- `delay_receivable` shifts inflows past the horizon ⇒ in-window revenue (and ending balance) decreases.

## Live staging run (2026-06-04) ✅
Booted local Spark via `yarn start:debug:staging:local` (flyctl proxy → live `spark-staging-db`, app on `:3000`, DB proxy on `:5433`). Minted a read-only `sk_test_` key (`TRANSACTIONS_READ` + `BALANCE_READ`) for business **EarlyStageJobs** (`cmos6sfry0051i1o352bn3en2`) and called the real endpoints with `X-API-Key`.

| Call | Result |
|---|---|
| `POST /v1/cfo/scenario` **without** key | ✅ HTTP 403 (route registered + guarded) |
| `POST /v1/cfo/cash-flow-forecast` (baseline) | ✅ HTTP 200 |
| `POST /v1/cfo/scenario` "Hire 2 engineers" | ✅ HTTP 200 |
| `POST /v1/cfo/scenario` one-time +$50k income | ✅ HTTP 200 |
| `POST /v1/cfo/scenario` `horizon_days=400` | ⚠️ HTTP 500 (pre-fix) → fixed to 400, see below |

**Baseline (real Plaid data, EarlyStageJobs):** `currentBalance=0`, `netBurnRate=221,205`¢/mo ($2,212.05), `cashCrunchDate=2026-06-11`, 4 recurring outflows / 0 inflows, 90 daily projections. *(Matches Tool 1's live forecast numbers for the same business.)*

**Scenario "Hire 2 engineers" (+$24,000/mo recurring):**
`comparisonToBaseline = { runwayDiffMonths: 0, monthlyBurnDiffCents: -1,800,000, endingBalanceDiffCents: -7,200,000 }`.
→ **−$72,000** ending balance = exactly 3 monthly occurrences (days 0/30/60) × $24k; **−$18,000/mo** avg burn over 4 month-buckets. Math correct on real data. (Runway stays 0 because the business already sits at $0 balance — a real data quirk, not a bug.)

**Scenario "one-time +$50,000 income":**
`comparisonToBaseline = { runwayDiffMonths: +0.2, monthlyBurnDiffCents: +1,250,000, endingBalanceDiffCents: +5,000,000 }`.
→ **+$50,000** ending balance exactly; runway pushed out +0.2mo. Positive-direction adjustment verified.

### Finding + fix (surfaced by the live run)
`horizon_days=400` was rejected (guard works) but surfaced as a raw **HTTP 500**. A validation guard should return a clean 4xx. **Fixed:** the `horizonDays > 365` guard now throws `BadRequestException` (→ HTTP 400) instead of a plain `Error`. Unit spec updated to assert `BadRequestException`; 9/9 still green. *(The running staging server predates the fix — it will return 400 on next boot; the change is unit-verified.)*

## blaze-cli tests (CLI / MCP / agent layer) — added ✅ (2026-06-04)
The decoupled equivalent of `/test-cfo`'s tool-registry check, written as real unit tests mirroring Tool 1's forecast coverage. 4 new suites, **23 tests**, all green; full blaze-cli unit run **243/243**.
- `mcp/schemas-scenario.test.ts` — zod `scenarioModelingSchema` / `scenarioAdjustmentSchema` (required fields, horizon 1–365 bounds, bad adjustment type).
- `sdk/scenario.test.ts` — `client.modelScenario` POSTs `/v1/cfo/scenario` (default horizon 90, X-API-Key header, data envelope).
- `agent/tools-scenario.test.ts` — `blaze_cfo_scenario` registered + `executeTool` delegates to `client.modelScenario` (adjustments→[], horizon→90 defaults).
- `mcp/tools-scenario.test.ts` — `blaze_cfo_scenario` registered in the MCP server + routes to `client.modelScenario` + `isError` on throw.
- Also registered `blaze_cfo_scenario` in the exhaustive `execute-tools.test.ts` "every tool" coverage map.

> Note on `/test-cfo`: that scaffold-only command verifies tool registration via the **Agent/Tools `ToolRegistryService`**, which Tool 4 (like Tool 1) intentionally does not use — so it doesn't apply to this decoupled architecture. The four suites above are the architecture-appropriate equivalent of its registry check.

## Still open (follow-ups)
- **Integration test** through the controller against a real DB (supertest) — mirror Tool 2's pattern.
- Re-confirm the `horizon_days=400 → 400` response live after the next staging boot (running server predates the guard fix).

---
*Tool 4 verified end-to-end: unit (9/9, deterministic) + live staging endpoint against real Plaid data, with correct scenario math in both directions. One hardening fix (500→400) applied. Integration + CLI-layer tests are the remaining follow-ups.*
