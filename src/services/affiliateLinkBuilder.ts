const ASIN_RE = /^[A-Z0-9]{10}$/
const DEFAULT_MARKETPLACE = 'www.amazon.fr'

export function buildAffiliateUrl(
  asin: string,
  associateTag: string,
  marketplace: string = DEFAULT_MARKETPLACE,
): string {
  if (!ASIN_RE.test(asin)) {
    throw new Error(`Invalid ASIN: ${asin}`)
  }
  if (!associateTag.trim()) {
    throw new Error('Associate tag is required to build affiliate URL')
  }
  const host = (marketplace || DEFAULT_MARKETPLACE)
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
  const u = new URL(`https://${host}/dp/${asin}`)
  u.searchParams.set('tag', associateTag)
  return u.toString()
}
