import Anthropic from "@anthropic-ai/sdk"
import AnthropicBedrock from "@anthropic-ai/bedrock-sdk"
import { AnthropicFoundry } from "@anthropic-ai/foundry-sdk"

/**
 * Creates an LLM client based on the BLAZE_LLM_PROVIDER environment variable.
 * Returns Anthropic type since AnthropicBedrock is API-compatible and shares
 * the same messages.create() signature.
 */
export function createClient(): Anthropic {
  if (
    process.env.BLAZE_LLM_PROVIDER === "foundry" ||
    process.env.CLAUDE_CODE_USE_FOUNDRY === "true"
  ) {
    return new AnthropicFoundry({
      apiKey: process.env.ANTHROPIC_FOUNDRY_API_KEY,
      resource: process.env.ANTHROPIC_FOUNDRY_RESOURCE,
    }) as unknown as Anthropic
  }
  if (process.env.BLAZE_LLM_PROVIDER === "bedrock") {
    return new AnthropicBedrock({
      awsRegion: process.env.AWS_REGION ?? "us-east-1",
    }) as unknown as Anthropic
  }
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error(
      "ANTHROPIC_API_KEY environment variable is required for blaze agent."
    )
    console.error("Set it with: export ANTHROPIC_API_KEY=sk-ant-...")
    console.error("Or use AWS Bedrock: export BLAZE_LLM_PROVIDER=bedrock")
    console.error("Or use Azure Foundry: export BLAZE_LLM_PROVIDER=foundry")
    process.exit(1)
  }
  return new Anthropic({ apiKey })
}

export function getDefaultModel(): string {
  if (process.env.BLAZE_AGENT_MODEL) return process.env.BLAZE_AGENT_MODEL
  if (
    process.env.BLAZE_LLM_PROVIDER === "foundry" ||
    process.env.CLAUDE_CODE_USE_FOUNDRY === "true"
  ) {
    // Foundry requires `model` to equal the team's deployment name. There is no
    // universal default, so callers must set BLAZE_AGENT_MODEL to the Foundry
    // deployment name. Fall back to the Claude model id only as a placeholder.
    return process.env.ANTHROPIC_FOUNDRY_DEPLOYMENT ?? "claude-sonnet-4-6"
  }
  if (process.env.BLAZE_LLM_PROVIDER === "bedrock") {
    return "us.anthropic.claude-sonnet-4-20250514-v1:0"
  }
  return "claude-sonnet-4-6"
}
