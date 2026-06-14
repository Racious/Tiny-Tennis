// 球的狀態資料（行為在 game/Physics.ts）
import { COURT_W, NET_Y } from '../constants';
import type { Side, Vec2 } from '../types';

export class Ball {
  active = false;
  pos: Vec2 = { x: COURT_W / 2, y: NET_Y + 50 };
  z = 0;
  // 落點導向飛行參數
  start: Vec2 = { x: 0, y: 0 };
  target: Vec2 = { x: 0, y: 0 };
  z0 = 0;
  arc = 0;
  flightTime = 1;
  t = 0;
  // 回合狀態
  bounces = 0;
  lastHitBy: Side | null = null;
  isServe = false;
  /** 每次（擊球或彈跳）重新發射時遞增，供 AI 偵測新軌跡 */
  launchId = 0;
  /** 快球（殺球 / 甜蜜點發球）旗標與殘影軌跡 */
  fast = false;
  trail: { x: number; y: number; z: number }[] = [];
}
