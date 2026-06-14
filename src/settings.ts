// 遊戲設定（難度 / 局數 / 音效 / 語言 / 按鍵）＋ localStorage 持久化 ＋ 多國語系
export type Lang = 'en' | 'zh';
export type BindAction = 'up' | 'down' | 'left' | 'right' | 'hit' | 'lob';
export type KeyBinds = Record<BindAction, string[]>;

const STORE_KEY = 'amagi-tennis-settings';

const DEFAULT_BINDS: KeyBinds = {
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  hit: ['Space', 'KeyJ'],
  lob: ['KeyK'],
};

export const BIND_ACTIONS: BindAction[] = ['up', 'down', 'left', 'right', 'hit', 'lob'];

export class Settings {
  mode: 'simple' | 'normal' = 'simple'; // 簡易 / 一般（正規網球規則）
  level = 3;            // LEVEL 1–5
  matchGames = 3;       // 簡易模式：先取 N 局
  muted = false;
  lang: Lang = 'en';
  binds: KeyBinds = clone(DEFAULT_BINDS);

  constructor() {
    this.load();
  }

  load(): void {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.mode === 'simple' || d.mode === 'normal') this.mode = d.mode;
      if (typeof d.level === 'number') this.level = d.level;
      if (typeof d.matchGames === 'number') this.matchGames = d.matchGames;
      if (typeof d.muted === 'boolean') this.muted = d.muted;
      if (d.lang === 'en' || d.lang === 'zh') this.lang = d.lang;
      if (d.binds) for (const a of BIND_ACTIONS) if (Array.isArray(d.binds[a])) this.binds[a] = d.binds[a];
    } catch {
      // 無 localStorage 或解析失敗 → 用預設
    }
  }

  save(): void {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        mode: this.mode, level: this.level, matchGames: this.matchGames,
        muted: this.muted, lang: this.lang, binds: this.binds,
      }));
    } catch {
      // 忽略
    }
  }

  resetBinds(): void {
    this.binds = clone(DEFAULT_BINDS);
    this.save();
  }

  /** 顯示按鍵名稱（取主鍵，去掉 Key/Arrow 前綴） */
  bindLabel(action: BindAction): string {
    return keyLabel(this.binds[action][0]);
  }
}

function clone(b: KeyBinds): KeyBinds {
  return JSON.parse(JSON.stringify(b));
}

export function keyLabel(code: string): string {
  if (!code) return '—';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Arrow')) return code.slice(5).toUpperCase();
  if (code.startsWith('Digit')) return code.slice(5);
  const map: Record<string, string> = {
    Space: 'SPACE', Enter: 'ENTER', Escape: 'ESC', ShiftLeft: 'LSHIFT',
    ShiftRight: 'RSHIFT', ControlLeft: 'LCTRL', ControlRight: 'RCTRL', Slash: '/',
    Comma: ',', Period: '.', Semicolon: ';',
  };
  return map[code] ?? code.toUpperCase();
}

// ── 多國語系 ───────────────────────────────────────
type Dict = Record<string, string>;
const STRINGS: Record<Lang, Dict> = {
  en: {
    subtitle: 'RETRO COURT CLASSIC',
    start: 'START GAME',
    settings: 'SETTINGS',
    mode: 'MODE',
    modeSimple: 'SIMPLE',
    modeNormal: 'NORMAL',
    bestOf3: 'BEST OF 3 SETS',
    setCol: 'SET',
    difficulty: 'DIFFICULTY',
    match: 'MATCH',
    sound: 'SOUND',
    language: 'LANGUAGE',
    keyConfig: 'KEY CONFIG',
    back: 'BACK',
    resetKeys: 'RESET KEYS',
    on: 'ON', off: 'OFF',
    firstTo: 'FIRST TO {0}',
    langName: 'ENGLISH',
    navMenu: '↑↓ SELECT   ENTER CONFIRM',
    navSettings: '↑↓ MOVE   ←→ CHANGE   ENTER/ESC',
    navKeys: '↑↓ MOVE   ENTER REBIND   ESC BACK',
    pressKey: 'PRESS A KEY...  (ESC CANCEL)',
    act_up: 'MOVE UP', act_down: 'MOVE DOWN', act_left: 'MOVE LEFT',
    act_right: 'MOVE RIGHT', act_hit: 'HIT / SERVE', act_lob: 'LOB',
    serveToss: 'SPACE: TOSS BALL',
    serveHit: 'SPACE: HIT! (TIME IT HIGH)',
    serveCpu: 'CPU SERVE',
    secondServe: '2ND SERVE - ',
    pause: 'PAUSE',
    youWin: 'YOU WIN!', cpuWins: 'CPU WINS',
    games: 'GAMES', pressEnter: 'PRESS ENTER',
  },
  zh: {
    subtitle: '復古球場經典',
    start: '開始遊戲',
    settings: '設定',
    mode: '模式',
    modeSimple: '簡易',
    modeNormal: '一般',
    bestOf3: '三盤兩勝',
    setCol: '盤',
    difficulty: '難度',
    match: '賽制',
    sound: '音效',
    language: '語言',
    keyConfig: '按鍵設定',
    back: '返回',
    resetKeys: '重設按鍵',
    on: '開', off: '關',
    firstTo: '先取 {0} 局',
    langName: '中文',
    navMenu: '↑↓ 選擇   ENTER 確認',
    navSettings: '↑↓ 移動   ←→ 調整   ENTER/ESC',
    navKeys: '↑↓ 移動   ENTER 重設此鍵   ESC 返回',
    pressKey: '請按一個鍵…  (ESC 取消)',
    act_up: '向上移動', act_down: '向下移動', act_left: '向左移動',
    act_right: '向右移動', act_hit: '擊球 / 發球', act_lob: '高吊球',
    serveToss: 'SPACE：拋球',
    serveHit: 'SPACE：擊球！(抓最高點)',
    serveCpu: '電腦發球',
    secondServe: '第二發 - ',
    pause: '暫停',
    youWin: '你贏了！', cpuWins: '電腦獲勝',
    games: '局數', pressEnter: '按 ENTER',
  },
};

export function t(lang: Lang, key: string, arg?: string | number): string {
  const s = STRINGS[lang][key] ?? STRINGS.en[key] ?? key;
  return arg === undefined ? s : s.replace('{0}', String(arg));
}
