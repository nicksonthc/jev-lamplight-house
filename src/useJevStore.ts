import { create } from 'zustand';
import { clock } from './clock';
import { settled, tweenTo, tweenValue, type Tween } from './motion';
import { judgeLocally } from './localJudge';
import { setLook, snapLook } from './scene/look';
import {
  PART_IDS,
  stateKey,
  WELCOME_LEVELS,
  type HouseSwitches,
  type JevReply,
  type PartId,
} from './questions';

/** The two languages the page is written in. */
export type Language = 'en' | 'zh';

export type SwitchId = PartId | 'raining';

/** One ask, kept so the response panel can show a verdict changing. */
export interface AskRecord {
  /** Wall clock, for the timestamp in the list — not the scene clock. */
  at: number;
  reply: JevReply;
}

/**
 * How many asks to remember. Enough to see a verdict move as switches are
 * flipped, few enough that the list never becomes the page.
 */
const HISTORY = 12;
export type ViewName = 'garden' | 'porch' | 'parlour';

/** How long each thing takes to move, and how. A door is not a curtain. */
const TIMING: Record<SwitchId, [seconds: number, ease: Tween['ease']]> = {
  door: [0.85, 'swing'],
  window: [0.8, 'swing'],
  shutters: [0.7, 'swing'],
  attic: [0.6, 'swing'],
  curtain: [0.75, 'smooth'],
  chair: [0.7, 'smooth'],
  hearth: [1.6, 'smooth'],
  kettle: [0.9, 'smooth'],
  lamp: [0.5, 'smooth'],
  laundry: [0.8, 'smooth'],
  gramophone: [0.6, 'smooth'],
  raining: [3.5, 'smooth'],
};

/** The house as the page opens: shut up, cold, and nobody home. */
const INITIAL: HouseSwitches = {
  door: false,
  window: false,
  curtain: true,
  shutters: false,
  attic: false,
  chair: false,
  hearth: false,
  kettle: false,
  lamp: false,
  laundry: false,
  gramophone: false,
  raining: false,
};

const initialMotion = () => {
  const motion: Record<string, Tween> = {};
  for (const id of Object.keys(INITIAL) as SwitchId[]) motion[id] = settled(INITIAL[id] ? 1 : 0);
  // Jev has not answered yet, so the house starts cool and catless.
  motion.welcome = settled(0.25);
  motion.cat = settled(0);
  return motion;
};

interface JevStore {
  language: Language;
  switches: HouseSwitches;
  /** Every animated scalar on the page, keyed by switch id plus the two
   *  Jev drives directly: `welcome` (0–1) and `cat` (P(true)). */
  motion: Record<string, Tween>;

  reply: JevReply | null;
  /** Newest first, capped at HISTORY. */
  history: AskRecord[];
  asking: boolean;
  /** Ask again automatically a moment after the visitor stops fiddling. */
  auto: boolean;
  hovered: PartId | null;

  view: ViewName;
  /** Bumped on every camera request, so re-picking a view still re-flies. */
  cameraNonce: number;
  ready: boolean;

  toggleLanguage: () => void;
  flip: (id: SwitchId) => void;
  setHovered: (id: PartId | null) => void;
  setView: (view: ViewName) => void;
  toggleAuto: () => void;
  setReady: () => void;
  /** Take a reply — from the endpoint, or handed in by a check. */
  receive: (reply: JevReply) => void;
  /** Ask Jev about the house. Resolves null when a later ask supersedes it. */
  ask: () => Promise<JevReply | null>;
  /** Put every tween at its destination, for a still that is repeatable. */
  settle: () => void;
}

let pending: AbortController | null = null;
let debounce: ReturnType<typeof setTimeout> | null = null;

export const useJevStore = create<JevStore>((set, get) => ({
  language: 'en',
  switches: { ...INITIAL },
  motion: initialMotion(),
  reply: null,
  history: [],
  asking: false,
  auto: true,
  hovered: null,
  view: 'garden',
  cameraNonce: 0,
  ready: false,

  toggleLanguage: () => set({ language: get().language === 'en' ? 'zh' : 'en' }),

  flip: (id) => {
    const switches = { ...get().switches, [id]: !get().switches[id] };
    const [seconds, ease] = TIMING[id];
    set({
      switches,
      motion: {
        ...get().motion,
        [id]: tweenTo(switches[id] ? 1 : 0, get().motion[id], seconds, ease),
      },
    });
    // The look follows the rain at once — the mood Jev reads it under arrives
    // a second later, and a sky that waited for the verdict would lag the
    // raindrops it is meant to explain.
    setLook(get().reply?.verdict.mood.choice ?? 'bright', switches.raining);

    if (!get().auto) return;
    if (debounce) clearTimeout(debounce);
    // Long enough to flip three switches as one thought, short enough that
    // the house feels like it is watching.
    debounce = setTimeout(() => void get().ask(), 850);
  },

  setHovered: (hovered) => set({ hovered }),
  setView: (view) => set({ view, cameraNonce: get().cameraNonce + 1 }),
  toggleAuto: () => set({ auto: !get().auto }),
  setReady: () => set({ ready: true }),

  receive: (reply) => {
    const { verdict } = reply;
    setLook(verdict.mood.choice, get().switches.raining);
    set({
      reply,
      history: [{ at: Date.now(), reply }, ...get().history].slice(0, HISTORY),
      asking: false,
      motion: {
        ...get().motion,
        welcome: tweenTo(
          verdict.welcome.score / (WELCOME_LEVELS.length - 1),
          get().motion.welcome,
          2.2,
        ),
        // The cat takes its time crossing the garden either way.
        cat: tweenTo(verdict.cat.probability, get().motion.cat, 3.2),
      },
    });
  },

  settle: () => {
    const motion: Record<string, Tween> = {};
    for (const [id, tween] of Object.entries(get().motion)) motion[id] = settled(tween.to);
    set({ motion });
    snapLook();
  },

  ask: async () => {
    if (debounce) clearTimeout(debounce);
    pending?.abort();
    const controller = new AbortController();
    pending = controller;
    set({ asking: true });

    const switches = get().switches;
    let reply: JevReply;
    try {
      // A GET with the house as twelve bits, so the answer is cacheable at
      // the edge: there are only 4096 of them, and a repeat never reaches
      // the function — let alone the model.
      const response = await fetch(`/api/jev?s=${stateKey(switches)}`, {
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`/api/jev answered ${response.status}`);
      reply = (await response.json()) as JevReply;
    } catch (error) {
      if (controller.signal.aborted) return null;
      // No endpoint at all — a static host, or the dev server restarting.
      // The page keeps working and says which judge answered.
      reply = {
        source: 'local',
        verdict: judgeLocally(switches),
        note: `${error instanceof Error ? error.message : String(error)} — answered by the local rules in the browser.`,
      };
    }
    if (controller.signal.aborted) return null;
    pending = null;
    get().receive(reply);
    return reply;
  },
}));

/**
 * One animated scalar, read as a closed form of the clock. Per-frame code
 * calls this instead of subscribing: a selector here would re-render the
 * whole canvas subtree every frame.
 */
export function live(id: string, t = clock.t): number {
  const tween = useJevStore.getState().motion[id];
  return tween ? tweenValue(tween, t) : 0;
}

export const partIds = PART_IDS;
