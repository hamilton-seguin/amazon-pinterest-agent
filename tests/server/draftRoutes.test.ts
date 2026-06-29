import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http'
import type { AddressInfo } from 'node:net'
import { handleDraftRoute } from '../../src/server/draftRoutes.js'
import { stores } from '../../src/storage/jsonStore.js'
import { createTmpDataDir, type TmpDataDir } from '../fixtures/tmpDataDir.js'
import { makeDraft } from '../fixtures/products.js'

interface Started {
  server: Server
  base: string
}

async function start(): Promise<Started> {
  const server = createServer(
    (req: IncomingMessage, res: ServerResponse): void => {
      handleDraftRoute(req, res).catch((err) => {
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: String(err) }))
        }
      })
    },
  )
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const addr = server.address() as AddressInfo
  return { server, base: `http://127.0.0.1:${addr.port}` }
}

async function stop(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  )
}

describe('draftRoutes (local API bridge)', () => {
  let tmp: TmpDataDir
  let s: Started

  beforeEach(async () => {
    tmp = await createTmpDataDir()
    s = await start()
  })

  afterEach(async () => {
    await stop(s.server)
    await tmp.cleanup()
  })

  it('GET /api/drafts returns all drafts', async () => {
    await stores.drafts.writeAll([
      makeDraft({ asin: 'B000HTT001', status: 'drafted' }),
      makeDraft({ asin: 'B000HTT002', status: 'approved' }),
    ])
    const res = await fetch(`${s.base}/api/drafts`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as Array<{ asin: string }>
    expect(body.map((d) => d.asin).sort()).toEqual([
      'B000HTT001',
      'B000HTT002',
    ])
  })

  it('GET /api/drafts?status=approved filters by status', async () => {
    await stores.drafts.writeAll([
      makeDraft({ asin: 'B000HTT010', status: 'drafted' }),
      makeDraft({ asin: 'B000HTT011', status: 'approved' }),
    ])
    const res = await fetch(`${s.base}/api/drafts?status=approved`)
    const body = (await res.json()) as Array<{ asin: string; status: string }>
    expect(body).toHaveLength(1)
    expect(body[0]?.asin).toBe('B000HTT011')
  })

  it('GET /api/drafts?status=bogus returns 400 with clear error', async () => {
    const res = await fetch(`${s.base}/api/drafts?status=bogus`)
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toMatch(/Invalid status/)
  })

  it('POST /api/drafts/:asin/approve approves the draft', async () => {
    await stores.drafts.writeAll([
      makeDraft({ asin: 'B000HTT020', status: 'drafted' }),
    ])
    const res = await fetch(`${s.base}/api/drafts/B000HTT020/approve`, {
      method: 'POST',
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { status: string }
    expect(body.status).toBe('approved')
  })

  it('POST /api/drafts/:asin/skip skips the draft', async () => {
    await stores.drafts.writeAll([
      makeDraft({ asin: 'B000HTT030', status: 'drafted' }),
    ])
    const res = await fetch(`${s.base}/api/drafts/B000HTT030/skip`, {
      method: 'POST',
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { status: string }
    expect(body.status).toBe('skipped')
  })

  it('PATCH /api/drafts/:asin updates title and description', async () => {
    await stores.drafts.writeAll([
      makeDraft({
        asin: 'B000HTT040',
        status: 'drafted',
        pinTitle: 'Old',
        pinDescription: 'Old desc',
      }),
    ])
    const res = await fetch(`${s.base}/api/drafts/B000HTT040`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pinTitle: 'New title',
        pinDescription: 'New description',
      }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      pinTitle: string
      pinDescription: string
    }
    expect(body.pinTitle).toBe('New title')
    expect(body.pinDescription).toBe('New description')
  })

  it('returns error status for unknown ASIN on approve', async () => {
    const res = await fetch(`${s.base}/api/drafts/B000MISS01/approve`, {
      method: 'POST',
    })
    expect([400, 404]).toContain(res.status)
    const body = (await res.json()) as { error: string }
    expect(body.error).toMatch(/Draft not found/)
  })

  it('returns 404 for unknown route', async () => {
    const res = await fetch(`${s.base}/api/nope`)
    expect(res.status).toBe(404)
  })
})
