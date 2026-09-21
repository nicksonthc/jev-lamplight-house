import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

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
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
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
