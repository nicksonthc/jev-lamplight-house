import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';

/**
 * The password, if this deployment has one. Read the same files the dev
 * server reads, so `npm run check` needs no more setup than `npm run dev`;
 * an explicit `JEV_PASSWORD=… npm run check` wins, which is how you check a
 * deployment whose password is not on this machine.
 */
async function password() {
  if (process.env.JEV_PASSWORD) return process.env.JEV_PASSWORD;
  for (const file of ['.env', '.env.local']) {
    const text = await readFile(file, 'utf8').catch(() => '');
    const line = text.split('\n').find((l) => l.startsWith('JEV_PASSWORD='));
    if (line) return line.slice('JEV_PASSWORD='.length).trim();
  }
  return null;
}

/**
 * The check.
 *
 * Two halves. The first is the house: every one of the eleven switches moves
 * the thing it names, a click on the canvas reaches the same switch a panel
 * row does, and Jev's four answers move the scene — the cat walks its path
 * with the probability, the look turns with the mood, the rain falls.
 *
 * The second is the endpoint. `/api/jev` is allowed to answer from the local
 * rules — an unfunded or offline gateway is a state this page is built to
 * survive — but it must say so, and the reply must still be a complete,
 * well-typed verdict. That is the line the check holds: the page may lose
 * the model, it may not lose the shape or pretend the model answered.
 *
 * Like the other checks this needs a dev or preview server already running
 * and Playwright Chromium. Every wait is generous: a frame of this scene on
 * SwiftShader is slow.
 */

const base = process.env.PREVIEW_URL || 'http://127.0.0.1:5173';

/**
 * Snap every tween to its destination, then wait for the scene to actually
 * draw it. A check drives the store in milliseconds and this scene renders in
 * something closer to a second under SwiftShader, so without the wait every
 * pose read back is one or two switches out of date.
 */
const settle = async () => {
  await page.evaluate(() => window.jev.settle());
  const at = await page.evaluate(() => window.jev.frames);
  await page.waitForFunction((f) => window.jev.frames > f + 1, at, { timeout: 60_000 });
};

const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1400, height: 860 }, deviceScaleFactor: 1 });
const errors = [];
// The probes below deliberately send requests the server must refuse — a
// wrong password, a malformed state, a POST — and the browser logs every one
// as a console error. The page itself never produces any of these, so
// ignoring exactly these three statuses is safe.
const expected = (text) => /status of (400|401|405)/.test(text);
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && !expected(m.text()) && errors.push(m.text()));
page.on('crash', () => errors.push('the page crashed'));
page.setDefaultTimeout(120_000);
await mkdir('artifacts', { recursive: true });

await page.goto(base);
await page.waitForFunction(() => window.jev?.store.getState().ready === true, { timeout: 240_000 });

const PARTS = [
  'door',
  'window',
  'curtain',
  'shutters',
  'attic',
  'chair',
  'hearth',
  'kettle',
  'lamp',
  'laundry',
  'gramophone',
];

// --- the password gate ----------------------------------------------------
// The gate is enforced on `/api/jev`, not in the browser, so the check tests
// it where it is: the endpoint must refuse before the form is filled in, and
// the form must be what lifts the refusal.
const gate = await page.evaluate(async () => (await fetch('/api/session')).json());
if (gate.required) {
  const locked = await page.evaluate(async () => (await fetch('/api/jev?s=000000000000')).status);
  assert.equal(locked, 401, 'a locked deployment refuses /api/jev outright');

  const secret = await password();
  assert.ok(secret, 'this deployment is locked; set JEV_PASSWORD to check it');

  const wrong = await page.evaluate(
    async () =>
      (
        await fetch('/api/session', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ password: 'not the password' }),
        })
      ).status,
  );
  assert.equal(wrong, 401, 'and refuses a wrong password');

  // Through the form, as a visitor would, rather than by posting behind it.
  await page.getByLabel(/password|口令/i).fill(secret);
  await page.getByRole('button', { name: /unlock|开锁/i }).click();
  await page.waitForFunction(() => window.jev.store.getState().gate?.unlocked === true, {
    timeout: 30_000,
  });
  assert.equal(
    await page.evaluate(async () => (await fetch('/api/jev?s=000000000000')).status),
    200,
    'and opens once the password is right',
  );
  console.log('gate: locked until the password, then open');
} else {
  console.log('gate: no password configured, so the page is open');
}

// The title card covers the canvas until it is dismissed, and dismissing it
// is also what asks Jev the first question — so the check goes in the way a
// visitor does.
await page.getByRole('button', { name: /Step into the garden/i }).click();
await page.waitForFunction(() => window.jev.store.getState().reply !== null, { timeout: 120_000 });

// --- the state that is posted --------------------------------------------
const state = await page.evaluate(() => window.jev.state());
assert.equal(Object.keys(state).length, PARTS.length + 1, 'every switch plus the weather');
for (const [key, value] of Object.entries(state)) {
  assert.equal(typeof value, 'string', `${key} is described, not flagged`);
  assert.ok(value.length > 8, `${key} reads as a sentence ("${value}")`);
}
console.log(`state: ${Object.keys(state).length} readings, e.g. "${state.door}"`);

// --- every switch moves its own part, and only its own --------------------
await page.evaluate(() => window.jev.store.getState().toggleAuto()); // stop asking on every flip
let previous = await page.evaluate(() => window.jev.parts());
for (const id of PARTS) {
  await page.evaluate((i) => window.jev.flip(i), id);
  await settle();
  const now = await page.evaluate(() => window.jev.parts());
  const moved = PARTS.filter((part) => Math.abs(now[part] - previous[part]) > 0.5);
  assert.deepEqual(moved, [id], `flipping ${id} moved ${id} and nothing else`);
  assert.ok(Math.abs(now[id] - previous[id]) > 0.9, `${id} went end to end`);
  previous = now;
}
console.log(`switches: all ${PARTS.length} move end to end, one at a time`);

// Put the house back the way it opened.
for (const id of PARTS) {
  const v = await page.evaluate((i) => window.jev.value(i), id);
  if ((id === 'curtain') !== v > 0.5) await page.evaluate((i) => window.jev.flip(i), id);
}
await settle();

// --- the pointer reaches the same switches --------------------------------
// A click on the house must work the part under it. The panel and the canvas
// are the same action, so a check that only drove the store would prove a
// scene nobody can touch.
for (const id of ['door', 'window', 'shutters']) {
  const [x, y] = await page.evaluate((i) => window.jev.screen(i), id);
  await page.mouse.move(x, y);
  await page.waitForTimeout(350);
  assert.equal(
    await page.evaluate(() => window.jev.store.getState().hovered),
    id,
    `the pointer over the ${id} finds the ${id}`,
  );
  const before = await page.evaluate((i) => window.jev.switches()[i], id);
  await page.mouse.click(x, y);
  await page.waitForTimeout(350);
  assert.notEqual(
    await page.evaluate((i) => window.jev.switches()[i], id),
    before,
    `clicking the ${id} worked it`,
  );
  await page.evaluate((i) => window.jev.flip(i), id);
}
await page.mouse.move(20, 840);
await settle();
console.log('pointer: the door, the window and the shutters all answer a click on the house');

// --- the local judge, which must never be wrong about an empty house -------
const shut = await page.evaluate(() =>
  window.jev.judge({
    door: false, window: false, curtain: true, shutters: false, attic: false,
    chair: false, hearth: false, kettle: false, lamp: false, laundry: false,
    gramophone: false, raining: false,
  }),
);
assert.equal(shut.mood.choice, 'forlorn', 'a shut, cold, unlit house is forlorn');
assert.ok(shut.cat.probability < 0.1, `and no cat is coming in (${shut.cat.probability})`);
assert.equal(shut.nudge.choice, 'light-the-fire', 'and what it wants is a fire');

const wet = await page.evaluate(() =>
  window.jev.judge({
    door: true, window: true, curtain: false, shutters: true, attic: true,
    chair: true, hearth: true, kettle: true, lamp: true, laundry: true,
    gramophone: false, raining: true,
  }),
);
assert.equal(wet.mood.choice, 'draughty', 'rain through an open door is draughty');
assert.equal(wet.nudge.choice, 'shut-out-the-weather', 'and the fix is to shut it');
console.log('local judge: the two states it must not get wrong are right');

// --- Jev's answers move the scene ------------------------------------------
// A verdict handed straight to the page, so the scene's reaction can be
// tested without spending a request — and labelled `local`, because a still
// badged `typesafe-ai/jev` when no model answered is exactly the lie this
// page is built not to tell.
const feed = (mood, welcome, cat) =>
  page.evaluate(
    (v) =>
      window.jev.receive({
        source: 'local',
        note: 'Verdict supplied by scripts/check-jev.mjs.',
        verdict: {
          mood: { type: 'choice', choice: v.mood },
          welcome: { type: 'score', score: v.welcome },
          cat: { type: 'boolean', probability: v.cat },
          nudge: { type: 'choice', choice: 'nothing' },
        },
      }),
    { mood, welcome, cat },
  );

const catAt = async (probability) => {
  await feed('bright', 2, probability);
  await settle();
  await page.waitForTimeout(250);
  return page.evaluate(() => window.jev.cat());
};

const away = await catAt(0);
const maybe = await catAt(0.5);
const inside = await catAt(1);
assert.ok(away.position[2] > maybe.position[2], 'a doubtful cat stays out in the garden');
assert.ok(maybe.position[2] > inside.position[2], 'and a convinced one comes indoors');
assert.ok(inside.position[2] < 0, `a cat at P(true) 1 is inside the house (z ${inside.position[2].toFixed(2)})`);
assert.ok(away.position[1] > 0.8, 'and at 0 it is still up on the garden wall');
console.log(
  `cat: z ${away.position[2].toFixed(1)} -> ${maybe.position[2].toFixed(1)} -> ${inside.position[2].toFixed(1)} as P(true) goes 0 -> 1`,
);

await feed('forlorn', 0, 0);
await settle();
const forlorn = await page.evaluate(() => window.jev.look());
await feed('bright', 4, 0);
await settle();
const bright = await page.evaluate(() => window.jev.look());
assert.ok(bright.sunIntensity > forlorn.sunIntensity * 1.5, 'a bright room stands in brighter weather');
assert.ok(bright.fogDensity < forlorn.fogDensity, 'and clearer air');
assert.notEqual(bright.horizon, forlorn.horizon, 'and a different sky');
console.log(
  `mood: sun ${forlorn.sunIntensity.toFixed(2)} -> ${bright.sunIntensity.toFixed(2)}, fog ${forlorn.fogDensity.toFixed(4)} -> ${bright.fogDensity.toFixed(4)}`,
);

// --- the weather -----------------------------------------------------------
assert.equal(await page.evaluate(() => window.jev.value('raining')), 0, 'it starts fine');
await page.evaluate(() => window.jev.flip('raining'));
await settle();
assert.equal(await page.evaluate(() => window.jev.value('raining')), 1, 'and it can rain');
await page.evaluate(() => window.jev.flip('raining'));
await settle();

// --- the endpoint ----------------------------------------------------------
const reply = await page.evaluate(() => window.jev.ask());
assert.ok(reply, 'the ask resolved');
assert.ok(reply.source === 'jev' || reply.source === 'local', `a named judge (${reply.source})`);
assert.deepEqual(
  Object.keys(reply.verdict).sort(),
  ['cat', 'mood', 'nudge', 'welcome'],
  'one answer per question',
);
assert.equal(reply.verdict.mood.type, 'choice');
assert.equal(reply.verdict.welcome.type, 'score');
assert.equal(reply.verdict.cat.type, 'boolean');
assert.ok(
  reply.verdict.cat.probability >= 0 && reply.verdict.cat.probability <= 1,
  'P(true) is a probability',
);
assert.ok(reply.verdict.welcome.score >= 0 && reply.verdict.welcome.score <= 4, 'the score is on the ladder');
if (reply.source === 'jev') {
  console.log(`jev: answered in ${reply.ms} ms, ${reply.inputTokens} input tokens`);
} else {
  // Not a failure. A page that hid this would be the failure.
  console.log(`!! the model did not answer, and the page says so:`);
  console.log(`!! ${reply.note}`);
  const badge = await page.locator('text=LOCAL RULES').count();
  assert.ok(badge > 0, 'and the badge on screen says the local rules answered');
}

// --- what the endpoint refuses ---------------------------------------------
// This runs on a public URL, so the shape of what it accepts *is* the
// security model: twelve bits, nothing else. An open AI endpoint that took
// free-form input would be somebody else's prompt budget.
// `cache: 'reload'` throughout: without it the browser's own heuristic cache
// replays the first response and the check grades a cache it did not mean to
// test.
const probe = async (path, method = 'GET') =>
  page.evaluate(
    async ([p, m]) => {
      const r = await fetch(p, { method: m, cache: 'reload' });
      return { status: r.status, cache: r.headers.get('cache-control') };
    },
    [path, method],
  );

assert.equal((await probe('/api/jev')).status, 400, 'no state is refused');
assert.equal((await probe('/api/jev?s=0')).status, 400, 'a short state is refused');
assert.equal(
  (await probe('/api/jev?s=ignore+previous+instructions')).status,
  400,
  'anything that is not twelve bits is refused',
);
assert.equal((await probe('/api/jev?s=000000000000', 'POST')).status, 405, 'POST is refused');

const valid = await probe('/api/jev?s=010101010101');
assert.equal(valid.status, 200, 'twelve bits is accepted');
console.log('endpoint: refuses everything but twelve bits; POST is 405');

// Cacheable, which is what keeps a public endpoint from being a running
// meter: 4096 states is the entire universe of questions it can be asked.
//
// How to *prove* it differs by where this runs. Straight from the function
// the response still carries `s-maxage`, and the second ask comes back from
// the instance's own map. Behind Vercel's edge it does not: a CDN consumes
// the shared-cache directives and rewrites what it passes downstream, so
// `s-maxage` is gone and the evidence is `x-vercel-cache` instead — which is
// the better evidence anyway, because a HIT means the function was never
// invoked at all.
const ask = () =>
  page.evaluate(async () => {
    const r = await fetch('/api/jev?s=010101010101', { cache: 'reload' });
    return {
      control: r.headers.get('cache-control') ?? '',
      edge: r.headers.get('x-vercel-cache'),
      body: await r.json(),
    };
  });

const first = await ask();
const second = await ask();

if (first.body.source !== 'jev') {
  console.log('!! no model, so nothing to cache — skipping the cache assertions');
} else if (gate.required) {
  // A gated deployment must keep its answers out of every shared cache: the
  // edge keys on the URL alone, so a cached 200 would be served to anyone
  // who guessed the URL, password or no password. The per-instance map is
  // what still spares the model.
  assert.match(first.control, /no-store/, 'a gated answer is never offered to a shared cache');
  assert.equal(second.body.cached, true, 'but the instance cache still spares the model');
  console.log('cache: no shared caching while gated; the instance cache still holds');
} else {
  assert.match(first.control, /public/, 'a model answer is marked cacheable');
  if (second.edge) {
    assert.match(second.edge, /HIT|STALE/, `the edge served the repeat (${second.edge})`);
    console.log(`cache: the edge served the repeat — x-vercel-cache ${second.edge}`);
  } else {
    assert.match(first.control, /s-maxage=\d{4,}/, 'and is offered to a shared cache');
    assert.equal(second.body.cached, true, 'and the repeat came from the instance cache');
    console.log(`cache: repeat served from the instance cache, ${first.control}`);
  }
}

// --- the interface ---------------------------------------------------------
const title = () => page.locator('header h1').first().innerText();
const english = await title();
await page.getByRole('button', { name: /中文|English/ }).click();
assert.notEqual(await title(), english, 'the language toggle flips the title');
await page.getByRole('button', { name: /中文|English/ }).click();
assert.equal(await title(), english, 'and back again');

// --- a still per viewpoint -------------------------------------------------
await page.evaluate(() =>
  ['door', 'window', 'hearth', 'kettle', 'lamp', 'chair', 'curtain', 'gramophone'].forEach((id) =>
    window.jev.flip(id),
  ),
);
await feed('festive', 3.6, 0.9);
await settle();
for (const view of ['garden', 'porch', 'parlour']) {
  await page.evaluate((v) => window.jev.store.getState().setView(v), view);
  await page.waitForTimeout(2600);
  await settle();
  await page.screenshot({ path: `artifacts/jev-${view}.png` });
}
console.log('stills: artifacts/jev-garden.png, jev-porch.png, jev-parlour.png');

assert.deepEqual(errors, [], 'no console errors or uncaught exceptions');
await browser.close();
console.log('\nthe lamplight house ok');
