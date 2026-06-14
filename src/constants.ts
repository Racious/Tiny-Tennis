// 全部可調手感參數集中於此

// ── 邏輯解析度與主迴圈 ──────────────────────────────
export const LOGICAL_W = 256;
export const LOGICAL_H = 240;
export const RENDER_SCALE = 3; // 實際渲染解析度倍率（平滑向量風格）
export const FIXED_DT = 1 / 60;

// ── 平面場地空間（單位：court unit）────────────────
// y = 0 遠端底線、y = COURT_D 近端底線
export const COURT_W = 100;
export const COURT_D = 200;
export const NET_Y = COURT_D / 2;
export const SERVICE_LINE_OFF = 55; // 發球線距網
export const ALLEY_W = 14;          // 雙打巷寬（視覺用，判定仍採單打線）
export const NET_H = 10;            // 網高（過網判定）

// ── 透視投影 ───────────────────────────────────────
export const CX = 128;
export const Y_FAR = 56;
export const Y_NEAR = 218;
export const S_FAR = 0.62;
export const S_NEAR = 1.0;
export const PX = 1.85;     // 場地單位 → 像素（近端、scale=1 時）；僅小幅留出兩側場外空間
export const Z_FACTOR = 1.6; // 球高 z → 螢幕像素

// ── 球員 ───────────────────────────────────────────
export const PLAYER_SPEED = 80;   // units/s（玩家）
export const REACH = 19;          // 擊球容錯半徑 ≈ 球員寬度 2 倍餘
export const Z_HIT_MAX = 32;      // 一般抽球可及高度上限（涵蓋一般球弧頂 24、小球 30）
export const SWING_TIME = 0.3;    // 揮拍動畫（引拍→擊球→收拍全程）
export const SWING_WINDOW = 0.14; // 揮拍有效窗口：期間內球進入範圍即命中
export const WHIFF_COOLDOWN = 0.2;
export const HIT_COOLDOWN = 0.3;
// 移動範圍：不可過網、可小幅超出邊線
export const MOVE_X_MIN = -8;
export const MOVE_X_MAX = COURT_W + 8;
export const NEAR_Y_MIN = NET_Y + 10;
export const NEAR_Y_MAX = COURT_D + 14;
export const FAR_Y_MIN = -14;
export const FAR_Y_MAX = NET_Y - 10;

// ── 球飛行（落點導向模型）──────────────────────────
export const BALL_SPEED = 130;      // units/s → 一拍約 1.0~1.2 秒
export const BALL_SPEED_DEEP = 165; // 深球：快
export const BALL_SPEED_DROP = 100; // 小球：慢
export const BALL_SPEED_LOB = 92;   // 高吊球：高弧慢速過頂
export const ARC_NORMAL = 24;
export const ARC_DEEP = 16;
export const ARC_DROP = 30;
export const ARC_LOB = 42;
export const FLIGHT_MIN = 0.7;
export const FLIGHT_MAX = 1.35;
// 殺球：球高在窗口內時自動觸發（與一般擊球上限銜接，無判定死區）
export const SMASH_Z_MIN = 30;  // 高球觸發殺球（一般球弧頂約 26-29，不會誤判）
export const SMASH_Z_MAX = 52;
export const SMASH_SPEED = 210;
export const SMASH_ARC = 8;
export const SMASH_FLIGHT_MIN = 0.45;
// 第一彈後的滑行段
export const BOUNCE_VEL_DECAY = 0.45;
export const BOUNCE_TIME = 0.5;
export const BOUNCE_ARC = 0.35;

// ── 手感：落點抖動（stretch 風險）──────────────────
export const JITTER_BASE = 3.5;
export const JITTER_STRETCH = 9;   // 抖動量隨 stretch^2 放大
export const DEEP_RISK = 1.35;     // 深球額外風險倍率

// ── 正手 / 反手（依觸球在身體哪一側自動判定）────────
export const FOREHAND_POWER = 1.08;  // 正手：力量強、球速快
export const BACKHAND_POWER = 0.9;   // 反手：球速較慢…
export const BACKHAND_ANGLE = 1.2;   // …但可打出更開的角度
export const BACKHAND_CONTROL = 0.85; // 且控球較穩（抖動較小）

// ── 落點選擇表（朝對方半場，距對方底線）────────────
export const AIM_X_CENTER = COURT_W / 2;
export const AIM_X_SPREAD = 34;
export const DEPTH_NORMAL = 22;
export const DEPTH_DEEP = 8;
export const DEPTH_DROP = 78;
export const DEPTH_LOB = 12;
export const DEPTH_SMASH = 32;

// ── 發球（兩段式：拋球 → 揮擊）─────────────────────
export const SERVE_HAND_Z = 14;     // 持球高度
export const SERVE_TOSS_V = 50;     // 拋球初速
export const GRAVITY_Z = 70;        // 拋球重力
export const SERVE_SWEET_MIN = 24;  // 甜蜜點高度窗口
export const SERVE_SWEET_MAX = 33;
export const SERVE_SPEED_SWEET = 215; // 甜蜜點高點全力擊球：可發出 ACE 級快速球
export const SERVE_SPEED_WEAK = 130;
export const SERVE_ARC_SWEET = 9;
export const SERVE_ARC_WEAK = 16;
export const SERVE_JITTER_SWEET = 4;
export const SERVE_JITTER_WEAK = 9;
export const SERVE_AIM_SHIFT = 18;  // ←/→ 發球落點角度（外角/內角）
export const SERVE_FLIGHT_MIN = 0.4;
export const SERVE_FLIGHT_MAX = 1.2;
// 快速發球第一彈後保留更多速度（不易追到 → ACE）
export const SERVE_BOUNCE_DECAY = 0.62;

// ── 計分 ───────────────────────────────────────────
export const GAMES_TO_WIN = 3;          // 預設先取 3 局
export const MATCH_OPTIONS = [3, 6] as const; // Title 可選局數

// ── AI 難度參數（LEVEL 1–5，NES Tennis 式）─────────
export interface AiDifficulty {
  speed: number;       // 移動速度上限 units/s
  reactFrames: number; // 反應延遲（幀）
  trackErr: number;    // 追蹤誤差（units）
  aimJitter: number;   // 回球落點額外抖動
  deepRate: number;    // 打深球機率
  dropRate: number;    // 打小球機率
  netRush: number;     // 擊球後上網機率
  power: number;       // 回球球速倍率
  serveSweet: number;  // 發球命中甜蜜點機率
}

export const AI_LEVELS: AiDifficulty[] = [
  { speed: 48, reactFrames: 26, trackErr: 16, aimJitter: 12, deepRate: 0.1,  dropRate: 0.06, netRush: 0,    power: 0.92, serveSweet: 0.5 },
  { speed: 55, reactFrames: 20, trackErr: 12, aimJitter: 9,  deepRate: 0.18, dropRate: 0.08, netRush: 0,    power: 0.96, serveSweet: 0.65 },
  { speed: 62, reactFrames: 14, trackErr: 9,  aimJitter: 7,  deepRate: 0.28, dropRate: 0.1,  netRush: 0.12, power: 1.0,  serveSweet: 0.78 },
  { speed: 70, reactFrames: 10, trackErr: 6,  aimJitter: 5,  deepRate: 0.34, dropRate: 0.12, netRush: 0.25, power: 1.06, serveSweet: 0.88 },
  { speed: 78, reactFrames: 7,  trackErr: 4,  aimJitter: 4,  deepRate: 0.4,  dropRate: 0.12, netRush: 0.4,  power: 1.12, serveSweet: 0.95 },
];
export const SERVE_RETURN_PENALTY = 1.7; // 接發球反應延遲倍率（角落快速發球可成 ACE）
export const AI_HOME = { x: COURT_W / 2, y: 24 };
export const AI_RUSH_HOME = { x: COURT_W / 2, y: 70 }; // 上網站位
export const AI_ATTACK_GAP_RATE = 0.55; // 打玩家反向空檔機率

// ── 視覺（NES 彩色）────────────────────────────────
export const COLORS = {
  sky: '#000000',
  apron: '#a8632a',      // FC Tennis 式土黃球場外緣
  apronDark: '#7c4a1e',  // 兩側看台陰影
  court: '#2ba24a',      // 較鮮明的草綠
  crowd: '#4a58c8',      // 觀眾席藍牆
  crowdDark: '#2c3490',
  crowdLite: '#aab4f0',
  bannerBg: '#101418',   // 看台橫幅底
  line: '#f8f8f8',
  netBody: '#141414',    // 黑色網格（可透視）
  netMesh: '#000000',
  netTape: '#ffffff',
  netPost: '#e8e8e8',
  ball: '#ffd800',
  ballHi: '#fff8c0',
  shadow: 'rgba(0,0,0,0.4)',
  playerBody: '#d82800', // 玩家紅衣
  aiBody: '#0058f8',     // AI 藍衣
  skin: '#fcb8a0',
  hair: '#3a240e',
  shorts: '#f4f4f4',
  outline: 'rgba(0,0,0,0.3)',
  legs: '#1a1a1a',
  racketHandle: '#ac7c00',
  racketHead: '#e8e8e8',
  racketRim: '#b8b8b8',
  chairWood: '#7a4a12',
  chairSeat: '#a06a20',
  judgeBody: '#b81000',
  uiBg: '#000000',
  uiText: '#ffffff',
  uiDim: '#a0a0a0',
  title: '#ffd800',
};
