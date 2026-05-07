import { Command } from "commander"
import { confirm } from "@inquirer/prompts"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"

const MEMORY_FILE = path.join(os.homedir(), ".blaze", "agent-memory.md")

function readMemory(): string | null {
  try {
    return fs.readFileSync(MEMORY_FILE, "utf-8")
  } catch {
    return null
  }
}

function writeMemory(content: string): void {
  const dir = path.dirname(MEMORY_FILE)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(MEMORY_FILE, content, "utf-8")
}

export function registerMemoryCommands(program: Command): void {
  const memory = program.command("memory").description("Manage agent memory")

  memory
    .command("show")
    .description("Show agent memory contents")
    .action(async () => {
      const content = readMemory()
      if (!content) {
        console.log("No memory yet.")
        return
      }
      console.log(content)
    })

  memory
    .command("clear")
    .description("Clear all agent memory")
    .option("-y, --yes", "Skip confirmation prompt")
    .action(async (opts: { yes?: boolean }) => {
      try {
        if (!opts.yes) {
          const confirmed = await confirm({
            message: "Clear all agent memory? This cannot be undone.",
          })
          if (!confirmed) {
            console.log("Cancelled.")
            return
          }
        }
        try {
          fs.unlinkSync(MEMORY_FILE)
          console.log("Memory cleared.")
        } catch {
          console.log("No memory file found.")
        }
      } catch (err) {
        if (err instanceof Error) {
          console.error(`Error: ${err.message}`)
        } else {
          console.error("An unexpected error occurred")
        }
        process.exit(1)
      }
    })

  memory
    .command("forget <pattern>")
    .description("Remove a named section from memory")
    .action(async (pattern: string) => {
      try {
        const content = readMemory()
        if (!content) {
          console.log("No memory yet.")
          return
        }

        // Remove section that starts with the pattern (heading or line containing it)
        const lines = content.split("\n")
        const filtered: string[] = []
        let inSection = false

        for (const line of lines) {
          const isHeading = /^#+\s/.test(line)
          if (isHeading && line.toLowerCase().includes(pattern.toLowerCase())) {
            inSection = true
            continue
          }
          if (inSection && isHeading) {
            inSection = false
          }
          if (!inSection) {
            filtered.push(line)
          }
        }

        const updated = filtered
          .join("\n")
          .replace(/\n{3,}/g, "\n\n")
          .trim()
        if (updated === content.trim()) {
          console.log(`Pattern "${pattern}" not found in memory.`)
          return
        }

        writeMemory(updated + "\n")
        console.log(`Removed section matching "${pattern}" from memory.`)
      } catch (err) {
        if (err instanceof Error) {
          console.error(`Error: ${err.message}`)
        } else {
          console.error("An unexpected error occurred")
        }
        process.exit(1)
      }
    })
}
