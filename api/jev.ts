import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleJevRequest } from '../src/server/handler.js';

/**
 * `POST /api/jev` — the one server endpoint this otherwise client-only page
 * has. It exists to keep the gateway credential out of the browser: the page
 * posts the state of its switches, this asks `typesafe-ai/jev` about them,
 * and nothing that could authenticate leaves the process.
 *
 * On Vercel the OIDC token is normally all that is needed — it is injected
 * into the function's environment, needs no card, and is what a free account
 * gets. `AI_GATEWAY_API_KEY` is the override, for billing against a specific
 * gateway key instead.
 *
 * `vite.config.ts` mounts the same handler on the dev and preview servers, so
 * the page behaves identically in all three places.
 */
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await handleJevRequest(req, res, {
    oidcToken: process.env.VERCEL_OIDC_TOKEN,
    apiKey: process.env.AI_GATEWAY_API_KEY,
  });
}
