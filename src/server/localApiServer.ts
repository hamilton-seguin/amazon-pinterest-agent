import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { handleDraftRoute } from './draftRoutes.js';
import { logger } from '../utils/logger.js';

const DEFAULT_PORT = 5174;

function setCors(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  const handled = await handleDraftRoute(req, res);
  if (!handled) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
}

export function startLocalApiServer(port = Number(process.env.LOCAL_API_PORT) || DEFAULT_PORT): void {
  const server = createServer((req, res) => {
    handle(req, res).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('Unhandled API error', { message: msg });
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal error' }));
      }
    });
  });
  server.listen(port, () => {
    logger.info('Local API bridge listening', { port });
  });
}

const invokedDirectly = process.argv[1]?.endsWith('localApiServer.ts')
  || process.argv[1]?.endsWith('localApiServer.js');
if (invokedDirectly) {
  startLocalApiServer();
}
