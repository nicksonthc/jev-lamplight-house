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

## Leaving the endpoint open

`/api/jev` is public, and a public endpoint in front of a model is normally a
way to spend somebody else's money. The credential itself is never at risk —
it stays in the function and the build is grepped to prove it — but the
*quota behind it* would be, so three things guard it, in order of how much
they matter.

**The input space is 4096 states.** A request carries twelve bits (`?s=` and
twelve `0`/`1` characters) and nothing else; anything else is a 400 before a
credential is touched, and `POST` is a 405. This is the property that
matters, because it means the endpoint cannot be used to put an arbitrary
prompt through the model. The worst an abuser can do is ask about a cottage.

**So every answer is cacheable, and the cache is the whole universe.** A
model answer comes back with `s-maxage=86400`, so Vercel's edge serves
repeats without invoking the function at all (`x-vercel-cache: HIT`), and a
warm instance keeps its own map for the misses. Traffic stops being
proportional to cost. At Jev's $0.042 per million input tokens and ~1 000
tokens an ask, **every distinct question anyone can ever ask costs about
$0.17 in total** — and after that the model is never called again.

**A rate limit on what is left.** Only genuine cache misses reach the model,
at most twenty a minute per instance. Past that the local rules answer and
say so, which the page already renders honestly, so a throttled visitor sees
a working scene rather than an error.

If you want a hard ceiling on top of that, set a gateway budget — it is a
spend cap, so it is only meaningful once the account is metered:

```sh
vercel ai-gateway budgets set project jev-lamplight-house --limit 1 --refresh-period monthly
```

And if you would rather the page not be publicly usable at all, turn on
Deployment Protection for the project; the scene still works, answered by the
local rules.

### Keeping other people out

`AI_GATEWAY_API_KEY` and `VERCEL_OIDC_TOKEN` say *what may call the model*.
`JEV_PASSWORD` says *who may ask*. Set it and the deployment is locked: the
interface shows a password screen, and — the part that matters — `/api/jev`
refuses anything without a session cookie, so no amount of poking at the
endpoint spends anything.

```sh
vercel env add JEV_PASSWORD production   # or add it in the dashboard
vercel deploy --prod
```

The check is enforced in `src/server/session.ts`, on the server, because
that is where the spending happens; the lock screen is a consequence of it
rather than the mechanism. Deleting the component in devtools buys a view of
an unlit cottage and nothing else. The session is an HttpOnly, SameSite=Lax
cookie signed with an HMAC keyed on the password, so changing the password
invalidates every session, and wrong guesses are throttled to ten a minute.

**With no `JEV_PASSWORD` set, a Vercel deployment lets nobody in at all.**
That is deliberate: forgetting the variable must not leave a public endpoint
open in front of a paid model. Locally, an unset password simply means no
gate.

While the gate is on, answers are no longer offered to a shared cache — the
edge keys on the URL alone, so a cached `200` would be served to anyone who
guessed it. The per-instance cache still spares the model.

If you would rather hide the page itself as well, Vercel's own **Vercel
Authentication** with the scope set to *All Deployments* is free on every
plan and needs no code; it restricts the whole site to your Vercel account.
(Vercel's *Password* Protection is a paid Pro feature — this gate is the
free equivalent, and unlike Vercel Authentication it can be shared with
someone who has no Vercel account.)

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
