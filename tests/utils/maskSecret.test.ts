import { describe, expect, it } from 'vitest'
import { maskRecord, maskSecret } from '../../src/utils/maskSecret.js'

describe('maskSecret', () => {
  it('returns "(empty)" for empty values', () => {
    expect(maskSecret(undefined)).toBe('(empty)')
    expect(maskSecret(null)).toBe('(empty)')
    expect(maskSecret('')).toBe('(empty)')
  })

  it('returns **** for short values', () => {
    expect(maskSecret('abcd')).toBe('****')
    expect(maskSecret('ab')).toBe('****')
  })

  it('reveals only the last 4 chars for long values', () => {
    expect(maskSecret('sk-live-1234567890abcdef')).toBe('****cdef')
    expect(maskSecret('1234567890')).toBe('****7890')
  })

  it('does not leak the original value', () => {
    const value = 'super-secret-token-9999'
    expect(maskSecret(value)).not.toContain('super-secret-token')
  })
})

describe('maskRecord', () => {
  it('masks values whose key matches secret patterns', () => {
    const out = maskRecord({
      apiKey: 'sk-live-abcdef1234',
      bearerToken: 'tok_1234567890',
      password: 'hunter2!!',
      authorization: 'Bearer ABCDEFGHIJ',
      safeField: 'visible',
    })
    expect(out['apiKey']).toBe('****1234')
    expect(out['bearerToken']).toBe('****7890')
    expect(out['password']).toBe('****r2!!')
    expect(out['authorization']).toBe('****GHIJ')
    expect(out['safeField']).toBe('visible')
  })

  it('recurses into nested objects', () => {
    const out = maskRecord({
      nested: { apiKey: 'sk-1234567890', other: 'kept' },
    })
    const nested = out['nested'] as Record<string, unknown>
    expect(nested['apiKey']).toBe('****7890')
    expect(nested['other']).toBe('kept')
  })
})
