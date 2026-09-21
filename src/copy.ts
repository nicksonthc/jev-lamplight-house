import type { Language } from './useJevStore';
import type { Mood, Nudge, PartId } from './questions';

/**
 * Everything the interface says, in both languages.
 *
 * The part names are also the labels Jev's nudge is printed against, so the
 * two have to stay in the same file as the ids they key off.
 */

interface PartCopy {
  name: string;
  /** What the switch reads as when it is on, and when it is off. */
  on: string;
  off: string;
}

const partsEn: Record<PartId, PartCopy> = {
  door: { name: 'Front door', on: 'Open', off: 'Shut' },
  window: { name: 'Casement window', on: 'Open', off: 'Latched' },
  curtain: { name: 'Curtain', on: 'Drawn', off: 'Tied back' },
  shutters: { name: 'Upstairs shutters', on: 'Folded back', off: 'Closed' },
  attic: { name: 'Attic window', on: 'Propped', off: 'Shut' },
  chair: { name: 'Armchair', on: 'By the fire', off: 'Against the wall' },
  hearth: { name: 'Hearth', on: 'Lit', off: 'Cold' },
  kettle: { name: 'Kettle', on: 'On the hob', off: 'Off the hob' },
  lamp: { name: 'Hanging lamp', on: 'Lit', off: 'Out' },
  laundry: { name: 'Washing line', on: 'Hung out', off: 'Empty' },
  gramophone: { name: 'Gramophone', on: 'Playing', off: 'Silent' },
};

const partsZh: Record<PartId, PartCopy> = {
  door: { name: '前门', on: '敞开', off: '关着' },
  window: { name: '对开窗', on: '推开', off: '闩上' },
  curtain: { name: '窗帘', on: '拉上', off: '束起' },
  shutters: { name: '楼上百叶窗', on: '折开', off: '合上' },
  attic: { name: '阁楼圆窗', on: '支起', off: '关着' },
  chair: { name: '扶手椅', on: '挪到炉边', off: '靠墙放着' },
  hearth: { name: '壁炉', on: '生着火', off: '冷着' },
  kettle: { name: '水壶', on: '坐在炉上', off: '搁在桌上' },
  lamp: { name: '吊灯', on: '亮着', off: '灭着' },
  laundry: { name: '晾衣绳', on: '晾着衣裳', off: '空着' },
  gramophone: { name: '留声机', on: '放着曲子', off: '静着' },
};

export const jevCopy = {
  en: {
    mark: 'JEV',
    title: 'The lamplight house',
    subtitle: 'A cottage, eleven switches, and a model that keeps an opinion',
    blurb:
      'Open the door, light the fire, put the kettle on. Every change is written out as a sentence and handed to Jev — an evaluation model that answers typed questions about a state rather than chatting about it. Its four answers come back as a choice, a score and a probability, and the house acts on them: the sky turns to the mood it names, the light warms with the welcome it scores, and the cat on the wall decides whether to come in.',
    begin: 'Step into the garden',
    parts: partsEn,
    raining: { name: 'The weather', on: 'Rain', off: 'Fine' },
    switchboard: 'The house',
    outside: 'Outside',
    views: { garden: 'Garden', porch: 'Porch', parlour: 'Parlour' },
    viewsAria: 'Where to stand',
    ask: 'Ask Jev',
    asking: 'Asking Jev…',
    auto: 'Ask as I go',
    verdict: "Jev's reading",
    waiting: 'Flip something and Jev will have a look.',
    questions: {
      mood: 'The room reads as',
      welcome: 'Welcome',
      cat: 'Would the cat come in',
      nudge: 'What it still wants',
    },
    moods: {
      sleepy: 'sleepy',
      bright: 'bright',
      draughty: 'draughty',
      forlorn: 'forlorn',
      festive: 'festive',
    } satisfies Record<Mood, string>,
    welcomeLevels: [
      'shut against the world',
      'indifferent',
      'pleasant enough',
      'warmly inviting',
      'nobody would leave',
    ],
    nudges: {
      'light-the-fire': 'light the fire',
      'put-the-kettle-on': 'put the kettle on',
      'let-some-air-in': 'let some air in',
      'shut-out-the-weather': 'shut out the weather',
      'turn-up-the-light': 'turn up the light',
      'bring-the-washing-in': 'bring the washing in',
      'draw-up-the-chair': 'draw up the chair',
      nothing: 'nothing at all',
    } satisfies Record<Nudge, string>,
    catIn: 'The cat is on the rug.',
    catStep: 'The cat is on the doorstep, thinking about it.',
    catOut: 'The cat is staying on the wall.',
    sources: { jev: 'typesafe-ai/jev', local: 'Local rules' },
    sourceNote: 'How this answer was reached',
    localBadge: 'LOCAL RULES',
    tokens: 'in',
    hint: 'Click anything on the house — or use the switches',
    loading: 'BUILDING THE HOUSE',
    source: 'Source ↗',
    gateway: 'AI Gateway ↗',
    toggle: '中文',
    switchLanguage: '切换至中文',
    state: 'What Jev was told',
    stateHint: 'The state posted with every question',
    response: 'Jev response',
    responseHide: 'Hide the response',
    responseShow: 'Show the response',
    noAsks: 'Nothing asked yet.',
    raw: 'Raw response',
    recent: 'Recent asks',
    auths: { oidc: 'oidc', 'api-key': 'api key' },
    probability: 'P(true)',
    cached: 'cached',
  },
  zh: {
    mark: 'JEV',
    title: '灯火小屋',
    subtitle: '一座小屋，十一处开关，和一个有主意的模型',
    blurb:
      '开门、生火、坐上水壶。每一次改动都写成一段话交给 Jev——一个评估模型：它不闲聊，只对给定状态回答有类型的问题。四个答案分别是一个选项、一个分数和一个概率，小屋照着做：天色转成它说的心境，灯火随它给的分数变暖，墙头那只猫再决定进不进来。',
    begin: '走进院子',
    parts: partsZh,
    raining: { name: '天气', on: '下雨', off: '晴好' },
    switchboard: '屋里屋外',
    outside: '屋外',
    views: { garden: '院子', porch: '门廊', parlour: '堂屋' },
    viewsAria: '站在哪里',
    ask: '问问 Jev',
    asking: '正在问 Jev……',
    auto: '改了就问',
    verdict: 'Jev 的判断',
    waiting: '随便动一处，Jev 就会看看。',
    questions: {
      mood: '此刻的屋子',
      welcome: '待客之意',
      cat: '猫会进来吗',
      nudge: '还差一件事',
    },
    moods: {
      sleepy: '昏然欲睡',
      bright: '敞亮',
      draughty: '灌风',
      forlorn: '冷清',
      festive: '热闹',
    } satisfies Record<Mood, string>,
    welcomeLevels: ['闭门谢客', '不冷不热', '尚可一坐', '暖意相迎', '叫人不想走'],
    nudges: {
      'light-the-fire': '生个火',
      'put-the-kettle-on': '坐上水壶',
      'let-some-air-in': '透透气',
      'shut-out-the-weather': '挡住风雨',
      'turn-up-the-light': '点亮些',
      'bring-the-washing-in': '把衣裳收了',
      'draw-up-the-chair': '把椅子挪过来',
      nothing: '什么都不差',
    } satisfies Record<Nudge, string>,
    catIn: '猫卧在地毯上了。',
    catStep: '猫蹲在门槛上，还在犹豫。',
    catOut: '猫还在墙头上待着。',
    sources: { jev: 'typesafe-ai/jev', local: '本地规则' },
    sourceNote: '这个答案从哪儿来',
    localBadge: '本地规则',
    tokens: '输入',
    hint: '屋子上什么都能点——也可以用右边的开关',
    loading: '正在搭房子',
    source: '源码 ↗',
    gateway: 'AI Gateway ↗',
    toggle: 'EN',
    switchLanguage: 'Switch to English',
    state: 'Jev 收到的状态',
    stateHint: '每次提问一并送出的状态',
    response: 'Jev 的回覆',
    responseHide: '收起回覆',
    responseShow: '展开回覆',
    noAsks: '还没问过。',
    raw: '原始回覆',
    recent: '最近几次',
    auths: { oidc: 'oidc', 'api-key': 'api key' },
    probability: 'P(真)',
    cached: '缓存',
  },
} satisfies Record<Language, unknown>;

export type JevCopy = (typeof jevCopy)['en'];

/** What goes in `<html lang>`; `zh` alone is not a locale a browser wants. */
export const htmlLang = (language: Language) => (language === 'zh' ? 'zh-CN' : 'en');
