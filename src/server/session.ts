import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * The password gate.
 *
 * What it is actually protecting is `/api/jev` — the page itself is static
 * files on a CDN and costs nothing to serve, while every uncached ask spends
 * somebody's model quota. So the gate is enforced on the endpoint, in the
 * same handler the dev server and the deployment share, and the lock screen
 * in the interface is a consequence of that rather than the mechanism. A
 * check that lived only in the browser would be decoration.
 *
 * The password is never in the repository. It is read from `JEV_PASSWORD` at
 * runtime — on Vercel a project environment variable, locally a line in
 * `.env` — which is what lets this repo be public.
 */

const COOKIE = 'jev_session';

/** A week: long enough not to be a nuisance, short enough to expire. */
const SESSION_SECONDS = 604_800;

/** Wrong guesses allowed a minute, per instance, across everyone. */
const ATTEMPTS_PER_MINUTE = 10;

const password = () => process.env.JEV_PASSWORD?.trim() || '';

/**
 * Whether the gate is on. Set a password and it is; leave it unset and the
 * page is open, which is what you want running `npm run dev`.
 *
 * With one exception, and it is the important one: **on Vercel with no
 * password set, the gate refuses everything.** A deployment is a public URL,
 * and the failure mode of "I meant to set that variable" must not be an open
 * endpoint in front of a paid model.
 */
export type GateState = 'off' | 'on' | 'misconfigured';

export function gateState(): GateState {
  if (password()) return 'on';
  return process.env.VERCEL ? 'misconfigured' : 'off';
}

/**
 * A secret for signing sessions. Derived from the password so there is only
 * one thing to configure — and so changing the password invalidates every
 * session that was issued under the old one, which is what you want from a
 * password change. Salted with a per-instance value so a signature cannot be
 * replayed against a different deployment.
 */
const salt = randomBytes(16).toString('hex');
const sign = (value: string) =>
  createHmac('sha256', `${password()}:${salt}`).update(value).digest('hex');

/** Constant-time, and length-safe: `timingSafeEqual` throws on a mismatch. */
function sameSecret(a: string, b: string): boolean {
  const digest = (v: string) => createHmac('sha256', 'compare').update(v).digest();
  return timingSafeEqual(digest(a), digest(b));
}

const attempts: number[] = [];

/** True if the guess was right. Throttled, so the password cannot be walked. */
export function checkPassword(supplied: unknown): 'ok' | 'wrong' | 'throttled' {
  const now = Date.now();
  while (attempts.length && now - attempts[0] > 60_000) attempts.shift();
  if (attempts.length >= ATTEMPTS_PER_MINUTE) return 'throttled';
  if (typeof supplied !== 'string' || !sameSecret(supplied, password())) {
    attempts.push(now);
    return 'wrong';
  }
  return 'ok';
}

export function sessionCookie(): string {
  const expires = Date.now() + SESSION_SECONDS * 1000;
  const value = `${expires}.${sign(String(expires))}`;
  // HttpOnly so no script can read it, SameSite=Lax so it is not sent from
  // another site, Secure everywhere but a plain-HTTP dev server.
  const secure = process.env.VERCEL ? ' Secure;' : '';
  return `${COOKIE}=${value}; Path=/; HttpOnly;${secure} SameSite=Lax; Max-Age=${SESSION_SECONDS}`;
}

export const clearedCookie = () => `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

export function hasSession(cookieHeader: string | undefined): boolean {
  if (gateState() === 'off') return true;
  if (gateState() === 'misconfigured') return false;
  const raw = (cookieHeader ?? '')
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
  if (!raw) return false;
  const [expires, signature] = raw.split('.');
  if (!expires || !signature || Number(expires) < Date.now()) return false;
  return sameSecret(signature, sign(expires));
}
