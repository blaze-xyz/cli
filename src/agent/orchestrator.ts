import type Anthropic from "@anthropic-ai/sdk"
import { BlazeClient } from "../sdk/client"
import { MemoryStore } from "./memory"
import { buildSystemPrompt } from "./system-prompt"
import { buildTools, executeTool } from "./tools"

export interface OrchestratorConfig {
  apiKey?: string
  bearerToken?: string
  baseUrl?: string
  memoryPath?: string
  skillsDir?: string
}

export class BlazeOrchestrator {
  private client: BlazeClient
  private memory: MemoryStore

  constructor(config: OrchestratorConfig) {
    this.client = new BlazeClient({
      apiKey: config.apiKey,
      bearerToken: config.bearerToken,
      baseUrl: config.baseUrl,
    })
    this.memory = new MemoryStore(config.memoryPath)
    if (config.skillsDir) {
      process.env.BLAZE_SKILLS_DIR = config.skillsDir
    }
  }

  getSystemPrompt(): string {
    return buildSystemPrompt(this.client.authContext)
  }

  getToolDefinitions(): Anthropic.Tool[] {
    return buildTools(this.client, this.memory)
  }

  async executeTool(
    name: string,
    input: Record<string, unknown>
  ): Promise<unknown> {
    return executeTool(name, input, this.client, this.memory)
  }
}
