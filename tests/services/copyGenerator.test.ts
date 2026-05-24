import { describe, expect, it } from 'vitest'
import { generateCopy } from '../../src/services/copyGenerator.js'
import type { AppConfig } from '../../src/config.js'
import { makeCandidate } from '../fixtures/products.js'

function fallbackConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    AMAZON_PROVIDER: 'mock',
    COPY_PROVIDER: 'template',
    DRY_RUN: true,
    LOG_LEVEL: 'info',
    AMAZON_ASSOCIATE_TAG: 'mytag-21',
    AMAZON_MARKETPLACE: 'www.amazon.fr',
    PLAYWRIGHT_HEADLESS: false,
    AMAZON_BESTSELLER_MAX_PRODUCTS: 9,
    isLivePublish: false,
    ...overrides,
  } as AppConfig
}

describe('generateCopy (fallback / template provider)', () => {
  it('produces non-empty title and description when no AI key is configured', async () => {
    const out = await generateCopy(makeCandidate(), fallbackConfig())
    expect(out.pinTitle.length).toBeGreaterThan(0)
    expect(out.pinDescription.length).toBeGreaterThan(0)
  })

  it('keeps title <= 100 chars and description <= 500 chars', async () => {
    const out = await generateCopy(makeCandidate(), fallbackConfig())
    expect(out.pinTitle.length).toBeLessThanOrEqual(100)
    expect(out.pinDescription.length).toBeLessThanOrEqual(500)
  })

  it('includes affiliate disclosure in description', async () => {
    const out = await generateCopy(makeCandidate(), fallbackConfig())
    expect(out.pinDescription.toLowerCase()).toContain('affiliate link')
  })

  it('falls back to template when COPY_PROVIDER is openai but no key is set', async () => {
    const out = await generateCopy(
      makeCandidate({ asin: 'B000FALLB01' }),
      fallbackConfig({ COPY_PROVIDER: 'openai' }),
    )
    expect(out.pinDescription.toLowerCase()).toContain('affiliate link')
  })

  it('does not throw when product is missing optional fields', async () => {
    const lean = makeCandidate({
      asin: 'B000LEAN001',
      title: 'Travel Organizer Set',
      price: undefined,
      rating: undefined,
      reviewCount: undefined,
    } as unknown as Parameters<typeof makeCandidate>[0])
    const out = await generateCopy(lean, fallbackConfig())
    expect(out.pinTitle).toBeTruthy()
  })
})
