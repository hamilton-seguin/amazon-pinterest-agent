import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http'
import { pathToFileURL } from 'node:url'
import { handleDraftRoute } from './draftRoutes.js'
import { logger } from '../utils/logger.js'

const DEFAULT_PORT = 5174
const DEFAULT_HOST = '127.0.0.1'

/**
 * Origins allowed to call the bridge from the browser. The bridge mutates
 * local files with no auth, so a permissive CORS policy turns any visited
 * webpage into a CSRF vector. Default to the Vite dev origin only; extend
 * via LOCAL_API_ALLOWED_ORIGINS (comma-separated) if a different host is
 * needed (e.g. `https://localhost:5173`).
 */
function allowedOrigins(): ReadonlySet<string> {
  const fromEnv = process.env.LOCAL_API_ALLOWED_ORIGINS ?? ''
  const list = fromEnv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (list.length === 0) {
    return new Set(['http://localhost:5173', 'http://127.0.0.1:5173'])
  }
  return new Set(list)
}

function applyCors(req: IncomingMessage, res: ServerResponse): boolean {
  const origin = req.headers.origin
  // Same-origin (no Origin header) or no-origin tools (curl) are allowed —
  // the server is bound to loopback so only the local user can reach it.
  if (!origin) return true
  if (allowedOrigins().has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    return true
  }
  return false
}

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const allowed = applyCors(req, res)
  if (!allowed) {
    res.writeHead(403, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Origin not allowed' }))
    return
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }
  const handled = await handleDraftRoute(req, res)
  if (!handled) {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Not found' }))
  }
}

export function startLocalApiServer(
  port = Number(process.env.LOCAL_API_PORT) || DEFAULT_PORT,
  host = process.env.LOCAL_API_HOST ?? DEFAULT_HOST,
): void {
  const server = createServer((req, res) => {
    handle(req, res).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err)
      logger.error('Unhandled API error', { message: msg })
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Internal error' }))
      }
    })
  })
  server.listen(port, host, () => {
    logger.info('Local API bridge listening', { host, port })
  })
}

const entry = process.argv[1]
const invokedDirectly = entry
  ? import.meta.url === pathToFileURL(entry).href
  : false
if (invokedDirectly) {
  startLocalApiServer()
}
