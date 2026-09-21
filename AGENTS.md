# Agent guide — the lamplight house

A cottage with eleven working parts, judged as you flip them by
`typesafe-ai/jev` through the Vercel AI Gateway. React Three Fiber, one
server endpoint, no models or textures.

`README.md` is the tour: what Jev is asked, how to authenticate, the file
map. Read it first. This file covers the conventions that will bite.

## Commands

```sh
npm install
npm run dev          # Vite at http://127.0.0.1:5173
npm run build        # tsc --noEmit, then vite build
npm run typecheck    # the fast feedback loop
npm run preview      # serve dist/ on 4173

PREVIEW_URL=http://127.0.0.1:5173 npm run check   # Playwright, needs a server
```

There is no unit test suite. `typecheck` plus `npm run check` is the whole
verification story; run `typecheck` after any edit and `check` after anything
that touches the scene graph, the store or the interface.

## Conventions that matter here

**OIDC first, and `judge.ts` has to take the key out of the environment to
make that stick.** The two credentials are not interchangeable: OIDC
(`vercel link`, or injected on Vercel) is free and needs no card, while an API
key bills whoever owns it and is refused outright by an account with none.
The SDK's `getGatewayAuthToken` reads `AI_GATEWAY_API_KEY` straight out of
`process.env` and takes a key over OIDC whenever one is in reach, so simply
having a key around silently opts a free account into the path that cannot
work for it — and the 403 reads like a bad key. `src/server/judge.ts` deletes
the variable at import, keeps the value, and hands it back only when it means
to, so precedence is the same in dev, preview and production.

**The page may lose the model. It may not pretend it didn't.** `judgeHouse`
falls back to `localJudge.ts` on any failure and carries the reason back in
`note`, which the panel prints verbatim under a `LOCAL RULES` badge. Do not
dress the fallback up to look like the model: it returns no distributions
because it has none, and `check-jev.mjs` passes when the model is unreachable
*only* because the page says so on screen.

**Two things about `api/jev.ts` were learned by deploying it, and only by
deploying it.** Vercel's Node runtime transpiles each traced server file in
place and copies it into the lambda *without rewriting its imports*, so an
extensionless or `.ts` specifier survives into the emitted `.js` and the
function dies with `ERR_MODULE_NOT_FOUND` — with the traced files sitting
right beside it. Every relative specifier down the server chain therefore
ends in `.js`, pointing at the `.ts` file next to it. And the runtime hands
the classic `(req, res)` pair whatever the handler's signature suggests, so a
Web-standard `Request` handler dies on `request.json`; `src/server/handler.ts` is
one plain Node handler called by both `api/jev.ts` and the dev plugin. It
prefers `req.body` when the runtime has already parsed it, because reading
the consumed stream yields an empty body — and an empty body judges a house
with every switch off, which is a *plausible wrong answer* rather than an
error.

**The scene acts on the types, not on the prose.** A `boolean` comes back as
P(true) and the cat is that probability walked along a curve; the `score` is a
point on a five-rung ladder and drives the daylight; the `mood` choice picks a
`Look`. Thresholding an answer back down to a yes/no throws away what an
evaluation model is for.

**`src/server/` is server-only.** It is the only place that imports `ai` or
`@ai-sdk/gateway`, and nothing the browser loads may import it. `npm run
build` is the test — grep `dist/` for `@ai-sdk` and it is not there. That one
import chain is also why `vite.config.ts` and `server/judge.ts` carry explicit
`.ts` extensions on the specifiers they share: Vite's native config loader
cannot resolve them otherwise.

**Everything is a closed form of `src/clock.ts`.** A module ref advanced by
one `<SceneClock />` mounted **first** in `JevScene` — R3F runs same-priority
frame callbacks in mount order. The eleven parts read `motion.ts` tweens
(`from`, `to`, `at`); the fire, steam, smoke, rain, clouds, motes and cat are
sines and wrapped fractions of `t`. Nothing integrates per frame, which is
what lets `window.jev.settle()` make a still repeatable. A new moving thing
with its own timer breaks that.

**The store and the frame loop are kept apart.** Components subscribe with
selectors; anything that needs a value per frame calls
`useJevStore.getState()` inside `useFrame`. A new `useJevStore(s => ...)`
inside a per-frame component re-renders the canvas subtree every frame.

**One weather state, one writer.** `scene/look.ts` carries the sky, sun, fog
and exposure; `setLook` is its only writer and `Atmosphere` is the only thing
that pushes them at the renderer — including the wet-ground darkening. An
effect that kept its own idea of the weather would disagree with the other
three, and the first symptom is golden light over rained-on grass.

**A part's anchor sits on the part.** Each of the eleven is a pivot group
carrying `userData.part`, built beside the geometry it moves, with its own
`apply(v, t)` — so hit testing, the hover halo, the nudge ring and the label
all come from one place. The anchor must be a point *on* the part: put it
prettily beside one and the halo rings the plaster, and `check-jev.mjs` —
which clicks parts by projecting their anchors — clicks the wall.

**Three things were learned by watching the check fail**, and they will all
come back:

- A drei `<Html>` label needs `pointerEvents: 'none'` in **both** `style` and
  `wrapperClass`, or it eats the click it is labelling. The `pointerEvents`
  prop only applies in `transform` mode.
- Clearing the hover straight out of `onPointerOut` drops it at random,
  because R3F reports a crossing between two children of one `<primitive>` as
  an out-then-move in either order. `Cottage.tsx` guards it with a counter.
- The scene renders far slower than a check drives the store — a frame on
  SwiftShader can take a second — so the check waits on `window.jev.frames`
  before reading any pose.

**A fireplace is a recess, not a slab.** The chimney breast is built *around*
the opening (two piers and a head) rather than across it. A solid breast
buries the firebox, the trivet and the kettle inside 0.68 m of plaster, and
the parlour view shows a black rectangle with a light coming out of it. The
first version did exactly that.

## Style

TypeScript strict. Function components, no classes. Styling is Tailwind
utilities against the `@theme` tokens in `src/index.css` — reach for a token
(`text-rice`, `bg-ink`) rather than a raw hex. Comments explain *why* a magic
number is that number; the codebase is otherwise light on comments, and new
code should match that density.

The scene is a stylised composition, not a reconstruction of anywhere. Copy
that framing in any user-facing text.
