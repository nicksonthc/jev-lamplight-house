import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

/**
 * One invariant, and it needs its own check because a browser cannot see it:
 * **a session cookie issued by one process must verify in another.**
 *
 * A serverless deployment answers consecutive requests from different
 * instances. Anything in the signing key that is generated at module load —
 * a random salt, a start timestamp, a per-instance id — makes every cookie
 * valid exactly once, on the instance that minted it. The symptom is a page
 * that unlocks and then re-locks on the next request, and it cannot be
 * reproduced against a dev server, because a dev server is one process.
 *
 * So this runs `session.ts` in two separate processes and makes them agree.
 */

const run = (script) =>
  execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', script], {
    env: { ...process.env, JEV_PASSWORD: 'a-password-for-the-check', VERCEL: '' },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const load = "const s = await import('./src/server/session.ts');";

const cookie = run(`${load} process.stdout.write(s.sessionCookie());`);
const value = cookie.split(';')[0];
assert.match(value, /^jev_session=\d+\.[0-9a-f]{64}$/, 'the cookie is an expiry and a signature');

const accepted = run(`${load} process.stdout.write(String(s.hasSession(${JSON.stringify(value)})));`);
assert.equal(accepted, 'true', 'a cookie minted in one process verifies in another');

const otherPassword = execFileSync(
  process.execPath,
  ['--experimental-strip-types', '--input-type=module', '-e', `${load} process.stdout.write(String(s.hasSession(${JSON.stringify(value)})));`],
  { env: { ...process.env, JEV_PASSWORD: 'a-different-password', VERCEL: '' }, encoding: 'utf8' },
).trim();
assert.equal(otherPassword, 'false', 'and changing the password invalidates it');

const expired = `jev_session=1.${'0'.repeat(64)}`;
const stale = run(`${load} process.stdout.write(String(s.hasSession(${JSON.stringify(expired)})));`);
assert.equal(stale, 'false', 'an expired cookie is refused');

const forged = run(`${load} process.stdout.write(String(s.hasSession('jev_session=99999999999999.${'a'.repeat(64)}')));`);
assert.equal(forged, 'false', 'a forged signature is refused');

const openWithout = execFileSync(
  process.execPath,
  ['--experimental-strip-types', '--input-type=module', '-e', `${load} process.stdout.write(s.gateState());`],
  { env: { ...process.env, JEV_PASSWORD: '', VERCEL: '' }, encoding: 'utf8' },
).trim();
assert.equal(openWithout, 'off', 'no password and not on Vercel: the gate is off');

const closedOnVercel = execFileSync(
  process.execPath,
  ['--experimental-strip-types', '--input-type=module', '-e', `${load} process.stdout.write(s.gateState());`],
  { env: { ...process.env, JEV_PASSWORD: '', VERCEL: '1' }, encoding: 'utf8' },
).trim();
assert.equal(closedOnVercel, 'misconfigured', 'no password ON Vercel: the gate refuses everyone');

console.log('session: a cookie from one process verifies in another');
console.log('session: changing the password, expiry and forgery all refuse');
console.log('session: off without a password locally, closed without one on Vercel');
