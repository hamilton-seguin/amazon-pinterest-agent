import type { PinDraft, PinStatus } from '../types.js'
import { stores } from '../storage/jsonStore.js'

export type DraftUpdate = Partial<Pick<PinDraft, 'pinTitle' | 'pinDescription'>>

const TERMINAL_STATUSES: PinStatus[] = ['published', 'failed', 'skipped']

function isTerminal(status: PinStatus): boolean {
  return TERMINAL_STATUSES.includes(status)
}

export async function getDrafts(status?: PinStatus): Promise<PinDraft[]> {
  const rows = await stores.drafts.read()
  if (!status) return rows
  return rows.filter((d) => d.status === status)
}

export async function getDraftByAsin(
  asin: string,
): Promise<PinDraft | undefined> {
  const rows = await stores.drafts.read()
  return rows.find((d) => d.asin === asin)
}

/**
 * Atomic read-modify-write under the drafts store mutex. Concurrent calls
 * are serialized, so two approves on the same ASIN can't clobber each other.
 */
async function mutateDraft(
  asin: string,
  mutate: (draft: PinDraft) => PinDraft,
): Promise<PinDraft> {
  let next: PinDraft | undefined
  await stores.drafts.update((rows) => {
    const idx = rows.findIndex((d) => d.asin === asin)
    if (idx < 0) throw new Error(`Draft not found: ${asin}`)
    next = mutate(rows[idx]!)
    const out = [...rows]
    out[idx] = next
    return out
  })
  return next!
}

export async function updateDraft(
  asin: string,
  updates: DraftUpdate,
): Promise<PinDraft> {
  return mutateDraft(asin, (current) => {
    if (isTerminal(current.status)) {
      throw new Error(`Cannot edit draft in terminal status: ${current.status}`)
    }
    const next: PinDraft = { ...current }
    if (typeof updates.pinTitle === 'string' && updates.pinTitle.trim()) {
      next.pinTitle = updates.pinTitle.trim()
    }
    if (
      typeof updates.pinDescription === 'string' &&
      updates.pinDescription.trim()
    ) {
      next.pinDescription = updates.pinDescription.trim()
    }
    return next
  })
}

export async function approveDraft(
  asin: string,
  updates?: DraftUpdate,
): Promise<PinDraft> {
  if (updates) await updateDraft(asin, updates)
  const next = await mutateDraft(asin, (current) => {
    if (current.status === 'published' || current.status === 'failed') {
      throw new Error(`Cannot approve draft in status: ${current.status}`)
    }
    return { ...current, status: 'approved' }
  })

  await stores.approved.update((existing) => {
    const byAsin = new Map(existing.map((d) => [d.asin, d]))
    byAsin.set(next.asin, next)
    return [...byAsin.values()]
  })
  return next
}

export async function skipDraft(asin: string): Promise<PinDraft> {
  return mutateDraft(asin, (current) => {
    if (current.status === 'published' || current.status === 'failed') {
      throw new Error(`Cannot skip draft in status: ${current.status}`)
    }
    return { ...current, status: 'skipped' }
  })
}
