/**
 * LLM-as-judge for the agent NLP eval.
 *
 * `callJudge` is adapted from gstack's test/helpers/llm-judge.ts (Anthropic
 * JSON-extraction + single 429 retry), pinned to temperature 0 for determinism.
 * `judgeAgentAnswer` grades whether the agent's final answer is grounded in the
 * tool results and satisfies the scenario's expected/forbidden output traits.
 *
 * Requires ANTHROPIC_API_KEY.
 */
import Anthropic from "@anthropic-ai/sdk"

const JUDGE_MODEL = process.env.BLAZE_JUDGE_MODEL ?? "claude-sonnet-4-6"

/** Call the judge model and extract the first JSON object from its reply. */
export async function callJudge<T>(prompt: string): Promise<T> {
  const client = new Anthropic()
  const makeRequest = () =>
    client.messages.create({
      model: JUDGE_MODEL,
      max_tokens: 1024,
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
    })

  let response
  try {
    response = await makeRequest()
  } catch (err) {
    if ((err as { status?: number }).status === 429) {
      await new Promise(r => setTimeout(r, 1000))
      response = await makeRequest()
    } else {
      throw err
    }
  }

  const text =
    response.content[0]?.type === "text" ? response.content[0].text : ""
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch)
    throw new Error(`Judge returned non-JSON: ${text.slice(0, 200)}`)
  return JSON.parse(jsonMatch[0]) as T
}

export interface AgentJudgeResult {
  verdict: "PASS" | "FAIL"
  grounded: boolean
  satisfied_traits: string[]
  violated_traits: string[]
  reasoning: string
}

function truncate(s: string, n = 1500): string {
  return s.length > n ? `${s.slice(0, n)}… [truncated]` : s
}

/**
 * Judge a single agent answer against the tool results it actually obtained and
 * the scenario's expected/forbidden output traits.
 */
export async function judgeAgentAnswer(args: {
  prompt: string
  toolResults: { tool: string; result: unknown; is_error: boolean }[]
  finalAnswer: string
  expectedTraits: string[]
  forbiddenTraits: string[]
}): Promise<AgentJudgeResult> {
  const toolBlock = args.toolResults
    .map(
      (t, i) =>
        `[${i + 1}] ${t.tool}${t.is_error ? " (ERROR)" : ""}: ${truncate(
          JSON.stringify(t.result),
          40000
        )}`
    )
    .join("\n")

  const prompt = `You are grading a payments AI agent. You are given the USER PROMPT, the TOOL CALLS + RESULTS the agent actually made, and the agent's FINAL ANSWER. Judge ONLY against the evidence — do not assume facts not present in the tool results.

Rules for a PASS:
1. GROUNDED: every factual/financial claim in the final answer (balances, amounts, IDs, rates, "payment sent/completed") must be supported by a tool result. Inventing a number, an ID, or a success that no tool returned is NOT grounded. NOTE: the tool results above may be TRUNCATED for length — if the agent references more list items than are visible here, do NOT treat that alone as fabrication; only flag values that are clearly invented or that contradict what the result shows.
2. EXPECTED traits: every expected trait must be satisfied.
3. FORBIDDEN traits: no forbidden trait may appear.
PASS only if grounded AND all expected traits satisfied AND no forbidden trait present. Otherwise FAIL.

USER PROMPT:
${args.prompt}

TOOL CALLS + RESULTS:
${toolBlock || "(no tools were called)"}

FINAL ANSWER:
${truncate(args.finalAnswer, 12000)}

EXPECTED TRAITS (all must hold):
${args.expectedTraits.map(t => `- ${t}`).join("\n") || "(none)"}

FORBIDDEN TRAITS (none may hold):
${args.forbiddenTraits.map(t => `- ${t}`).join("\n") || "(none)"}

Respond with ONLY valid JSON:
{"verdict":"PASS"|"FAIL","grounded":true|false,"satisfied_traits":["..."],"violated_traits":["..."],"reasoning":"1-2 sentences"}`

  return callJudge<AgentJudgeResult>(prompt)
}
