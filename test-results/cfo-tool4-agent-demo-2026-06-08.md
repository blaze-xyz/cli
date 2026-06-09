# AI CFO Tool 4 — Live Agent Demo (QA Artifact)

**Date:** 2026-06-08 · **Ticket:** #3491 · **Branch:** `gersly/ai-cfo-tool-4-scenario-modeling`

## Purpose
Prove the **actual intended use case** — an LLM agent (Codex/Claude style) using the Scenario Modeling tool — works end-to-end against real data, not just that the pieces pass tests in isolation.

## Pipeline exercised
```
blaze agent "<what-if question>"
  → Claude (Sonnet, key from spark/.env.staging)
    → blaze_cfo_scenario tool (blaze-cli)
      → SDK X-API-Key auth → local Spark :3000  (our branch — has the endpoint)
        → POST /v1/cfo/scenario → ScenarioModelingService
          → CashFlowForecastService (real staging Plaid data, via fly proxy → spark-staging-db)
```
Business: **EarlyStageJobs** (`cmos6sfry0051i1o352bn3en2`). Read-only `sk_test_` key (`TRANSACTIONS_READ` + `BALANCE_READ`).

---

## The transcript, annotated

### 1. The human question (natural language — no tool syntax)
> "What happens to our runway if we hire 2 senior engineers at $12,000/month each over the next 90 days? Use our real cash flow."

### 2. Claude's first tool call — establish the baseline
```
blaze_cfo_forecast { "horizon_days": 90 }
```
The agent reasoned (correctly) that a "what-if" needs the *current* forecast first, so it pulled the Tool 1 baseline.

### 3. Claude's second tool call — the scenario
```
blaze_cfo_scenario {
  "name": "Hire 2 Senior Engineers",
  "adjustments": [
    { "type": "new_recurring_expense", "amount_cents": 2400000,
      "frequency": "monthly", "description": "2 Senior Engineers @ $12,000/month each" }
  ],
  "horizon_days": 90
}
```
**The key proof of comprehension:** Claude translated free text "2 engineers × $12k/month" into one `new_recurring_expense` of `amount_cents: 2400000` ($24,000/mo) — the exact shape the tool's schema expects.

### 4. The tool result — real numbers from the staging DB
Baseline the endpoint computed from **real Plaid recurring outflows**: Checkbook Inc $2,000/mo, AMEX $161.36/mo, Authnet Gateway $30/mo, Affirm $20.69/mo → ~**$2,212/mo** burn; current balance **$0**; cash-crunch **2026-06-11**.

Scenario result:
```
monthlyProjections (ending balances): Jun −$28,323 → Jul −$54,585 → Aug −$80,798 → Sep −$80,848
runwayMonths: 0,  breakEvenDate: null
comparisonToBaseline: { monthlyBurnDiffCents: −1,800,000, endingBalanceDiffCents: −7,200,000 }
```
Reading it: adding $24k/mo raises burn, and over the 90-day window the ending balance is **−$72,000** worse than baseline (3 monthly hits × $24k). `monthlyBurnDiffCents −1,800,000` = −$18k/mo averaged across the 4 month-buckets.

### 5. Claude's final answer (synthesized from the tool result)
A baseline-vs-scenario breakdown: monthly burn **$2,212 → $24,212**, 90-day position **−$72,000** worse, **runway 0 months**, **no break-even** — and a recommendation **not to hire** until the cash position is fixed (would need ~$72k+ in new capital/revenue first).

---

## How we know it's real (not the model fabricating numbers)
Three independent corroborations:
1. **Tool-call trace** — a temporary stderr trace injected into the built CLI captured Claude actually emitting the `blaze_cfo_scenario` tool call (trace removed + CLI rebuilt clean afterward).
2. **Server logs** — Spark logged **two `CashFlowForecastService.getForecast` invocations** (request IDs `c44fe911…`, `d2be3168…`) at the exact timestamps of the two tool calls.
3. **Direct `curl`** to the same endpoint with the same key returned **HTTP 201 with identical numbers** — confirming the *endpoint*, not the LLM, produced the figures.

Cross-check: the **$2,212/mo baseline burn matches the 2026-06-04 live staging run** — consistent across two independent sessions.

## Environment
Local Spark (this branch) on `:3000`, booted against **staging DB** via flyctl proxy. Claude via `ANTHROPIC_API_KEY` from `spark/.env.staging`. Throwaway `isTest` API key (deleted after; endpoint now 403s it).

## Conclusion
The full **LLM → tool → endpoint → real data → coherent answer** loop works. This is the strongest evidence for the stated goal (AI CFO usable from agent/chat interfaces): a real agent understood a plain-English question, called the right tool with correct arguments, and answered from real cash-flow data — verified at the network and server layers.

## Follow-ups surfaced by this demo
- `blaze agent` has **no built-in tool-call logging** — verification required instrumenting the binary. A `--verbose` / `BLAZE_AGENT_DEBUG` flag (log tool name+args to stderr) would make any agent tool verifiable out of the box.
- `start:debug:staging:local` doesn't set `SKIP_CONFIG_VALIDATION`, so it crashes on missing `PAYTENTLY_*` staging secrets — needs a manual override to boot.
