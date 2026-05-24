import { describe, expect, it } from 'vitest'
import { buildAffiliateUrl } from '../../src/services/affiliateLinkBuilder.js'

describe('buildAffiliateUrl', () => {
  it('builds URL from ASIN + associate tag with default marketplace', () => {
    const url = buildAffiliateUrl('B0MOCK0001', 'mytag-21')
    expect(url).toBe('https://www.amazon.fr/dp/B0MOCK0001?tag=mytag-21')
  })

  it('honors a custom marketplace', () => {
    const url = buildAffiliateUrl('B0MOCK0001', 'mytag-20', 'www.amazon.com')
    expect(url).toBe('https://www.amazon.com/dp/B0MOCK0001?tag=mytag-20')
  })

  it('strips http(s) prefix and trailing slash from marketplace', () => {
    const url = buildAffiliateUrl(
      'B0MOCK0001',
      'mytag-21',
      'https://www.amazon.de/',
    )
    expect(url).toBe('https://www.amazon.de/dp/B0MOCK0001?tag=mytag-21')
  })

  it('rejects an invalid ASIN', () => {
    expect(() => buildAffiliateUrl('bad', 'mytag-21')).toThrow(/Invalid ASIN/)
    expect(() => buildAffiliateUrl('TOO-LONG-12', 'mytag-21')).toThrow(
      /Invalid ASIN/,
    )
  })

  it('rejects an empty associate tag', () => {
    expect(() => buildAffiliateUrl('B0MOCK0001', '   ')).toThrow(
      /Associate tag is required/,
    )
  })
})
