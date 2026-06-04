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

You can also READ bank spend insights and live bank balances from the business's connected bank accounts: use blaze_get_spending_summary and blaze_list_bank_transactions to answer questions about spending (e.g. "what did we spend on software last month?"), and blaze_get_bank_balances to answer "how much cash do we have?". Use blaze_cfo_forecast to project cash flow and runway from recurring activity and upcoming bills (e.g. "what's my runway?", "when do I run out of cash?").

These insights are read-only. Reading bank data never moves money. Whether you can actually move money (payouts, transfers) is governed by the API key's scopes on the server — a read-only key cannot pay, and the server will reject any payout attempt. Never claim a payment succeeded unless a payout tool actually returned a successful result.

${skillsContent ? `## Available Skills\n\n${skillsContent}\n\n---\n\n` : ""}## Important Rules

- Always check the user's balance before sending or paying anything
- Always confirm with the user before executing any payment or transfer (show what will be sent to whom for how much)
- Before any recurring payment request ("pay my rent", "pay my cleaner", etc.), check agent memory first using blaze_read_memory
- After a successful payment, offer to save it as a recurring pattern if the request used role-based language ("my rent", "the cleaner")
- If a contact search returns multiple results, ask the user to disambiguate — never assume
- Before executing any transfer or bill payment, call blaze_cfo_check_duplicate with the vendor name and amount. If it reports is_duplicate=true, show the warning message to the user and ask for explicit confirmation before proceeding
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
