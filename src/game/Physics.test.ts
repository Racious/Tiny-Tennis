import { describe, expect, it } from 'vitest';
import { NET_H } from '../constants';
import { Ball } from '../entities/Ball';
import { hitLaunch, isInServiceBox, netCrossZ, updateBall } from './Physics';

function flyUntilEvent(ball: Ball): string {
  for (let i = 0; i < 600; i++) {
    const step = updateBall(ball, 1 / 60);
    if (step !== 'flying') return step;
  }
  return 'timeout';
}

describe('Physics — 過網判定', () => {
  it('一般弧線安全過網', () => {
    const z = netCrossZ({ x: 50, y: 180 }, { x: 50, y: 22 }, 4, 24);
    expect(z).not.toBeNull();
    expect(z!).toBeGreaterThan(NET_H);
  });

  it('低平軌跡掛網，球落在擊球方側', () => {
    const ball = new Ball();
    hitLaunch(ball, { x: 50, y: 180 }, 4, { x: 50, y: 22 }, 1.0, 2, 'near');
    expect(flyUntilEvent(ball)).toBe('netted');
    expect(ball.pos.y).toBeGreaterThan(100); // 近端（擊球方）側
    expect(ball.active).toBe(false);
  });

  it('同側飛行（未跨網）不觸發掛網', () => {
    expect(netCrossZ({ x: 50, y: 180 }, { x: 50, y: 120 }, 4, 2)).toBeNull();
  });

  it('足夠高度則正常落地', () => {
    const ball = new Ball();
    hitLaunch(ball, { x: 50, y: 180 }, 4, { x: 50, y: 22 }, 1.0, 24, 'near');
    expect(flyUntilEvent(ball)).toBe('landed');
    expect(ball.pos.y).toBeCloseTo(22, 0);
  });
});

describe('Physics — 發球區（對角規則）', () => {
  it('近端 deuce 發向遠端畫面左側發球區', () => {
    expect(isInServiceBox({ x: 25, y: 70 }, 'far', 'deuce')).toBe(true);
    expect(isInServiceBox({ x: 75, y: 70 }, 'far', 'deuce')).toBe(false);
    expect(isInServiceBox({ x: 25, y: 30 }, 'far', 'deuce')).toBe(false); // 超出發球線
  });

  it('遠端 ad 發向近端畫面左側發球區', () => {
    expect(isInServiceBox({ x: 25, y: 130 }, 'near', 'ad')).toBe(true);
    expect(isInServiceBox({ x: 75, y: 130 }, 'near', 'ad')).toBe(false);
    expect(isInServiceBox({ x: 25, y: 170 }, 'near', 'ad')).toBe(false);
  });
});
