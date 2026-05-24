import type { ProductCandidate } from '../types.js';
import { containsRestrictedCategory } from '../utils/sanitize.js';

const SPAM_TITLE_RE = /[!?]{3,}|[A-Z]{8,}|🔥{2,}/;
const MIN_REVIEWS = 50;
const MIN_RATING = 3.8;

export interface FilterResult {
  kept: ProductCandidate[];
  rejected: Array<{ product: ProductCandidate; reason: string }>;
}

export function filterCandidates(
  candidates: ProductCandidate[],
  publishedAsins: ReadonlySet<string>,
): FilterResult {
  const kept: ProductCandidate[] = [];
  const rejected: FilterResult['rejected'] = [];

  for (const p of candidates) {
    const reason = rejectReason(p, publishedAsins);
    if (reason) rejected.push({ product: p, reason });
    else kept.push(p);
  }
  return { kept, rejected };
}

function rejectReason(
  p: ProductCandidate,
  publishedAsins: ReadonlySet<string>,
): string | null {
  if (publishedAsins.has(p.asin)) return 'already-published';
  if (!p.imageUrl?.trim()) return 'missing-image';
  if (!p.title?.trim()) return 'missing-title';
  if (SPAM_TITLE_RE.test(p.title)) return 'spammy-title';
  const restricted = containsRestrictedCategory(p.title);
  if (restricted) return `restricted-category:${restricted}`;
  if (p.reviewCount !== undefined && p.reviewCount < MIN_REVIEWS) {
    return 'too-few-reviews';
  }
  if (p.rating !== undefined && p.rating < MIN_RATING) {
    return 'low-rating';
  }
  return null;
}
