import { defineConfig } from "tsup"

export default defineConfig([
  // SDK entry
  {
    entry: ["src/index.ts"],
    format: ["cjs"],
    dts: true,
    clean: true,
    outDir: "dist",
  },
  // CLI entry (with shebang)
  {
    entry: ["src/cli/index.ts"],
    format: ["cjs"],
    dts: false,
    outDir: "dist/cli",
    banner: { js: "#!/usr/bin/env node" },
  },
  // MCP server entry
  {
    entry: ["src/mcp/server.ts"],
    format: ["cjs"],
    dts: true,
    outDir: "dist/mcp",
  },
])
