/**
 * PII masking for eval artifacts.
 *
 * Eval runs exercise the agent against REAL staging data, so the persisted
 * artifacts (markdown report, trace dump, HTML viewer) must never contain
 * personal data. The agent and LLM judge still operate on real data at runtime —
 * masking happens only at the write boundary, so grading fidelity is unaffected.
 *
 * Strategy: collect exact PII *values* from structured tool results — identifier
 * fields (email, phone, blazetag, wallet/stellar keys) and person-name fields —
 * into a dictionary, then replace those exact strings everywhere in the rendered
 * report (this catches names echoed into free-text answers / judge reasons),
 * backstopped by structural regexes for emails, Stellar keys, and E.164 phones.
 *
 * Deliberately NARROW to avoid corrupting non-PII text: the overloaded `name`
 * key (tool names, merchant/category names) is NOT treated as PII, and
 * person-name values that look like identifiers or are short fixtures are
 * skipped (see isLikelyName).
 */

export const MASK = "*****"

// Keys whose string values are unambiguous personal identifiers — masked as-is.
const ID_KEY =
  /^(email|phone|phone_number|blazetag|stellar_public_key|wallet_public_key)$/i
// Person-name keys — masked only when the value looks like a real name.
const NAME_KEY = /^(first_name|last_name|full_name)$/i

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
const STELLAR = /\bG[A-Z2-7]{55}\b/g
const E164 = /\+\d{10,15}\b/g

/**
 * A value is a likely person name (safe to mask globally) when it is NOT a
 * snake_case/identifier token (e.g. tool names like "blaze_get_balance") and is
 * either multi-word or reasonably long. This keeps short fixtures ("Eval",
 * "Bot") and identifiers from corrupting non-PII text when masked globally.
 */
function isLikelyName(s: string): boolean {
  if (/^[a-z][a-z0-9_]*$/.test(s)) return false // identifier-ish, never a person name
  return s.includes(" ") || s.length >= 5
}

/** Recursively collect PII values from a structured tool result. */
export function collectPii(value: unknown, into: Set<string>): void {
  if (typeof value === "string") {
    for (const m of value.match(EMAIL) ?? []) into.add(m)
    for (const m of value.match(STELLAR) ?? []) into.add(m)
    for (const m of value.match(E164) ?? []) into.add(m)
    return
  }
  if (Array.isArray(value)) {
    for (const v of value) collectPii(v, into)
    return
  }
  if (value === null || typeof value !== "object") return
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "string" && v.trim().length >= 2) {
      const val = v.trim()
      if (ID_KEY.test(k)) {
        into.add(val)
        continue
      }
      if (NAME_KEY.test(k) && isLikelyName(val)) {
        into.add(val)
        continue
      }
    }
    collectPii(v, into)
  }
}

/**
 * Mask known PII values + structural patterns in a rendered report string.
 * Known values are masked longest-first so substrings don't corrupt the result.
 */
export function maskPii(text: string, known: Iterable<string> = []): string {
  let out = text
  const vals = [...new Set(known)]
    .map(v => v.trim())
    .filter(v => v.length >= 3)
    .sort((a, b) => b.length - a.length)
  for (const v of vals) out = out.split(v).join(MASK)
  return out.replace(EMAIL, MASK).replace(STELLAR, MASK).replace(E164, MASK)
}
