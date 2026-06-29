/**
 * Temporary Playwright-based Amazon Best Sellers collector.
 *
 * Replace with the official PA-API client once your Amazon Associate
 * account is validated. This file is intentionally simple to keep
 * deletion easy.
 *
 * Rules:
 * - Does not solve or bypass CAPTCHA. Stops with a clear message if seen.
 * - Does not use stealth plugins, proxies, or fake identities.
 * - Uses polite delays between page loads.
 * - Headful by default. Set PLAYWRIGHT_HEADLESS=true to hide window.
 */
import type { Browser, Page } from 'playwright'
import type { AppConfig } from '../../config.js'
import { buildAffiliateUrl } from '../../services/affiliateLinkBuilder.js'
import type { Category, ProductCandidate } from '../../types.js'
import { logger } from '../../utils/logger.js'

const ASIN_RE = /\/dp\/([A-Z0-9]{10})(?:[/?]|$)/
const POLITE_DELAY_MS_MIN = 2500
const POLITE_DELAY_MS_MAX = 5000
const NAV_TIMEOUT_MS = 30000

export interface CollectSourceInput {
  category: Category
  url: string
  label?: string
}

export interface PlaywrightCollectorOptions {
  totalTarget: number
  perCategoryCap: number
  perPageCap: number
  headless: boolean
  alreadySeenAsins: ReadonlySet<string>
}

export class CaptchaDetectedError extends Error {
  constructor(public readonly url: string) {
    super(
      `Amazon access challenge / CAPTCHA detected on ${url}. Aborting — manual review required.`,
    )
    this.name = 'CaptchaDetectedError'
  }
}

interface RawCard {
  asin: string
  title: string
  imageUrl: string
  productUrl: string
  price?: string
  rating?: number
  reviewCount?: number
  bestsellerRank?: number
}

export async function collectFromBestSellers(
  sources: ReadonlyArray<CollectSourceInput>,
  cfg: AppConfig,
  opts: PlaywrightCollectorOptions,
): Promise<ProductCandidate[]> {
  const { chromium } = await import('playwright')
  const browser: Browser = await chromium.launch({ headless: opts.headless })
  const context = await browser.newContext({
    locale: 'fr-FR',
    viewport: { width: 1366, height: 900 },
  })
  // tsx (esbuild) wraps named functions with __name() to preserve Function.name.
  // When Playwright stringifies the evaluate callback and runs it in the page,
  // __name is undefined → ReferenceError. Inject a no-op polyfill into every page.
  await context.addInitScript(() => {
    const g = globalThis as unknown as { __name?: <T>(fn: T) => T }
    if (typeof g.__name !== 'function') g.__name = (fn) => fn
  })
  const page = await context.newPage()
  page.setDefaultTimeout(NAV_TIMEOUT_MS)

  const out: ProductCandidate[] = []
  const seen = new Set<string>(opts.alreadySeenAsins)
  try {
    for (let i = 0; i < sources.length; i += 1) {
      if (out.length >= opts.totalTarget) {
        logger.info('Target reached, stopping early', { added: out.length })
        break
      }
      const src = sources[i]!
      logger.info('Visiting best sellers page', {
        category: src.category,
        label: src.label ?? '',
        url: src.url,
        addedSoFar: out.length,
        target: opts.totalTarget,
      })
      if (i > 0) await politeDelay()
      const rows = await scrapeOneSource(page, src.url, opts.perPageCap)
      let addedFromThisPage = 0
      let duplicatesFromThisPage = 0
      for (const r of rows) {
        if (seen.has(r.asin)) {
          duplicatesFromThisPage += 1
          continue
        }
        seen.add(r.asin)
        out.push(toCandidate(r, src.category, cfg))
        addedFromThisPage += 1
        if (addedFromThisPage >= opts.perCategoryCap) break
        if (out.length >= opts.totalTarget) break
      }
      logger.info('Page result', {
        category: src.category,
        extracted: rows.length,
        added: addedFromThisPage,
        duplicates: duplicatesFromThisPage,
        categoryCap: opts.perCategoryCap,
      })
    }
  } finally {
    await context.close()
    await browser.close()
  }
  return out
}

async function scrapeOneSource(
  page: Page,
  url: string,
  limit: number,
): Promise<RawCard[]> {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' })
  } catch (err) {
    logger.warn('Navigation failed, skipping source', {
      url,
      error: err instanceof Error ? err.message : String(err),
    })
    return []
  }

  if (await isCaptchaPage(page)) {
    throw new CaptchaDetectedError(url)
  }

  await dismissCookieBanner(page)

  // Best Sellers grid renders card containers with one of these roles.
  // Use a forgiving selector list; first match wins.
  const cardSelector = [
    '#gridItemRoot',
    '.zg-grid-general-faceout',
    '.p13n-sc-uncoverable-faceout',
  ].join(', ')

  try {
    await page.waitForSelector(cardSelector, { timeout: 10000 })
  } catch {
    logger.warn(
      'No best-sellers product cards found on page (selectors may have changed)',
      { url },
    )
    return []
  }

  const rows = await page.$$eval(
    cardSelector,
    (cards, limitArg: number) => {
      const items: RawCard[] = []
      const seenAsins = new Set<string>()

      function getAsinFromHref(href: string): string | null {
        const m = href.match(/\/dp\/([A-Z0-9]{10})(?:[/?]|$)/)
        return m ? (m[1] ?? null) : null
      }

      function parseRating(text: string): number | undefined {
        // matches "4,7 sur 5" or "4.7 out of 5"
        const m = text.match(/([0-9]+[.,][0-9])\s*(?:sur|out of)\s*5/i)
        if (!m || m[1] === undefined) return undefined
        return Number.parseFloat(m[1].replace(',', '.'))
      }

      function parseInteger(text: string): number | undefined {
        const m = text.replace(/[\s ]/g, '').match(/(\d{1,9})/)
        if (!m || m[1] === undefined) return undefined
        return Number.parseInt(m[1], 10)
      }

      function pickLargestSrcset(srcset: string): string | undefined {
        // "url1 1x, url2 2x" or "url1 200w, url2 400w" → highest descriptor wins.
        const parts = srcset
          .split(',')
          .map((p) => p.trim())
          .filter(Boolean)
        let best: { url: string; weight: number } | undefined
        for (const p of parts) {
          const [url, desc] = p.split(/\s+/, 2)
          if (!url) continue
          const n = desc ? Number.parseFloat(desc) : 1
          const weight = Number.isFinite(n) ? n : 1
          if (!best || weight > best.weight) best = { url, weight }
        }
        return best?.url
      }

      // Types intentionally `any` — this callback is stringified and run in
      // the browser page context, where DOM types exist but Node's tsconfig
      // doesn't see them.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      function pickImage(imgEl: any): string {
        if (!imgEl) return ''
        const srcset = imgEl.getAttribute('srcset')
        const fromSrcset = srcset ? pickLargestSrcset(srcset) : undefined
        const dataSrc = imgEl.getAttribute('data-src')
        const src = imgEl.getAttribute('src')
        return fromSrcset || dataSrc || src || ''
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      function extractReviewCount(card: any): number | undefined {
        // Walk a list of selectors from most-specific to least-specific.
        // The fragile bit is that the rating block ("4,5 sur 5") sits next
        // to the review-count number, and a loose selector will parse "4"
        // out of the rating instead of the actual count. We mitigate by
        // requiring the parsed value to be plausible (>= 10): bestseller
        // entries always have at least dozens of reviews, and rating
        // integers (1..5) get rejected.
        const candidateTexts: Array<string | null | undefined> = [
          card.querySelector('a[href*="#customerReviews"] .a-size-small')
            ?.textContent,
          card.querySelector('a[href*="#customerReviews"] .s-link-style')
            ?.textContent,
          card
            .querySelector('a[href*="#customerReviews"]')
            ?.getAttribute('aria-label'),
          card.querySelector('a[href*="#customerReviews"]')?.textContent,
          card.querySelector('.a-icon-row .a-size-small')?.textContent,
          card.querySelector('.a-size-small')?.textContent,
        ]
        for (const text of candidateTexts) {
          if (!text) continue
          const n = parseInteger(text)
          if (n !== undefined && n >= 10) return n
        }
        return undefined
      }

      for (const card of Array.from(cards)) {
        if (items.length >= limitArg) break

        const linkEl = card.querySelector('a.a-link-normal[href*="/dp/"]')
        if (!linkEl) continue
        const href = linkEl.getAttribute('href') ?? ''
        const asin = getAsinFromHref(href)
        if (!asin) continue
        if (seenAsins.has(asin)) continue
        seenAsins.add(asin)

        const titleEl =
          card.querySelector('div._cDEzb_p13n-sc-css-line-clamp-3_g3dy1') ||
          card.querySelector('div[class*="line-clamp"]') ||
          linkEl.querySelector('span') ||
          linkEl
        const title = (titleEl?.textContent ?? '').trim()
        if (!title) continue

        const imgEl = card.querySelector('img')
        const imageUrl = pickImage(imgEl)
        if (!imageUrl) continue

        const productUrl = href.startsWith('http')
          ? href
          : `https://www.amazon.fr${href}`

        const rankText = card.querySelector('.zg-bdg-text')?.textContent ?? ''
        const bestsellerRank = parseInteger(rankText)

        const priceText =
          card.querySelector('._cDEzb_p13n-sc-price_3mJ9Z')?.textContent ??
          card.querySelector('.p13n-sc-price')?.textContent ??
          card.querySelector('.a-color-price')?.textContent ??
          ''
        const price = priceText.trim() || undefined

        const ratingAlt = card.querySelector('.a-icon-alt')?.textContent ?? ''
        const rating = parseRating(ratingAlt)

        const reviewCount = extractReviewCount(card)

        const raw: RawCard = { asin, title, imageUrl, productUrl }
        if (price !== undefined) raw.price = price
        if (rating !== undefined) raw.rating = rating
        if (reviewCount !== undefined) raw.reviewCount = reviewCount
        if (bestsellerRank !== undefined) raw.bestsellerRank = bestsellerRank
        items.push(raw)
      }
      return items
    },
    limit,
  )

  logger.info('Extracted product cards', { url, count: rows.length })
  return rows
}

async function isCaptchaPage(page: Page): Promise<boolean> {
  const html = await page.content()
  const lower = html.toLowerCase()
  return (
    lower.includes('/errors/validatecaptcha') ||
    lower.includes('captchacharacters') ||
    lower.includes('enter the characters you see below') ||
    lower.includes('saisir les caractères que vous voyez')
  )
}

/**
 * Amazon.fr / amazon.* show a GDPR cookie banner that blocks the page until
 * the user picks an option. Click "Refuser" if present, else "Accepter".
 * Once dismissed the choice persists in the browser context, so subsequent
 * pages should not re-display the banner.
 * Best-effort: silently continue if the banner is not present.
 */
async function dismissCookieBanner(page: Page): Promise<void> {
  const combined = [
    '#sp-cc-rejectall-link',
    'input[data-cel-widget="sp-cc-rejectall"]',
    '#sp-cc-accept',
    'input[name="accept"]',
    'button[name="accept"]',
  ].join(', ')
  const locator = page.locator(combined).first()
  try {
    await locator.waitFor({ state: 'visible', timeout: 3000 })
  } catch {
    return // no banner — already accepted in a prior page or not shown
  }
  await locator.click({ timeout: 2000 }).catch(() => undefined)
  logger.debug('Dismissed cookie banner')
  await page.waitForLoadState('domcontentloaded').catch(() => undefined)
  await page.waitForTimeout(500)
}

function toCandidate(
  r: RawCard,
  category: Category,
  cfg: AppConfig,
): ProductCandidate {
  // Defensive: re-validate ASIN before letting it leave the collector.
  if (!ASIN_RE.test(`/dp/${r.asin}/`)) {
    throw new Error(`Invalid ASIN extracted: ${r.asin}`)
  }
  const candidate: ProductCandidate = {
    asin: r.asin,
    title: r.title,
    imageUrl: r.imageUrl,
    productUrl: r.productUrl,
    affiliateUrl: buildAffiliateUrl(
      r.asin,
      cfg.AMAZON_ASSOCIATE_TAG,
      cfg.AMAZON_MARKETPLACE,
    ),
    category,
    fetchedAt: new Date().toISOString(),
  }
  if (r.price !== undefined) candidate.price = r.price
  if (r.rating !== undefined) candidate.rating = r.rating
  if (r.reviewCount !== undefined) candidate.reviewCount = r.reviewCount
  if (r.bestsellerRank !== undefined)
    candidate.bestsellerRank = r.bestsellerRank
  return candidate
}

function politeDelay(): Promise<void> {
  const ms =
    POLITE_DELAY_MS_MIN +
    Math.floor(Math.random() * (POLITE_DELAY_MS_MAX - POLITE_DELAY_MS_MIN))
  return new Promise((res) => setTimeout(res, ms))
}
