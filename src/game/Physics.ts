// 球物理：落點導向拋物線飛行、彈跳滑行、過網 / in / out 判定
import {
  BOUNCE_ARC, BOUNCE_TIME, BOUNCE_VEL_DECAY, COURT_D, COURT_W, NET_H, NET_Y,
  SERVICE_LINE_OFF,
} from '../constants';
import type { Ball } from '../entities/Ball';
import type { ServeCourt, Side, Vec2 } from '../types';
import { lerp } from '../utils';

export type BallStep = 'flying' | 'landed' | 'netted';

function launch(
  ball: Ball, from: Vec2, z0: number, target: Vec2,
  flightTime: number, arc: number, by: Side, isServe: boolean,
): void {
  ball.active = true;
  ball.start = { ...from };
  ball.pos = { ...from };
  ball.target = { ...target };
  ball.z = z0;
  ball.z0 = z0;
  ball.arc = arc;
  ball.flightTime = Math.max(flightTime, 0.05);
  ball.t = 0;
  ball.lastHitBy = by;
  ball.isServe = isServe;
  ball.launchId++;
  // 快球（殺球等級的球速）帶殘影
  const len = Math.hypot(target.x - from.x, target.y - from.y);
  ball.fast = len / ball.flightTime > 150;
  ball.trail = [];
}

/** 球員擊球 / 發球：重置彈跳數 */
export function hitLaunch(
  ball: Ball, from: Vec2, z0: number, target: Vec2,
  flightTime: number, arc: number, by: Side, isServe = false,
): void {
  launch(ball, from, z0, target, flightTime, arc, by, isServe);
  ball.bounces = 0;
}

/** 第一彈後的滑行段：沿原方向減速前進、彈跳弧變小（decay 可調，發球保留更多速度） */
export function startBounce(ball: Ball, decay = BOUNCE_VEL_DECAY): void {
  const dx = ball.target.x - ball.start.x;
  const dy = ball.target.y - ball.start.y;
  const len = Math.hypot(dx, dy) || 1;
  const v = (len / ball.flightTime) * decay;
  const next: Vec2 = {
    x: ball.pos.x + (dx / len) * v * BOUNCE_TIME,
    y: ball.pos.y + (dy / len) * v * BOUNCE_TIME,
  };
  const arc = Math.max(ball.arc * BOUNCE_ARC, 5);
  launch(ball, ball.pos, 0, next, BOUNCE_TIME, arc, ball.lastHitBy!, false);
  ball.bounces = 1;
}

/**
 * 軌跡跨越球網時的球高；不跨網（同側飛行）回傳 null。
 * 純函式，可單元測試。
 */
export function netCrossZ(start: Vec2, target: Vec2, z0: number, arc: number): number | null {
  const dy = target.y - start.y;
  if (dy === 0) return null;
  const pc = (NET_Y - start.y) / dy;
  if (pc <= 0 || pc >= 1) return null;
  return z0 * (1 - pc) + arc * 4 * pc * (1 - pc);
}

/** 推進球；回傳本步事件：續飛 / 落地 / 掛網 */
export function updateBall(ball: Ball, dt: number): BallStep {
  if (!ball.active) return 'flying';
  if (ball.fast) {
    ball.trail.push({ x: ball.pos.x, y: ball.pos.y, z: ball.z });
    if (ball.trail.length > 5) ball.trail.shift();
  }
  const prevP = Math.min(ball.t / ball.flightTime, 1);
  ball.t += dt;
  const p = Math.min(ball.t / ball.flightTime, 1);

  // 過網判定：本步跨越網線且球高不足 → 掛網
  const dy = ball.target.y - ball.start.y;
  if (dy !== 0) {
    const pc = (NET_Y - ball.start.y) / dy;
    if (pc > prevP && pc <= p) {
      const zc = netCrossZ(ball.start, ball.target, ball.z0, ball.arc);
      if (zc !== null && zc < NET_H) {
        // 球掛網落在擊球方側網前
        ball.pos.x = lerp(ball.start.x, ball.target.x, pc);
        ball.pos.y = NET_Y + Math.sign(ball.start.y - NET_Y) * 2;
        ball.z = 0;
        ball.active = false;
        return 'netted';
      }
    }
  }

  ball.pos.x = lerp(ball.start.x, ball.target.x, p);
  ball.pos.y = lerp(ball.start.y, ball.target.y, p);
  ball.z = ball.z0 * (1 - p) + ball.arc * 4 * p * (1 - p);
  return p >= 1 ? 'landed' : 'flying';
}

/** 落點是否在指定半場界內（壓線算 in；判定採單打線） */
export function isInHalf(pos: Vec2, half: Side): boolean {
  if (pos.x < 0 || pos.x > COURT_W) return false;
  return half === 'far'
    ? pos.y >= 0 && pos.y <= NET_Y
    : pos.y >= NET_Y && pos.y <= COURT_D;
}

/**
 * 發球落點是否在正確發球區。
 * 對角規則：近端 deuce（畫面右）發向遠端 deuce 區（畫面左），反之亦然。
 */
export function isInServiceBox(pos: Vec2, targetHalf: Side, court: ServeCourt): boolean {
  const half = COURT_W / 2;
  if (targetHalf === 'far') {
    if (pos.y < NET_Y - SERVICE_LINE_OFF || pos.y > NET_Y) return false;
    return court === 'deuce' ? pos.x >= 0 && pos.x <= half : pos.x >= half && pos.x <= COURT_W;
  }
  if (pos.y < NET_Y || pos.y > NET_Y + SERVICE_LINE_OFF) return false;
  return court === 'deuce' ? pos.x >= half && pos.x <= COURT_W : pos.x >= 0 && pos.x <= half;
}
