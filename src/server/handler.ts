import type { IncomingMessage, ServerResponse } from 'node:http';
import { judgeHouse, type GatewayCredentials } from './judge.js';

/**
 * `POST /api/jev`, as a plain Node request handler.
 *
 * One shape, two callers: `api/jev.ts` on Vercel and the `jev-api` plugin in
 * `vite.config.ts` for the dev and preview servers. They used to be written
 * separately — a Web `Request`/`Response` handler for Vercel and a connect
 * middleware for Vite — and the Vercel one failed in production with
 * `TypeError: request.json`, because the Node runtime hands the classic
 * `(req, res)` pair whatever the handler's signature suggests. Sharing this
 * is what makes local and deployed the same code path rather than two
 * implementations that agree until they don't.
 */
export async function handleJevRequest(
  req: IncomingMessage,
  res: ServerResponse,
  credentials: GatewayCredentials,
): Promise<void> {
  if (req.method !== 'POST') {
    res.writeHead(405, { allow: 'POST' }).end('Method Not Allowed');
    return;
  }

  const reply = await judgeHouse(await readBody(req), credentials);
  res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(reply));
}

/**
 * The posted JSON. Vercel's Node runtime parses the body for a JSON content
 * type and leaves the stream consumed, so reading the stream unconditionally
 * would come back empty there — and an empty body judges a house with every
 * switch off, which is a *plausible* wrong answer rather than an error. Take
 * the parsed body when there is one.
 */
async function readBody(req: IncomingMessage): Promise<unknown> {
  const parsed = (req as IncomingMessage & { body?: unknown }).body;
  if (parsed !== undefined && parsed !== null && parsed !== '') {
    return typeof parsed === 'string' ? parse(parsed) : parsed;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return parse(Buffer.concat(chunks).toString('utf8'));
}

function parse(text: string): unknown {
  try {
    return JSON.parse(text || '{}');
  } catch {
    // An unparseable body judges an all-off house, which is a fine answer.
    return {};
  }
}
