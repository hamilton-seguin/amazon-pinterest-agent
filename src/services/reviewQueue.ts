import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import type { PinDraft } from '../types.js';
import { stores } from '../storage/jsonStore.js';
import { logger } from '../utils/logger.js';

type Decision = 'a' | 's' | 'e' | 'q';

function prettyPrint(d: PinDraft, idx: number, total: number): void {
  console.log('');
  console.log('─'.repeat(72));
  console.log(`Draft ${idx + 1}/${total}  •  ASIN ${d.asin}  •  score ${d.score}  •  ${d.category}`);
  console.log(`Image:        ${d.imageUrl}`);
  console.log(`Affiliate:    ${d.affiliateUrl}`);
  console.log('');
  console.log(`Title:        ${d.pinTitle}`);
  console.log('');
  console.log('Description:');
  console.log(d.pinDescription);
  console.log('─'.repeat(72));
}

async function promptDecision(rl: readline.Interface): Promise<Decision> {
  while (true) {
    const ans = (await rl.question('[a]pprove / [s]kip / [e]dit / [q]uit: '))
      .trim()
      .toLowerCase();
    if (ans === 'a' || ans === 's' || ans === 'e' || ans === 'q') {
      return ans;
    }
    console.log('Invalid option.');
  }
}

async function editDraft(d: PinDraft, rl: readline.Interface): Promise<PinDraft> {
  const newTitle = (await rl.question(`New title (blank = keep): `)).trim();
  const newDesc = (await rl.question(`New description (blank = keep, single line): `)).trim();
  return {
    ...d,
    pinTitle: newTitle || d.pinTitle,
    pinDescription: newDesc || d.pinDescription,
  };
}

export async function runReviewQueue(): Promise<{
  approved: PinDraft[];
  skipped: PinDraft[];
  remaining: PinDraft[];
}> {
  const drafts = await stores.drafts.read();
  const pending = drafts.filter((d) => d.status === 'drafted');
  if (pending.length === 0) {
    logger.info('No drafts pending review. Run generate:candidates first.');
    return { approved: [], skipped: [], remaining: [] };
  }

  const rl = readline.createInterface({ input, output });
  const approved: PinDraft[] = [];
  const skipped: PinDraft[] = [];
  const remaining: PinDraft[] = [];
  let quit = false;

  try {
    for (let i = 0; i < pending.length; i += 1) {
      const current = pending[i]!;
      if (quit) {
        remaining.push(current);
        continue;
      }
      prettyPrint(current, i, pending.length);
      const decision = await promptDecision(rl);
      if (decision === 'q') {
        quit = true;
        remaining.push(current);
        continue;
      }
      if (decision === 'a') {
        approved.push({ ...current, status: 'approved' });
        continue;
      }
      if (decision === 's') {
        skipped.push({ ...current, status: 'skipped' });
        continue;
      }
      const edited = await editDraft(current, rl);
      approved.push({ ...edited, status: 'approved' });
    }
  } finally {
    rl.close();
  }

  const untouched = drafts.filter((d) => d.status !== 'drafted');
  const reviewed = [...approved, ...skipped, ...remaining];
  await stores.drafts.writeAll([...untouched, ...reviewed]);
  if (approved.length > 0) {
    const existing = await stores.approved.read();
    const byAsin = new Map(existing.map((d) => [d.asin, d]));
    for (const a of approved) byAsin.set(a.asin, a);
    await stores.approved.writeAll([...byAsin.values()]);
  }
  return { approved, skipped, remaining };
}
