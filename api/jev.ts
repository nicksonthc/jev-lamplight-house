import { judgeHouse } from '../src/server/judge';

/**
 * `POST /api/jev` — the one server endpoint this otherwise client-only project
 * has. It exists to keep the gateway credential out of the browser: the page
 * posts the state of its switches, this asks `typesafe-ai/jev` about them, and
 * nothing that could authenticate leaves the process.
 *
 * On Vercel the OIDC token is normally all that is needed — it is injected
 * into the function's environment when OIDC is enabled for the project, needs
 * no card, and is what a Hobby account gets. `AI_GATEWAY_API_KEY` is the
 * override, for billing against a specific gateway key instead.
 *
 * `vite.config.ts` mounts the same `judgeHouse` on the dev and preview servers
 * so `/jev` behaves identically in all three places.
 */
export const config = { runtime: 'nodejs' };

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: { allow: 'POST' } });
  }
  const body: unknown = await request.json().catch(() => ({}));
  const reply = await judgeHouse(body, {
    oidcToken: process.env.VERCEL_OIDC_TOKEN,
    apiKey: process.env.AI_GATEWAY_API_KEY,
  });
  return Response.json(reply, { headers: { 'cache-control': 'no-store' } });
}
