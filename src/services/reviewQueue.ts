import * as readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import type { PinDraft } from '../types.js'
import { approveDraft, getDrafts, skipDraft } from '../api/drafts.js'
import { logger } from '../utils/logger.js'

type Decision = 'a' | 's' | 'e' | 'q'

function prettyPrint(d: PinDraft, idx: number, total: number): void {
  console.log('')
  console.log('─'.repeat(72))
  console.log(
    `Draft ${idx + 1}/${total}  •  ASIN ${d.asin}  •  score ${d.score}  •  ${d.category}`,
  )
  console.log(`Image:        ${d.imageUrl}`)
  console.log(`Affiliate:    ${d.affiliateUrl}`)
  console.log('')
  console.log(`Title:        ${d.pinTitle}`)
  console.log('')
  console.log('Description:')
  console.log(d.pinDescription)
  console.log('─'.repeat(72))
}

async function promptDecision(rl: readline.Interface): Promise<Decision> {
  while (true) {
    const ans = (await rl.question('[a]pprove / [s]kip / [e]dit / [q]uit: '))
      .trim()
      .toLowerCase()
    if (ans === 'a' || ans === 's' || ans === 'e' || ans === 'q') {
      return ans
    }
    console.log('Invalid option.')
  }
}

async function promptEdit(
  d: PinDraft,
  rl: readline.Interface,
): Promise<{ pinTitle?: string; pinDescription?: string }> {
  const newTitle = (await rl.question(`New title (blank = keep): `)).trim()
  const newDesc = (
    await rl.question(`New description (blank = keep, single line): `)
  ).trim()
  const updates: { pinTitle?: string; pinDescription?: string } = {}
  if (newTitle) updates.pinTitle = newTitle
  if (newDesc) updates.pinDescription = newDesc
  return updates
}

export async function runReviewQueue(): Promise<{
  approved: PinDraft[]
  skipped: PinDraft[]
  remaining: PinDraft[]
}> {
  const pending = await getDrafts('drafted')
  if (pending.length === 0) {
    logger.info('No drafts pending review. Run `npm run draft` first.')
    return { approved: [], skipped: [], remaining: [] }
  }

  const rl = readline.createInterface({ input, output })
  const approved: PinDraft[] = []
  const skipped: PinDraft[] = []
  const remaining: PinDraft[] = []
  let quit = false

  try {
    for (let i = 0; i < pending.length; i += 1) {
      const current = pending[i]!
      if (quit) {
        remaining.push(current)
        continue
      }
      prettyPrint(current, i, pending.length)
      const decision = await promptDecision(rl)
      if (decision === 'q') {
        quit = true
        remaining.push(current)
        continue
      }
      if (decision === 'a') {
        approved.push(await approveDraft(current.asin))
        continue
      }
      if (decision === 's') {
        skipped.push(await skipDraft(current.asin))
        continue
      }
      const updates = await promptEdit(current, rl)
      // approveDraft accepts updates so we do a single locked mutation.
      approved.push(
        await approveDraft(
          current.asin,
          Object.keys(updates).length > 0 ? updates : undefined,
        ),
      )
    }
  } finally {
    rl.close()
  }

  return { approved, skipped, remaining }
}
