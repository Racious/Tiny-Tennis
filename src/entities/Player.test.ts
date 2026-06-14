import { describe, expect, it } from 'vitest';
import { Player } from './Player';
import { HitType, emptyIntent } from '../types';

describe('Player animation actions', () => {
  it('tracks a complete forehand action independently from the hit window', () => {
    const player = new Player('near', 80);
    player.startSwing(HitType.NORMAL, 'forehand');

    player.update(emptyIntent(), 0.3);

    expect(player.swingTimer).toBe(0);
    expect(player.action).toBe('forehand');
    expect(player.actionProgress).toBeGreaterThan(0.5);
  });

  it('resets the toss pose before the next serve action', () => {
    const player = new Player('near', 80);
    player.startToss();
    expect(player.action).toBe('toss');

    player.finishToss();

    expect(player.tossing).toBe(false);
    expect(player.action).toBe('idle');
    expect(player.actionProgress).toBe(0);
  });

  it('supports pausing and single-frame stepping in motion lab', () => {
    const player = new Player('near', 80);
    player.startSwing(HitType.NORMAL, 'backhand');
    player.animationPaused = true;

    player.update(emptyIntent(), 1 / 60);
    expect(player.actionTime).toBe(0);

    player.animationStep = true;
    player.update(emptyIntent(), 1 / 60);
    expect(player.actionTime).toBeCloseTo(1 / 60);
  });

  it('keeps the last horizontal facing direction after movement stops', () => {
    const player = new Player('near', 80);
    player.update({ ...emptyIntent(), moveX: -1 }, 1 / 60);
    expect(player.facingX).toBe(-1);

    player.update(emptyIntent(), 1 / 60);
    expect(player.facingX).toBe(-1);

    player.update({ ...emptyIntent(), moveX: 1 }, 1 / 60);
    expect(player.facingX).toBe(1);
  });

  it('allows serve positioning before the toss and locks movement after it starts', () => {
    const player = new Player('near', 80);
    const startX = player.pos.x;

    player.update({ ...emptyIntent(), moveX: 1 }, 0.1);
    expect(player.pos.x).toBeGreaterThan(startX);

    player.startToss();
    const tossX = player.pos.x;
    player.update({ ...emptyIntent(), moveX: -1 }, 0.1);
    expect(player.pos.x).toBe(tossX);
  });
});
