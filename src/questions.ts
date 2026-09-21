/**
 * What the house is, and what Jev is asked about it.
 *
 * This module is the contract between the three places that need it: the
 * browser (which builds the state as the visitor flips things), the Node
 * handler that calls `typesafe-ai/jev` through the AI Gateway, and the local
 * rule judge that stands in when there is no key or no credit. It must stay
 * free of both `three` and `ai` so all three can import it.
 *
 * Jev is an *evaluation* model, not a chat model: it takes one shared state
 * and a map of typed questions, and returns a typed answer for each — a
 * choice with its distribution, a score on a named ladder, a probability for
 * a yes/no. That is exactly the shape a scene wants back. The house does not
 * need prose about itself; it needs a number it can light a lamp with.
 */

export const PART_IDS = [
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
] as const;

export type PartId = (typeof PART_IDS)[number];

/** Every switch in the house, plus the one thing outside it. */
export interface HouseSwitches extends Record<PartId, boolean> {
  raining: boolean;
}

/**
 * The two readings of every switch, written the way a person would describe
 * the room rather than as flags. Jev reads this state; a flag map would make
 * it guess what `curtain: true` meant.
 */
const READINGS: Record<PartId, [off: string, on: string]> = {
  door: ['the front door is closed', 'the front door stands wide open to the garden'],
  window: [
    'the casement window is latched shut',
    'both leaves of the casement window are swung open',
  ],
  curtain: ['the curtain is tied back', 'the curtain is drawn across the window'],
  shutters: ['the upstairs shutters are closed', 'the upstairs shutters are folded back'],
  attic: ['the round attic window is shut', 'the round attic window is propped open'],
  chair: [
    'the armchair is pushed back against the wall',
    'the armchair is drawn up to the hearth',
  ],
  hearth: ['the hearth is cold and dark', 'a fire is burning in the hearth'],
  kettle: ['the kettle is off the hob', 'the kettle is on the hob and steaming'],
  lamp: ['the hanging lamp is out', 'the hanging lamp is lit'],
  laundry: ['the washing line is empty', 'washing is hanging out on the line'],
  gramophone: ['the gramophone is silent', 'the gramophone is playing'],
};

const WEATHER: [dry: string, wet: string] = [
  'a warm still afternoon, low sun across the grass',
  'a rain shower, wind moving through the trees',
];

export type HouseState = { outside: string } & Record<PartId, string>;

/** The switches as the sentence Jev is handed. */
export function describeHouse(s: HouseSwitches): HouseState {
  const state = { outside: WEATHER[s.raining ? 1 : 0] } as HouseState;
  for (const id of PART_IDS) state[id] = READINGS[id][s[id] ? 1 : 0];
  return state;
}

/** The ladder `welcome` is scored against; the answer is a point on it. */
export const WELCOME_LEVELS = [
  'shut against the world',
  'indifferent — nobody is expected',
  'pleasant enough to step into',
  'warmly inviting',
  'a room nobody would want to leave',
] as const;

export const MOODS = ['sleepy', 'bright', 'draughty', 'forlorn', 'festive'] as const;
export type Mood = (typeof MOODS)[number];

export const NUDGES = [
  'light-the-fire',
  'put-the-kettle-on',
  'let-some-air-in',
  'shut-out-the-weather',
  'turn-up-the-light',
  'bring-the-washing-in',
  'draw-up-the-chair',
  'nothing',
] as const;
export type Nudge = (typeof NUDGES)[number];

/**
 * Which switch a nudge is about, so the scene can ring the thing Jev means
 * instead of only printing it.
 *
 * Jev names an intent, not a switch, and two of the eight can be satisfied by
 * more than one — "shut out the weather" is about whichever opening is
 * actually open, and on a still night nothing is. Resolving that here rather
 * than in a static map is why the ring lands on the door when it is the door
 * that is letting the rain in.
 */
export function nudgeTarget(
  nudge: Nudge,
  switches: HouseSwitches,
): { part: PartId; want: boolean } | null {
  const firstOpen = (...ids: PartId[]) => ids.find((id) => switches[id]);
  const firstShut = (...ids: PartId[]) => ids.find((id) => !switches[id]);
  switch (nudge) {
    case 'light-the-fire':
      return { part: 'hearth', want: true };
    case 'put-the-kettle-on':
      return { part: 'kettle', want: true };
    case 'let-some-air-in': {
      const part = firstShut('window', 'door', 'attic');
      return part ? { part, want: true } : null;
    }
    case 'shut-out-the-weather': {
      const part = firstOpen('door', 'window', 'attic');
      return part ? { part, want: false } : null;
    }
    case 'turn-up-the-light':
      return { part: 'lamp', want: true };
    case 'bring-the-washing-in':
      return { part: 'laundry', want: false };
    case 'draw-up-the-chair':
      return { part: 'chair', want: true };
    case 'nothing':
      return null;
  }
}

/**
 * The four judgments the scene acts on. Types are Jev's three: `choice` with
 * a described option per key, `score` against an ordered ladder, `boolean`
 * which comes back as P(true) rather than a bare yes.
 *
 * Kept as a plain literal — not built from the arrays above — because the
 * option descriptions are the prompt, and one place to read them is worth the
 * duplication of their names.
 */
export const QUESTIONS = {
  mood: {
    type: 'choice',
    instructions: 'Which single word best describes the room as it stands?',
    criteria: {
      sleepy: 'warm, dim and still — a room to doze in',
      bright: 'open and airy, daylight and moving air through it',
      draughty: 'the weather is getting in where it should not — rain or wind through an opening',
      forlorn: 'shut up, cold and unlit; nobody seems to be home',
      festive: 'lit, warm and lively, as though company were expected',
    },
  },
  welcome: {
    type: 'score',
    instructions:
      'How welcoming is the house to someone walking up the garden path right now?',
    criteria: WELCOME_LEVELS,
  },
  cat: {
    type: 'boolean',
    instructions:
      'A wary stray cat is sitting on the garden wall. Would it come inside and settle down?',
    criteria: {
      true: 'there is a way in, somewhere warm and soft to lie, and nothing indoors driving it off',
      false:
        'nothing is open, or the room is cold, dark, loud or wet, or there is nowhere comfortable to lie',
    },
  },
  nudge: {
    type: 'choice',
    instructions:
      'Name the single change that would most improve the house right now. Choose "nothing" only if the room is already as good as it could be.',
    criteria: {
      'light-the-fire': 'the hearth is cold and the room needs warmth',
      'put-the-kettle-on': 'there is warmth but nothing being made — no tea, no steam',
      'let-some-air-in': 'the room is shut and stuffy and the weather outside is fine',
      'shut-out-the-weather': 'rain or wind is coming in through something left open',
      'turn-up-the-light': 'the room is too dim to sit in comfortably',
      'bring-the-washing-in': 'washing is out on the line while it rains',
      'draw-up-the-chair': 'the fire is lit but nothing is placed to sit and enjoy it',
      nothing: 'the room wants for nothing at all',
    },
  },
} as const;

export type QuestionId = keyof typeof QUESTIONS;

/** Jev's reply, narrowed to the four questions above. */
export interface Verdict {
  mood: { type: 'choice'; choice: Mood; probabilities?: Record<string, number> };
  welcome: { type: 'score'; score: number; probabilities?: Record<string, number> };
  cat: { type: 'boolean'; probability: number };
  nudge: { type: 'choice'; choice: Nudge; probabilities?: Record<string, number> };
}

/** What `/api/jev` answers with, whoever did the judging. */
export interface JevReply {
  /** `jev` when the model answered; `local` when the rule judge stood in. */
  source: 'jev' | 'local';
  /**
   * Which credential the gateway was called with. Worth reporting because the
   * two fail in completely different ways: an API key on an account with no
   * card is refused outright, where OIDC on the same account works.
   */
  auth?: 'oidc' | 'api-key';
  verdict: Verdict;
  /** Why the model did not answer, when it did not. Shown on screen verbatim. */
  note?: string;
  modelId?: string;
  inputTokens?: number;
  ms?: number;
}
