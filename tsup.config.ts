import { defineConfig } from "tsup"

export default defineConfig([
  // SDK + Agent + MCP (no shebang needed)
  {
    entry: {
      index: "src/index.ts",
      "agent/orchestrator": "src/agent/orchestrator.ts",
      "mcp/server": "src/mcp/server.ts",
    },
    format: ["cjs"],
    dts: true,
    clean: true,
    outDir: "dist",
  },
  // CLI entry
  {
    entry: { "cli/index": "src/cli/index.ts" },
    format: ["cjs"],
    dts: false,
    outDir: "dist",
  },
])
