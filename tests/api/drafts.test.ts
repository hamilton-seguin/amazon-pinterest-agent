import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  approveDraft,
  getDraftByAsin,
  getDrafts,
  skipDraft,
  updateDraft,
} from '../../src/api/drafts.js'
import { stores } from '../../src/storage/jsonStore.js'
import type { PinDraft } from '../../src/types.js'
import { createTmpDataDir, type TmpDataDir } from '../fixtures/tmpDataDir.js'
import { makeDraft } from '../fixtures/products.js'

async function seedDrafts(rows: PinDraft[]): Promise<void> {
  await stores.drafts.writeAll(rows)
}

describe('drafts api', () => {
  let tmp: TmpDataDir

  beforeEach(async () => {
    tmp = await createTmpDataDir()
  })

  afterEach(async () => {
    await tmp.cleanup()
  })

  describe('getDrafts', () => {
    it('returns all drafts when no status filter is passed', async () => {
      await seedDrafts([
        makeDraft({ asin: 'B000A00001', status: 'drafted' }),
        makeDraft({ asin: 'B000A00002', status: 'approved' }),
        makeDraft({ asin: 'B000A00003', status: 'skipped' }),
      ])
      const rows = await getDrafts()
      expect(rows.map((r) => r.asin).sort()).toEqual([
        'B000A00001',
        'B000A00002',
        'B000A00003',
      ])
    })

    it('filters by status', async () => {
      await seedDrafts([
        makeDraft({ asin: 'B000B00001', status: 'drafted' }),
        makeDraft({ asin: 'B000B00002', status: 'approved' }),
      ])
      const drafted = await getDrafts('drafted')
      const approved = await getDrafts('approved')
      expect(drafted.map((r) => r.asin)).toEqual(['B000B00001'])
      expect(approved.map((r) => r.asin)).toEqual(['B000B00002'])
    })
  })

  describe('getDraftByAsin', () => {
    it('returns the matching draft', async () => {
      await seedDrafts([makeDraft({ asin: 'B000FIND001' })])
      const d = await getDraftByAsin('B000FIND001')
      expect(d?.asin).toBe('B000FIND001')
    })

    it('returns undefined for unknown ASIN', async () => {
      await seedDrafts([makeDraft({ asin: 'B000FIND001' })])
      expect(await getDraftByAsin('B000NOPE001')).toBeUndefined()
    })
  })

  describe('updateDraft', () => {
    it('updates pinTitle and pinDescription only', async () => {
      await seedDrafts([
        makeDraft({
          asin: 'B000UPD0001',
          pinTitle: 'Old',
          pinDescription: 'Old desc',
          score: 42,
        }),
      ])
      const next = await updateDraft('B000UPD0001', {
        pinTitle: 'New title',
        pinDescription: 'New description',
      })
      expect(next.pinTitle).toBe('New title')
      expect(next.pinDescription).toBe('New description')
      expect(next.score).toBe(42)
      expect(next.status).toBe('drafted')
    })

    it('trims whitespace and ignores empty strings', async () => {
      await seedDrafts([
        makeDraft({ asin: 'B000UPD0002', pinTitle: 'Keep me' }),
      ])
      const next = await updateDraft('B000UPD0002', {
        pinTitle: '   ',
        pinDescription: '   New desc   ',
      })
      expect(next.pinTitle).toBe('Keep me')
      expect(next.pinDescription).toBe('New desc')
    })

    it('throws on unknown ASIN', async () => {
      await expect(updateDraft('B000MISS001', {})).rejects.toThrow(
        /Draft not found/,
      )
    })

    it('refuses to update terminal drafts (published/failed/skipped)', async () => {
      await seedDrafts([
        makeDraft({ asin: 'B000TERM001', status: 'published' }),
        makeDraft({ asin: 'B000TERM002', status: 'skipped' }),
      ])
      await expect(
        updateDraft('B000TERM001', { pinTitle: 'x' }),
      ).rejects.toThrow(/terminal status/)
      await expect(
        updateDraft('B000TERM002', { pinTitle: 'x' }),
      ).rejects.toThrow(/terminal status/)
    })
  })

  describe('approveDraft', () => {
    it('moves a drafted item to approved and mirrors it into approved store', async () => {
      await seedDrafts([makeDraft({ asin: 'B000APR0001', status: 'drafted' })])
      const next = await approveDraft('B000APR0001')
      expect(next.status).toBe('approved')
      const approved = await stores.approved.read()
      expect(approved.map((r) => r.asin)).toEqual(['B000APR0001'])
    })

    it('refuses to approve published or failed drafts', async () => {
      await seedDrafts([
        makeDraft({ asin: 'B000APR0002', status: 'published' }),
        makeDraft({ asin: 'B000APR0003', status: 'failed' }),
      ])
      await expect(approveDraft('B000APR0002')).rejects.toThrow(
        /Cannot approve/,
      )
      await expect(approveDraft('B000APR0003')).rejects.toThrow(
        /Cannot approve/,
      )
    })

    it('preserves unrelated drafts when approving one', async () => {
      await seedDrafts([
        makeDraft({ asin: 'B000APR0004', status: 'drafted' }),
        makeDraft({ asin: 'B000APR0005', status: 'drafted', pinTitle: 'keep' }),
      ])
      await approveDraft('B000APR0004')
      const other = await getDraftByAsin('B000APR0005')
      expect(other?.status).toBe('drafted')
      expect(other?.pinTitle).toBe('keep')
    })

    it('applies inline updates before approving', async () => {
      await seedDrafts([
        makeDraft({ asin: 'B000APR0006', pinTitle: 'Old title' }),
      ])
      const next = await approveDraft('B000APR0006', {
        pinTitle: 'Edited title',
      })
      expect(next.status).toBe('approved')
      expect(next.pinTitle).toBe('Edited title')
    })
  })

  describe('skipDraft', () => {
    it('moves a drafted item to skipped', async () => {
      await seedDrafts([makeDraft({ asin: 'B000SKP0001', status: 'drafted' })])
      const next = await skipDraft('B000SKP0001')
      expect(next.status).toBe('skipped')
    })

    it('refuses to skip published or failed drafts', async () => {
      await seedDrafts([
        makeDraft({ asin: 'B000SKP0002', status: 'published' }),
        makeDraft({ asin: 'B000SKP0003', status: 'failed' }),
      ])
      await expect(skipDraft('B000SKP0002')).rejects.toThrow(/Cannot skip/)
      await expect(skipDraft('B000SKP0003')).rejects.toThrow(/Cannot skip/)
    })

    it('throws on unknown ASIN', async () => {
      await expect(skipDraft('B000SKPMISS')).rejects.toThrow(/Draft not found/)
    })
  })
})
