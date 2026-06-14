import { describe, expect, it } from 'vitest';
import { Score } from './Score';
import type { Side } from '../types';

function winPoints(s: Score, side: Side, n: number) {
  let last;
  for (let i = 0; i < n; i++) last = s.pointWon(side);
  return last!;
}

describe('Score — 分數進位', () => {
  it('0/15/30/40 顯示與直落四拿局', () => {
    const s = new Score('near');
    expect(s.pointsDisplay()).toBe('0 - 0');
    s.pointWon('near');
    expect(s.pointsDisplay()).toBe('15 - 0');
    s.pointWon('far');
    expect(s.pointsDisplay()).toBe('15 - 15');
    s.pointWon('near');
    s.pointWon('near');
    expect(s.pointsDisplay()).toBe('40 - 15');
    const ev = s.pointWon('near');
    expect(ev.gameWon).toBe('near');
    expect(s.games.near).toBe(1);
    expect(s.pointsDisplay()).toBe('0 - 0'); // 局結束後分數歸零
  });

  it('40-40 進入 Deuce，需連贏兩分才拿局', () => {
    const s = new Score('near');
    winPoints(s, 'near', 3);
    winPoints(s, 'far', 3);
    expect(s.pointsDisplay()).toBe('DEUCE');

    let ev = s.pointWon('near');
    expect(s.pointsDisplay()).toBe('ADV P1');
    expect(ev.gameWon).toBeUndefined(); // Adv 不直接拿局

    ev = s.pointWon('far'); // 回到 Deuce
    expect(s.pointsDisplay()).toBe('DEUCE');
    expect(ev.gameWon).toBeUndefined();

    s.pointWon('far');
    expect(s.pointsDisplay()).toBe('ADV CPU');
    ev = s.pointWon('far');
    expect(ev.gameWon).toBe('far');
    expect(s.games.far).toBe(1);
  });
});

describe('Score — 發球輪替', () => {
  it('發球區每分輪換（Deuce/Ad side），Deuce 後仍正確', () => {
    const s = new Score('near');
    expect(s.serveCourt).toBe('deuce');
    s.pointWon('near');
    expect(s.serveCourt).toBe('ad');
    s.pointWon('far');
    expect(s.serveCourt).toBe('deuce');
    // 打到 40-40（共 6 分）→ 偶數 → deuce side
    winPoints(s, 'near', 2);
    winPoints(s, 'far', 2);
    expect(s.pointsDisplay()).toBe('DEUCE');
    expect(s.serveCourt).toBe('deuce');
  });

  it('發球權每局輪替，新局自 Deuce side 開始', () => {
    const s = new Score('near');
    winPoints(s, 'near', 3);
    s.pointWon('far'); // 打亂分數奇偶
    winPoints(s, 'near', 1);
    expect(s.server).toBe('far');
    expect(s.serveCourt).toBe('deuce');
  });
});

describe('Score — 終局', () => {
  it('先取 3 局者勝出、比賽結束', () => {
    const s = new Score('near');
    winPoints(s, 'near', 4);
    winPoints(s, 'far', 4);
    winPoints(s, 'near', 4);
    expect(s.games).toEqual({ near: 2, far: 1 });
    expect(s.finished).toBe(false);

    const ev = winPoints(s, 'near', 4);
    expect(ev.gameWon).toBe('near');
    expect(ev.matchWon).toBe('near');
    expect(s.finished).toBe(true);
    expect(s.winner).toBe('near');
  });

  it('結束後不再計分', () => {
    const s = new Score('near');
    for (let i = 0; i < 3; i++) winPoints(s, 'near', 4);
    const before = { ...s.games };
    s.pointWon('far');
    expect(s.games).toEqual(before);
  });
});
