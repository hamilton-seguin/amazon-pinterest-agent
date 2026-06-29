const SECRET_KEY_PATTERN = /(token|secret|key|authorization|password|bearer)/i
const ALREADY_MASKED_PATTERN = /^(?:\*{2,}|\(empty\)$)/

export function maskSecret(value: string | undefined | null): string {
  if (!value) return '(empty)'
  const trimmed = value.trim()
  // Idempotent: passing a previously-masked value through twice would slice
  // off the last 4 chars of "****abcd" and produce garbage like "**abcd".
  if (ALREADY_MASKED_PATTERN.test(trimmed)) return trimmed
  if (trimmed.length <= 4) return '****'
  return `****${trimmed.slice(-4)}`
}

export function maskRecord(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (SECRET_KEY_PATTERN.test(k) && typeof v === 'string') {
      out[k] = maskSecret(v)
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = maskRecord(v as Record<string, unknown>)
    } else {
      out[k] = v
    }
  }
  return out
}
