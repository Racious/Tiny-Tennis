// 共用型別定義 — 平面場地空間（邏輯層）與控制介面

export interface Vec2 {
  x: number;
  y: number;
}

/** near = 下半場（玩家）、far = 上半場（AI） */
export type Side = 'near' | 'far';

export function otherSide(s: Side): Side {
  return s === 'near' ? 'far' : 'near';
}

export enum HitType {
  NORMAL = 'normal',
  LOB = 'lob',
  POWER = 'power', // 預留，MVP 未實裝
}

export type ServeCourt = 'deuce' | 'ad';

export type GamePhase = 'title' | 'serve' | 'rally' | 'pointEnd' | 'pause' | 'gameOver';

/** 控制器每一固定步輸出的操作意圖 */
export interface Intent {
  moveX: number; // -1 ~ 1
  moveY: number; // -1 ~ 1（+ 朝近端底線）
  hit: boolean;  // 邊緣觸發
  hitType: HitType;
  aimX: -1 | 0 | 1; // 擊球落點：左 / 中 / 右
  aimY: -1 | 0 | 1; // +1 深球（快但險）、-1 小球
}

export function emptyIntent(): Intent {
  return { moveX: 0, moveY: 0, hit: false, hitType: HitType.NORMAL, aimX: 0, aimY: 0 };
}

/** 提供給控制器的唯讀遊戲快照 */
export interface BallView {
  active: boolean;
  pos: Vec2;
  z: number;
  target: Vec2;
  lastHitBy: Side | null;
  bounces: number;
  launchId: number;
  isServe: boolean;
}

export interface GameView {
  phase: GamePhase;
  mySide: Side;
  mePos: Vec2;
  oppPos: Vec2;
  ball: BallView;
  canHit: boolean;
}

export interface Controller {
  update(view: GameView): Intent;
}
