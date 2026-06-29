import type { AppConfig } from '../config.js'
import {
  AnthropicCopyProvider,
  OpenAiCopyProvider,
  type CopyOutput,
  type CopyProvider,
} from '../providers/ai/copyGeneratorClient.js'
import type { Category, ProductCandidate } from '../types.js'
import { logger } from '../utils/logger.js'
import {
  AFFILIATE_DISCLOSURE,
  ensureDisclosure,
  sanitizeCopy,
} from '../utils/sanitize.js'

const AUDIENCE: Record<Category, string> = {
  travel: 'frequent travelers and weekend trip planners',
  fashion: 'style-focused shoppers building a versatile wardrobe',
  beauty: 'people who love a tidy, photogenic vanity setup',
  baby: 'new parents and gift-givers looking for practical baby finds',
}

const USE_CASE: Record<Category, string> = {
  travel: 'staying organized in a carry-on',
  fashion: 'finishing off everyday outfits',
  beauty: 'keeping a clean, functional skincare routine',
  baby: 'simplifying nursery storage and on-the-go essentials',
}

function deterministicCopy(
  product: ProductCandidate,
  category: Category,
): CopyOutput {
  const cleanTitle = product.title.replace(/\s+[—|]\s+.*$/, '').trim()
  const audience = AUDIENCE[category]
  const useCase = USE_CASE[category]

  const pinTitle = clampTitle(cleanTitle, 80)
  const pinDescription = [
    `${cleanTitle} — a simple find for ${useCase}.`,
    `Made for ${audience}.`,
    'Tap the Pin to see details and reviews on Amazon.',
    AFFILIATE_DISCLOSURE,
  ].join(' ')

  return { pinTitle, pinDescription }
}

/**
 * Hard-cut at `max` but back off to the previous word boundary if we'd split
 * a word, appending "…" so truncation is visible. Empty input → empty out.
 */
function clampTitle(text: string, max: number): string {
  const trimmed = text.trim()
  if (trimmed.length <= max) return trimmed
  const slice = trimmed.slice(0, max)
  const lastSpace = slice.lastIndexOf(' ')
  const cut = lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice
  return `${cut.trimEnd()}…`
}

function chooseProvider(cfg: AppConfig): CopyProvider | null {
  if (cfg.COPY_PROVIDER === 'anthropic' && cfg.ANTHROPIC_API_KEY) {
    return new AnthropicCopyProvider(cfg.ANTHROPIC_API_KEY, cfg.ANTHROPIC_MODEL)
  }
  if (cfg.COPY_PROVIDER === 'openai' && cfg.OPENAI_API_KEY) {
    return new OpenAiCopyProvider(cfg.OPENAI_API_KEY, cfg.OPENAI_MODEL)
  }
  return null
}

export async function generateCopy(
  product: ProductCandidate,
  cfg: AppConfig,
): Promise<CopyOutput> {
  const provider = chooseProvider(cfg)
  let raw: CopyOutput
  if (provider) {
    try {
      raw = await provider.generate({ product, category: product.category })
    } catch (err) {
      logger.warn('AI copy failed, falling back to template', {
        provider: provider.name,
        error: err instanceof Error ? err.message : String(err),
      })
      raw = deterministicCopy(product, product.category)
    }
  } else {
    raw = deterministicCopy(product, product.category)
  }

  const titleSan = sanitizeCopy(raw.pinTitle)
  const descSan = sanitizeCopy(raw.pinDescription)
  if (titleSan.flagged.length || descSan.flagged.length) {
    logger.warn('Removed banned phrases from generated copy', {
      asin: product.asin,
      flagged: [...titleSan.flagged, ...descSan.flagged],
    })
  }
  return {
    pinTitle: clampTitle(titleSan.cleaned, 100),
    pinDescription: ensureDisclosure(descSan.cleaned).slice(0, 500),
  }
}
