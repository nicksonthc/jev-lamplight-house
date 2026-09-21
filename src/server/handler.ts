import type { IncomingMessage, ServerResponse } from 'node:http';
import { judgeLocally } from '../localJudge.js';
import { stateKey, switchesFromKey, type JevReply } from '../questions.js';
import { judgeHouse, type GatewayCredentials } from './judge.js';

/**
 * `GET /api/jev?s=<12 bits>` — the endpoint, and the only thing standing
 * between a public URL and somebody else's gateway quota.
 *
 * Three properties do that work, in order of how much they matter:
 *
 * 1. **The input space is 4096 states.** The request carries twelve bits and
 *    nothing else — anything that is not exactly twelve `0`/`1` characters is
 *    rejected before a credential is touched. This endpoint therefore cannot
 *    be used to put an arbitrary prompt through the model, which is the thing
 *    that makes an open AI endpoint genuinely dangerous. The worst an abuser
 *    can do is ask about a cottage.
 * 2. **So every answer is cacheable, and the cache is the whole universe.**
 *    A model answer is returned with a long `s-maxage`, so Vercel's edge
 *    serves repeats without invoking the function at all, and a warm instance
 *    keeps its own map for the misses. Traffic stops being proportional to
 *    cost: 4096 model calls covers every question anyone can ask, forever.
 * 3. **A rate limit on what is left.** Only genuine cache misses can reach
 *    the model, and only so many a minute. Past that the local rules answer
 *    and say so — the page already renders that honestly, so a throttled
 *    visitor gets a working scene rather than an error.
 *
 * One handler, two callers: `api/jev.ts` on Vercel and the `jev-api` plugin
 * in `vite.config.ts`. They were written separately once and the Vercel one
 * failed in production on `request.json`, because the Node runtime hands the
 * classic `(req, res)` pair whatever the signature suggests.
 */

/** A day at the edge, a week of serving stale while it refreshes. */
const CACHE_SECONDS = 86_400;
const STALE_SECONDS = 604_800;

/**
 * Model calls a minute, per instance, across everyone. Generous for the
 * handful of cache misses real use produces, and a low ceiling for a flood.
 */
const CALLS_PER_MINUTE = 20;

/** Verdicts this instance has already paid for. At most 4096 of them. */
const cache = new Map<string, JevReply>();

const calls: number[] = [];

function withinRateLimit(): boolean {
  const now = Date.now();
  while (calls.length && now - calls[0] > 60_000) calls.shift();
  if (calls.length >= CALLS_PER_MINUTE) return false;
  calls.push(now);
  return true;
}

export async function handleJevRequest(
  req: IncomingMessage,
  res: ServerResponse,
  credentials: GatewayCredentials,
): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { allow: 'GET' }).end('Method Not Allowed');
    return;
  }

  const key = new URL(req.url ?? '', 'http://localhost').searchParams.get('s') ?? '';
  const switches = switchesFromKey(key);
  if (!switches) {
    // Rejected before anything is spent: no credential, no model, no parsing.
    res.writeHead(400, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'expected ?s= as twelve 0/1 characters' }));
    return;
  }

  const send = (reply: JevReply, cacheable: boolean) => {
    res.writeHead(200, {
      'content-type': 'application/json',
      // Only a real model answer is worth caching. A fallback is a transient
      // state — the credential comes back, the rate limit clears — and
      // caching one would pin the page to the rules for a day.
      // `max-age=0` with a long `s-maxage`: the shared cache at the edge is
      // the one doing the protecting, and the browser revalidates so a
      // visitor is never pinned to yesterday's verdict by their own cache.
      // Without the explicit zero, browsers cache heuristically and replay
      // whatever they saw first.
      'cache-control': cacheable
        ? `public, max-age=0, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=${STALE_SECONDS}`
        : 'no-store',
    });
    res.end(JSON.stringify(reply));
  };

  const cached = cache.get(key);
  if (cached) {
    send({ ...cached, cached: true }, true);
    return;
  }

  if (!withinRateLimit()) {
    send(
      {
        source: 'local',
        verdict: judgeLocally(switches),
        note: 'Too many uncached asks a minute — answered by the local rules. Try again shortly.',
      },
      false,
    );
    return;
  }

  const reply = await judgeHouse(switches, credentials);
  if (reply.source === 'jev') cache.set(stateKey(switches), reply);
  send(reply, reply.source === 'jev');
}
