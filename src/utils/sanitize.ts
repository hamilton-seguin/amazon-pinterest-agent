export const BANNED_PHRASES: ReadonlyArray<string> = [
  'guaranteed',
  'miracle',
  'cure',
  'cures',
  'official',
  '100% effective',
  'doctor recommended',
  'fda approved',
  'lose weight fast',
  'limited time only',
  'act now',
  'risk free',
]

export const RESTRICTED_CATEGORIES: ReadonlyArray<string> = [
  'supplement',
  'vape',
  'cbd',
  'weapon',
  'firearm',
  'pharmaceutical',
  'prescription',
  'adult toy',
]

export interface SanitizeResult {
  ok: boolean
  cleaned: string
  flagged: string[]
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function sanitizeCopy(text: string): SanitizeResult {
  const flagged: string[] = []
  let cleaned = text
  for (const phrase of BANNED_PHRASES) {
    const re = new RegExp(`\\b${escapeRe(phrase)}\\b`, 'gi')
    if (re.test(cleaned)) {
      flagged.push(phrase)
      cleaned = cleaned
        .replace(re, '')
        .replace(/\s{2,}/g, ' ')
        .trim()
    }
  }
  return { ok: flagged.length === 0, cleaned, flagged }
}

export function containsRestrictedCategory(text: string): string | null {
  const lower = text.toLowerCase()
  for (const term of RESTRICTED_CATEGORIES) {
    if (lower.includes(term)) return term
  }
  return null
}

export const AFFILIATE_DISCLOSURE =
  'Affiliate link — I may earn a commission <3'

export function ensureDisclosure(description: string): string {
  if (description.toLowerCase().includes('affiliate link')) return description
  return `${description.trim()}\n\n${AFFILIATE_DISCLOSURE}`
}
