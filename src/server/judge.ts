import { createGateway } from '@ai-sdk/gateway';
import { experimental_evaluate as evaluate } from 'ai';
import { judgeLocally } from '../localJudge.js';
import {
  describeHouse,
  PART_IDS,
  QUESTIONS,
  type HouseSwitches,
  type JevReply,
  type Verdict,
} from '../questions.js';

/**
 * The Node half of the page. **Server only** — it is imported by `api/jev.ts` on
 * Vercel and by the `jev-api` plugin in `vite.config.ts` for the dev and
 * preview servers, and by nothing under `src/jev` that the browser loads. That
 * is the whole reason this file sits in its own folder: the credential is read
 * here and never leaves the process, so the page can call the model without
 * shipping anything to the browser.
 *
 * There are two ways to authenticate to the AI Gateway and they are not
 * equivalent:
 *
 * - **OIDC** (`VERCEL_OIDC_TOKEN`, from `vercel env pull` locally or injected
 *   on Vercel). This is what a Hobby account gets, it needs no card, and it
 *   is rate limited rather than billed.
 * - **An API key** (`AI_GATEWAY_API_KEY`, a `vck_…`). This bills the account
 *   that owns the key — and an account with no card on file has every request
 *   refused with a 403 telling you to add one, which is a confusing way to
 *   discover that the key was never the problem.
 *
 * So this module tries OIDC first. That is the opposite of the SDK's own
 * default, which is deliberate: `getGatewayAuthToken` takes an API key over
 * OIDC whenever one is in reach, so simply having a key in the environment
 * silently opts a free account into the path that cannot work for it.
 */

export const JEV_MODEL = 'typesafe-ai/jev';

/**
 * The SDK reads `AI_GATEWAY_API_KEY` straight out of the environment, and
 * there an API key always beats OIDC. Take it out of the environment once, at
 * import, and hand it back explicitly only when this module means to use it —
 * so the precedence below is the same in dev, in preview and on Vercel rather
 * than depending on which variables happen to be set where.
 */
const ambientApiKey = process.env.AI_GATEWAY_API_KEY;
delete process.env.AI_GATEWAY_API_KEY;

export interface GatewayCredentials {
  /** A Vercel OIDC token: `vercel env pull`, or injected on Vercel. */
  oidcToken?: string;
  /** An AI Gateway API key. Billed to whoever owns it. */
  apiKey?: string;
}

/** Which credential a reply was obtained with, for the panel to say so. */
export type AuthMethod = 'oidc' | 'api-key';

function authorise({ oidcToken, apiKey }: GatewayCredentials) {
  const token = oidcToken ?? process.env.VERCEL_OIDC_TOKEN;
  if (token) {
    // `@vercel/oidc` reads this variable (or the request's own
    // `x-vercel-oidc-token` header). Vite's `loadEnv` deliberately does not
    // populate `process.env`, so a token pulled into `.env.local` has to be
    // put there by hand.
    process.env.VERCEL_OIDC_TOKEN = token;
    return { gateway: createGateway(), via: 'oidc' as AuthMethod };
  }
  const key = apiKey ?? ambientApiKey;
  if (key) return { gateway: createGateway({ apiKey: key }), via: 'api-key' as AuthMethod };
  // No credential in hand, but on Vercel the OIDC token arrives on the request
  // rather than in the environment, and the SDK will find it there. Worth one
  // attempt: if there is genuinely nothing, it throws and the caller falls
  // back to the local rules with the reason.
  return { gateway: createGateway(), via: 'oidc' as AuthMethod };
}

/** The request body, from a client we do not get to trust. */
function readSwitches(body: unknown): HouseSwitches {
  const raw = (body ?? {}) as Record<string, unknown>;
  const s = { raining: raw.raining === true } as HouseSwitches;
  for (const id of PART_IDS) s[id] = raw[id] === true;
  return s;
}

/**
 * Jev answers in the shape its question types promise — the SDK validates that
 * before we see it — so this only narrows the strings to the unions the scene
 * switches on.
 */
const asVerdict = (answers: unknown) => answers as Verdict;

/**
 * Judge one house. Asks Jev, and falls back to the local rules on any failure
 * — carrying the reason back to the page rather than swallowing it. A page
 * that quietly showed rule output as model output would hide the one thing
 * worth seeing.
 */
export async function judgeHouse(
  body: unknown,
  credentials: GatewayCredentials,
): Promise<JevReply> {
  const switches = readSwitches(body);
  const { gateway, via } = authorise(credentials);

  const started = Date.now();
  try {
    const result = await evaluate({
      model: gateway.evaluationModel(JEV_MODEL),
      state: describeHouse(switches),
      questions: QUESTIONS,
    });
    return {
      source: 'jev',
      auth: via,
      verdict: asVerdict(result.answers),
      modelId: result.response.modelId,
      inputTokens: result.usage.inputTokens,
      ms: Date.now() - started,
    };
  } catch (error) {
    return {
      source: 'local',
      auth: via,
      verdict: judgeLocally(switches),
      note: `${JEV_MODEL} did not answer over ${via} — ${message(error)}${advice(via)}`,
      ms: Date.now() - started,
    };
  }
}

/**
 * The one line that turns the gateway's error into something to do about it.
 * The card message in particular is a dead end on a Hobby account: the fix is
 * to stop using the key, not to pay.
 */
function advice(via: AuthMethod): string {
  return via === 'api-key'
    ? ' · An API key bills the account that owns it. On a free Hobby account use OIDC instead: run `vercel login`, `vercel link`, then `vercel env pull`, which writes VERCEL_OIDC_TOKEN into .env.local, and restart the dev server.'
    : ' · The OIDC token lasts about twelve hours. Run `vercel env pull` again and restart the dev server.';
}

/** The one sentence worth putting on screen out of an SDK error object. */
function message(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const e = error as { responseBody?: string; message?: string; cause?: unknown };
    const body = e.responseBody ?? (e.cause as { responseBody?: string } | undefined)?.responseBody;
    if (body) {
      try {
        const parsed = JSON.parse(body) as { error?: { message?: string } };
        if (parsed.error?.message) return parsed.error.message;
      } catch {
        // Not JSON; the SDK message below is the better line anyway.
      }
    }
    if (e.message) return e.message;
  }
  return String(error);
}
