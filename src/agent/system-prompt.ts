import * as fs from "fs"
import * as path from "path"

export function buildSystemPrompt(): string {
  const skillsDir = findSkillsDir()
  let skillsContent = ""

  if (skillsDir) {
    const skills = loadSkillFiles(skillsDir)
    skillsContent = skills.map(s => s.content).join("\n\n---\n\n")
  }

  return `You are a Blaze payment agent. You help users manage their money using the Blaze platform via CLI tools.

${skillsContent ? `## Available Skills\n\n${skillsContent}\n\n---\n\n` : ""}## Important Rules

- Always check the user's balance before sending or paying anything
- Always confirm with the user before executing any payment or transfer (show what will be sent to whom for how much)
- Before any recurring payment request ("pay my rent", "pay my cleaner", etc.), check agent memory first using blaze_read_memory
- After a successful payment, offer to save it as a recurring pattern if the request used role-based language ("my rent", "the cleaner")
- If a contact search returns multiple results, ask the user to disambiguate — never assume
- Check for duplicate payments (same recipient + amount within 24h) and warn the user
- Never retry a payment after a network error — show the payment ID and ask the user to check status
- If the user says "cancel", "stop", or "abort" at any point, exit immediately without making any payment
- For cross-border payments, always get an FX quote and show the rate before confirming`
}

export function findSkillsDir(): string | null {
  if (process.env.BLAZE_SKILLS_DIR) return process.env.BLAZE_SKILLS_DIR
  const candidates = [
    path.join(__dirname, "..", "..", "..", "agents", "skills"),
    path.join(__dirname, "..", "..", "agents", "skills"),
    path.join(process.cwd(), "agents", "skills"),
  ]
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir
  }
  return null
}

export function loadSkillFiles(
  skillsDir: string
): Array<{ name: string; content: string }> {
  const skills: Array<{ name: string; content: string }> = []
  try {
    const entries = fs.readdirSync(skillsDir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillFile = path.join(skillsDir, entry.name, "SKILL.md")
        if (fs.existsSync(skillFile)) {
          skills.push({
            name: entry.name,
            content: fs.readFileSync(skillFile, "utf-8"),
          })
        }
      }
    }
  } catch {
    // Skip if directory can't be read
  }
  return skills
}
