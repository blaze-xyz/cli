import { BlazeClient } from "../sdk/client"
import { parseIntent } from "./parser"
import { Orchestrator } from "./orchestrator"

export async function runAgent(
  input: string,
  client: BlazeClient
): Promise<void> {
  const intent = parseIntent(input)
  if (!intent) {
    console.error("Could not understand command. Examples:")
    console.error('  blaze agent "send $500 to john@example.com"')
    console.error('  blaze agent "check balance"')
    console.error('  blaze agent "list transactions"')
    process.exit(1)
  }

  const orchestrator = new Orchestrator(client)
  await orchestrator.execute(intent)
}

export { parseIntent } from "./parser"
export { Orchestrator } from "./orchestrator"
