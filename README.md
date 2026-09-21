# The lamplight house

A cottage with eleven working parts, and an evaluation model that has an
opinion about them.

Open the door, light the fire, put the kettle on. Every change is written out
as a short description of the room and handed to
[`typesafe-ai/jev`](https://vercel.com/kb/guide/typesafe-jev-and-ai-sdk)
through the [Vercel AI Gateway](https://vercel.com/docs/ai-gateway). Jev is an
**evaluation** model rather than a chat model: it takes one shared state and a
map of typed questions, and answers each one in its own type. The scene acts
on the answers.

Built with React Three Fiber. The geometry is procedural — no models, no
textures, nothing to download but the page.

```sh
npm install
npm run dev        # http://127.0.0.1:5173
```

It works with no credentials at all: without one, a local rule judge answers
the same four questions and the page says on screen that it did. See
[Authentication](#authentication) to reach the real model.

## What Jev is asked

| Question | Type | What the scene does with it |
| --- | --- | --- |
| How does the room read? | `choice` of five moods | picks the sky, the sun, the fog and the exposure |
| How welcoming is it? | `score` on a five-rung ladder | warms the daylight and the light in the room |
| Would a stray cat come in? | `boolean`, answered as P(true) | walks the cat that far along its path — wall, garden, doorstep, hearthrug |
| What does it still want? | `choice` of eight | rings that part in the scene, and offers it as a button |

The cat is the clearest of the four. A boolean comes back as a probability,
not a yes, so a cat at 0.55 stands on the doorstep thinking about it. Nothing
on the page thresholds it into a decision.

The response panel shows the whole envelope: every option's probability, the
raw JSON, and the last dozen asks, so you can watch a verdict move as you flip
switches. Distributions are the one part the fallback judge cannot fake —
when the rules are answering, those rows are simply empty.

```jsonc
// POST /api/jev  ← the state; the reply, abridged
{ "source": "jev", "auth": "oidc", "ms": 515, "inputTokens": 1002,
  "verdict": {
    "mood":    { "type": "choice",  "choice": "sleepy",
                 "probabilities": { "sleepy": 0.60, "festive": 0.36, "bright": 0.03 } },
    "welcome": { "type": "score",   "score": 3.16 },
    "cat":     { "type": "boolean", "probability": 0.68 },
    "nudge":   { "type": "choice",  "choice": "let-some-air-in" } } }
```

## Authentication

`/api/jev` is the only server-side code here, and it exists so the credential
never reaches the browser. There are two ways to authenticate to the gateway,
and picking the wrong one produces a misleading error:

| Route | Variable | Cost | Use it when |
| --- | --- | --- | --- |
| **OIDC** | `VERCEL_OIDC_TOKEN` | free, rate limited, **no card** | almost always, and always on a free plan |
| API key | `AI_GATEWAY_API_KEY` | bills the account that owns the key | you want the spend on one specific key |

An API key on an account with no card on file has **every** request refused
with *"AI Gateway requires a valid credit card on file"*, which reads like a
bad key and is not. Worse, the AI SDK's own `getGatewayAuthToken` prefers an
API key over OIDC whenever one is in reach, so merely having a key in the
environment opts a free account into the path that cannot work for it.
`src/server/judge.ts` therefore takes the key out of `process.env` at import
and tries OIDC first, and the panel reports which credential answered.

Set the OIDC route up locally, once:

```sh
vercel login
vercel link         # creates the project and writes VERCEL_OIDC_TOKEN to .env.local
```

then restart the dev server. **No GitHub repository and no deployment are
required** — the Vercel project is only the identity the token is minted
against, and `vercel link` makes one from this folder. The token lasts about
twelve hours; `vercel env pull` refreshes it. Deployed on Vercel, the token is
injected and there is nothing to configure.

Neither variable carries a `VITE_` prefix, deliberately: that prefix is what
tells Vite to inline a value into the browser bundle. `npm run build` is the
test — grep `dist/` for `@ai-sdk` and it is not there.

## How it is put together

```
index.html
api/jev.ts              The one endpoint: POST the house, get a verdict
src/
  App.tsx               Canvas + overlay composition
  index.css             Tailwind v4 theme tokens, `plaque` and `panel`
  questions.ts          The house's state and the four typed questions
  localJudge.ts         The rule judge that stands in for the model
  useJevStore.ts        Switches, tweens, the verdict, the ask history
  clock.ts  motion.ts   The scene clock, and closed-form tweens on it
  server/judge.ts       Node only: the gateway call, the credential, the fallback
  scene/
    buildCottage.ts     The cottage in plain Three.js; eleven pivots with an apply()
    buildGarden.ts      Ground, path, wall, trees, and the cat's route
    look.ts             One weather state; `setLook` is its only writer
    Atmosphere.tsx      The only writer of fog, background, exposure and lights
    Sky.tsx  Rain.tsx  Emissions.tsx  Cat.tsx  Camera.tsx
    Cottage.tsx         Mounts the build, animates it, and owns the pointer
    JevBridge.tsx       The read-only `window.jev` handle the check drives
  ui/                   Switchboard, reading, response, chrome, title card
scripts/check-jev.mjs   The Playwright check
```

Three rules hold the scene together:

**Everything is a closed form of the clock.** `src/clock.ts` is a module ref
advanced by one `<SceneClock />` mounted first. The eleven parts read tweens
(`from`, `to`, `at`); the fire, steam, smoke, rain, clouds, motes and cat are
sines and wrapped fractions of `t`. Nothing integrates per frame, so
`window.jev.settle()` makes any still repeatable.

**The store and the frame loop are kept apart.** React components subscribe
with selectors; anything that needs a value *per frame* calls
`useJevStore.getState()` inside `useFrame` instead, so flipping a switch costs
no re-render of the canvas subtree.

**A part is a pivot with an `apply(v, t)`,** written beside the geometry it
moves and carrying `userData.part` for hit testing — so a click on a door
panel, its knob or its glass all reach the same switch, and adding a part
needs no change anywhere else.

## Verification

With a dev or preview server running:

```sh
npm run check
```

It asserts that each of the eleven switches moves its own part and nothing
else, that hovering and clicking the house reaches the same switches the panel
does, that the local judge is right about the two states it must not get
wrong, that Jev's probability walks the cat and Jev's mood turns the weather,
and that `/api/jev` answers a complete, well-typed verdict from a named judge.

It does **not** fail when the model is unreachable — that is a state the page
is built to survive — but it prints the reason and insists the page is saying
so on screen. Stills go to `artifacts/`. Needs Playwright Chromium; a frame of
this scene on SwiftShader is slow, so every wait is generous.

## A note on the look

This is a stylised composition, not a reconstruction of anywhere. The cottage,
the garden and the cat are hand-written procedural geometry — boxes, spheres,
extruded wall shapes with holes punched in them — lit warmly and left chunky
on purpose.

## Licence

MIT.
