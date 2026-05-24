import type { PinDraft, PinStatus } from '../../types.js'

async function http<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    let msg = `${method} ${path} → ${res.status}`
    try {
      const data = await res.json()
      if (data && typeof data === 'object' && 'error' in data)
        msg = String(data.error)
    } catch {
      // ignore
    }
    throw new Error(msg)
  }
  return (await res.json()) as T
}

export const draftsApi = {
  list(status?: PinStatus): Promise<PinDraft[]> {
    const qs = status ? `?status=${encodeURIComponent(status)}` : ''
    return http<PinDraft[]>('GET', `/api/drafts${qs}`)
  },
  update(
    asin: string,
    updates: { pinTitle?: string; pinDescription?: string },
  ): Promise<PinDraft> {
    return http<PinDraft>('PATCH', `/api/drafts/${asin}`, updates)
  },
  approve(
    asin: string,
    updates?: { pinTitle?: string; pinDescription?: string },
  ): Promise<PinDraft> {
    return http<PinDraft>('POST', `/api/drafts/${asin}/approve`, updates)
  },
  skip(asin: string): Promise<PinDraft> {
    return http<PinDraft>('POST', `/api/drafts/${asin}/skip`)
  },
}
