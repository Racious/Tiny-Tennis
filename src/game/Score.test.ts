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

function winGames(s: Score, side: Side, n: number) {
  let last;
  for (let g = 0; g < n; g++) last = winPoints(s, side, 4);
  return last!;
}

describe('Score — 一般模式（盤 / 搶七 / 三盤兩勝）', () => {
  it('一盤 6 局（差 2）拿下一盤，未達兩盤不結束', () => {
    const s = new Score('near', { mode: 'normal' });
    const ev = winGames(s, 'near', 6);
    expect(ev.setWon).toBe('near');
    expect(ev.matchWon).toBeUndefined();
    expect(s.sets).toEqual({ near: 1, far: 0 });
    expect(s.games).toEqual({ near: 0, far: 0 }); // 新盤歸零
    expect(s.setHistory).toEqual([{ near: 6, far: 0 }]); // 逐盤局數紀錄
  });

  it('6-6 進入搶七，搶七到 7（差 2）拿盤', () => {
    const s = new Score('near', { mode: 'normal' });
    winGames(s, 'near', 5);
    winGames(s, 'far', 5);          // 5-5
    winGames(s, 'near', 1);
    winGames(s, 'far', 1);          // 6-6
    expect(s.inTiebreak).toBe(true);
    winPoints(s, 'near', 6);
    winPoints(s, 'far', 4);         // 6-4 搶七
    const ev = winPoints(s, 'near', 1); // 7-4 拿盤
    expect(ev.setWon).toBe('near');
    expect(s.sets.near).toBe(1);
    expect(s.inTiebreak).toBe(false);
  });

  it('搶七必須差 2 分才結束（7-6 不算，續打到差 2）', () => {
    const s = new Score('near', { mode: 'normal' });
    winGames(s, 'near', 5);
    winGames(s, 'far', 5);
    winGames(s, 'near', 1);
    winGames(s, 'far', 1);            // 6-6 進搶七
    winPoints(s, 'near', 6);
    winPoints(s, 'far', 6);           // 搶七 6-6
    let ev = winPoints(s, 'near', 1); // 7-6
    expect(s.inTiebreak).toBe(true);  // 差 1 不結束
    expect(ev.setWon).toBeUndefined();
    ev = winPoints(s, 'far', 1);      // 7-7
    expect(s.inTiebreak).toBe(true);
    winPoints(s, 'near', 1);          // 8-7
    expect(s.inTiebreak).toBe(true);
    ev = winPoints(s, 'near', 1);     // 9-7 → 差 2 拿盤
    expect(ev.setWon).toBe('near');
    expect(s.sets.near).toBe(1);
    expect(s.inTiebreak).toBe(false);
  });

  it('搶七輸的一方該盤記為 6（局數 7-6 / 6-7）前的狀態正確', () => {
    const s = new Score('near', { mode: 'normal' });
    winGames(s, 'near', 5);
    winGames(s, 'far', 5);
    winGames(s, 'near', 1);
    winGames(s, 'far', 1);            // 6-6
    expect(s.games).toEqual({ near: 6, far: 6 });
    expect(s.inTiebreak).toBe(true);
  });

  it('三盤兩勝：先拿兩盤者勝', () => {
    const s = new Score('near', { mode: 'normal' });
    winGames(s, 'near', 6);          // 第一盤 near
    winGames(s, 'far', 6);           // 第二盤 far（換發後仍可連贏局）
    expect(s.sets).toEqual({ near: 1, far: 1 });
    expect(s.finished).toBe(false);
    const ev = winGames(s, 'near', 6); // 第三盤 near → 比賽結束
    expect(ev.setWon).toBe('near');
    expect(ev.matchWon).toBe('near');
    expect(s.finished).toBe(true);
    expect(s.sets).toEqual({ near: 2, far: 1 });
  });
});
