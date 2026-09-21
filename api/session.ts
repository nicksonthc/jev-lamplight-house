import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleSessionRequest } from '../src/server/handler.js';

/**
 * `/api/session` — the password gate's own endpoint. `GET` reports whether a
 * password is needed and whether this visitor has one, `POST` exchanges the
 * password for an HttpOnly cookie, `DELETE` signs out.
 *
 * The password lives in `JEV_PASSWORD`, a Vercel project environment
 * variable read at runtime. It is never in the repository, which is what
 * lets the repository be public.
 */
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await handleSessionRequest(req, res);
}
