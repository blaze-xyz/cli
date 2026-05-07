import * as fs from "fs"
import * as path from "path"
import * as os from "os"

export interface RecurringPattern {
  trigger: string
  contactId?: string
  contactName?: string
  blazetag?: string
  contactType?: string
  amount?: number
  currency?: string
  noteTemplate?: string
  lastPaid?: string
  lastPaymentId?: string
}

export interface PaymentRecord {
  date: string
  amount: number
  currency: string
  to: string
  note: string
  paymentId: string
}

interface ContactAlias {
  alias: string
  target: string // contactId or blazetag
}

export interface AgentMemory {
  patterns: RecurringPattern[]
  aliases: ContactAlias[]
  recentPayments: PaymentRecord[]
}

const MEMORY_DIR = path.join(os.homedir(), ".blaze")
const MEMORY_FILE = path.join(MEMORY_DIR, "agent-memory.md")

function emptyMemory(): AgentMemory {
  return { patterns: [], aliases: [], recentPayments: [] }
}

/**
 * Normalise a trigger string for fuzzy matching:
 * lowercase, trim, strip leading "my " / "the ", collapse whitespace.
 */
function normaliseTrigger(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^(my|the)\s+/, "")
    .replace(/\s+payment$/, "")
}

/**
 * Serialize an AgentMemory object to markdown text.
 */
function serialise(memory: AgentMemory): string {
  const lines: string[] = ["# Blaze Agent Memory", ""]

  lines.push("## Recurring Patterns", "")
  for (const p of memory.patterns) {
    lines.push(`### ${p.trigger}`)
    if (p.contactId) lines.push(`- Contact ID: ${p.contactId}`)
    if (p.contactName) lines.push(`- Contact Name: ${p.contactName}`)
    if (p.blazetag) lines.push(`- Blazetag: ${p.blazetag}`)
    if (p.contactType) lines.push(`- Contact Type: ${p.contactType}`)
    if (p.amount !== undefined) lines.push(`- Amount: ${p.amount}`)
    if (p.currency) lines.push(`- Currency: ${p.currency}`)
    if (p.noteTemplate) lines.push(`- Note Template: ${p.noteTemplate}`)
    if (p.lastPaid) lines.push(`- Last Paid: ${p.lastPaid}`)
    if (p.lastPaymentId) lines.push(`- Payment ID: ${p.lastPaymentId}`)
    lines.push("")
  }

  lines.push("## Contact Aliases", "")
  for (const a of memory.aliases) {
    lines.push(`- "${a.alias}" → ${a.target}`)
  }
  lines.push("")

  lines.push("## Recent Payments", "")
  for (const r of memory.recentPayments) {
    lines.push(
      `- ${r.date}: $${r.amount} ${r.currency} → ${r.to} | ${r.note} | ${r.paymentId}`
    )
  }
  lines.push("")

  return lines.join("\n")
}

/**
 * Parse a markdown memory file into an AgentMemory object.
 * Missing or malformed sections are silently ignored — returns empty defaults.
 */
function parse(content: string): AgentMemory {
  const memory = emptyMemory()

  // Split into top-level sections by "## " headings
  const sectionRegex = /^## (.+)$/m
  const parts = content.split(/^(?=## )/m)

  for (const part of parts) {
    const headingMatch = part.match(sectionRegex)
    if (!headingMatch) continue
    const sectionName = headingMatch[1].trim()

    if (sectionName === "Recurring Patterns") {
      // Each pattern starts with "### trigger"
      const patternBlocks = part.split(/^(?=### )/m).slice(1)
      for (const block of patternBlocks) {
        const lines = block.split("\n")
        const triggerLine = lines[0]
        if (!triggerLine) continue
        const trigger = triggerLine.replace(/^###\s+/, "").trim()
        const pattern: RecurringPattern = { trigger }
        for (const line of lines.slice(1)) {
          const m = line.match(/^-\s+(.+?):\s+(.+)$/)
          if (!m) continue
          const [, key, val] = m
          switch (key.trim()) {
            case "Contact ID":
              pattern.contactId = val.trim()
              break
            case "Contact Name":
              pattern.contactName = val.trim()
              break
            case "Blazetag":
              pattern.blazetag = val.trim()
              break
            case "Contact Type":
              pattern.contactType = val.trim()
              break
            case "Amount":
              pattern.amount = Number(val.trim())
              break
            case "Currency":
              pattern.currency = val.trim()
              break
            case "Note Template":
              pattern.noteTemplate = val.trim()
              break
            case "Last Paid":
              pattern.lastPaid = val.trim()
              break
            case "Payment ID":
              pattern.lastPaymentId = val.trim()
              break
          }
        }
        memory.patterns.push(pattern)
      }
    } else if (sectionName === "Contact Aliases") {
      for (const line of part.split("\n")) {
        // - "alias" → target
        const m = line.match(/^-\s+"([^"]+)"\s+→\s+(.+)$/)
        if (!m) continue
        memory.aliases.push({ alias: m[1].trim(), target: m[2].trim() })
      }
    } else if (sectionName === "Recent Payments") {
      for (const line of part.split("\n")) {
        // - date: $amount currency → to | note | paymentId
        const m = line.match(
          /^-\s+(.+?):\s+\$([0-9.]+)\s+(\S+)\s+→\s+(.+?)\s+\|\s+(.+?)\s+\|\s+(\S+)$/
        )
        if (!m) continue
        memory.recentPayments.push({
          date: m[1].trim(),
          amount: Number(m[2]),
          currency: m[3].trim(),
          to: m[4].trim(),
          note: m[5].trim(),
          paymentId: m[6].trim(),
        })
      }
    }
  }

  return memory
}

export class MemoryStore {
  private filePath: string

  constructor(customPath?: string) {
    this.filePath = customPath ?? process.env.BLAZE_MEMORY_PATH ?? MEMORY_FILE
  }

  read(): AgentMemory {
    try {
      if (!fs.existsSync(this.filePath)) return emptyMemory()
      const content = fs.readFileSync(this.filePath, "utf-8")
      return parse(content)
    } catch (err) {
      console.warn(
        `[blaze-agent] Warning: could not read memory file: ${err instanceof Error ? err.message : String(err)}`
      )
      return emptyMemory()
    }
  }

  write(memory: AgentMemory): void {
    if (!fs.existsSync(MEMORY_DIR)) {
      fs.mkdirSync(MEMORY_DIR, { recursive: true })
    }
    fs.writeFileSync(this.filePath, serialise(memory), "utf-8")
  }

  clear(): void {
    if (fs.existsSync(this.filePath)) {
      fs.unlinkSync(this.filePath)
    }
  }

  findPattern(trigger: string): RecurringPattern | null {
    const memory = this.read()
    const normTarget = normaliseTrigger(trigger)
    for (const p of memory.patterns) {
      const normStored = normaliseTrigger(p.trigger)
      // Exact match after normalisation, or one contains the other
      if (
        normStored === normTarget ||
        normStored.includes(normTarget) ||
        normTarget.includes(normStored)
      ) {
        return p
      }
    }
    return null
  }

  savePattern(
    trigger: string,
    pattern: Omit<RecurringPattern, "trigger">
  ): void {
    const memory = this.read()
    const idx = memory.patterns.findIndex(
      p => normaliseTrigger(p.trigger) === normaliseTrigger(trigger)
    )
    const full: RecurringPattern = { trigger, ...pattern }
    if (idx >= 0) {
      memory.patterns[idx] = full
    } else {
      memory.patterns.push(full)
    }
    this.write(memory)
  }

  updateLastPaid(trigger: string, paymentId: string, date: string): void {
    const memory = this.read()
    const idx = memory.patterns.findIndex(
      p => normaliseTrigger(p.trigger) === normaliseTrigger(trigger)
    )
    if (idx >= 0) {
      memory.patterns[idx].lastPaid = date
      memory.patterns[idx].lastPaymentId = paymentId
      this.write(memory)
    }
  }

  logPayment(record: PaymentRecord): void {
    const memory = this.read()
    memory.recentPayments.unshift(record)
    if (memory.recentPayments.length > 20) {
      memory.recentPayments = memory.recentPayments.slice(0, 20)
    }
    this.write(memory)
  }

  findAlias(alias: string): string | null {
    const memory = this.read()
    const norm = alias.toLowerCase().trim()
    const found = memory.aliases.find(
      a => a.alias.toLowerCase().trim() === norm
    )
    return found?.target ?? null
  }

  saveAlias(alias: string, target: string): void {
    const memory = this.read()
    const idx = memory.aliases.findIndex(
      a => a.alias.toLowerCase().trim() === alias.toLowerCase().trim()
    )
    if (idx >= 0) {
      memory.aliases[idx].target = target
    } else {
      memory.aliases.push({ alias, target })
    }
    this.write(memory)
  }
}
