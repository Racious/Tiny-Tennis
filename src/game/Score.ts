// 計分狀態機（純邏輯、零 DOM / Canvas 依賴，可單元測試）
// 簡易模式：分 → 局 → 先取 N 局即勝。
// 一般模式：分 → 局 → 盤（6 局，差 2 勝；6-6 搶七到 7 差 2）→ 三盤兩勝。
import { GAMES_TO_WIN } from '../constants';
import { otherSide, type ServeCourt, type Side } from '../types';

export type ScoreMode = 'simple' | 'normal';

export interface ScoreEvents {
  pointWon: Side;
  gameWon?: Side;
  setWon?: Side;
  matchWon?: Side;
}

export interface ScoreOptions {
  mode?: ScoreMode;
  gamesToWin?: number; // 簡易模式：先取幾局
}

const POINT_NAMES = ['0', '15', '30', '40'];
const GAMES_PER_SET = 6;   // 一般模式：一盤局數
const SETS_TO_WIN = 2;     // 一般模式：三盤兩勝
const TIEBREAK_TO = 7;     // 搶七到 7（差 2）

export class Score {
  points: Record<Side, number> = { near: 0, far: 0 };
  games: Record<Side, number> = { near: 0, far: 0 };
  sets: Record<Side, number> = { near: 0, far: 0 };
  /** 各盤最終局數（每盤結束時記錄），供轉播式計分板逐盤顯示 */
  setHistory: Array<Record<Side, number>> = [];
  server: Side;
  finished = false;
  winner: Side | null = null;
  inTiebreak = false;
  readonly mode: ScoreMode;
  readonly gamesToWin: number;
  private pointsInGame = 0;
  private tbPoints = 0;

  constructor(firstServer: Side = 'near', opts: ScoreOptions = {}) {
    this.server = firstServer;
    this.mode = opts.mode ?? 'simple';
    this.gamesToWin = opts.gamesToWin ?? GAMES_TO_WIN;
  }

  /** 發球區每分輪換：本局第偶數分自 Deuce side 發 */
  get serveCourt(): ServeCourt {
    return this.pointsInGame % 2 === 0 ? 'deuce' : 'ad';
  }

  pointWon(winner: Side): ScoreEvents {
    const ev: ScoreEvents = { pointWon: winner };
    if (this.finished) return ev;
    const loser = otherSide(winner);

    // ── 搶七 ──
    if (this.inTiebreak) {
      this.points[winner]++;
      this.tbPoints++;
      this.pointsInGame++;
      if (this.tbPoints % 2 === 1) this.server = otherSide(this.server); // 首分後每 2 分換發
      if (this.points[winner] >= TIEBREAK_TO && this.points[winner] - this.points[loser] >= 2) {
        this.games[winner]++; // 7-6 拿下該盤
        this.winSet(winner, ev);
      }
      return ev;
    }

    // ── 一般局 ──
    this.points[winner]++;
    this.pointsInGame++;
    if (this.points[winner] >= 4 && this.points[winner] - this.points[loser] >= 2) {
      this.games[winner]++;
      this.points = { near: 0, far: 0 };
      this.pointsInGame = 0;
      ev.gameWon = winner;

      if (this.mode === 'simple') {
        if (this.games[winner] >= this.gamesToWin) this.endMatch(winner, ev);
        else this.server = otherSide(this.server);
        return ev;
      }

      // 一般模式：判斷盤 / 搶七
      if (this.games.near === GAMES_PER_SET && this.games.far === GAMES_PER_SET) {
        this.inTiebreak = true;
        this.points = { near: 0, far: 0 };
        this.pointsInGame = 0;
        this.tbPoints = 0;
        this.server = otherSide(this.server);
      } else if (this.games[winner] >= GAMES_PER_SET && this.games[winner] - this.games[loser] >= 2) {
        this.winSet(winner, ev);
      } else {
        this.server = otherSide(this.server);
      }
    }
    return ev;
  }

  private winSet(winner: Side, ev: ScoreEvents): void {
    this.sets[winner]++;
    ev.setWon = winner;
    this.setHistory.push({ near: this.games.near, far: this.games.far }); // 記錄該盤最終局數
    this.games = { near: 0, far: 0 };
    this.points = { near: 0, far: 0 };
    this.pointsInGame = 0;
    this.inTiebreak = false;
    this.tbPoints = 0;
    if (this.sets[winner] >= SETS_TO_WIN) this.endMatch(winner, ev);
    else this.server = otherSide(this.server);
  }

  private endMatch(winner: Side, ev: ScoreEvents): void {
    this.finished = true;
    this.winner = winner;
    ev.matchWon = winner;
  }

  pointsDisplay(nearLabel = 'P1', farLabel = 'CPU'): string {
    if (this.inTiebreak) return `${this.points.near} - ${this.points.far}`;
    const n = this.points.near;
    const f = this.points.far;
    if (n >= 3 && f >= 3) {
      if (n === f) return 'DEUCE';
      return `ADV ${n > f ? nearLabel : farLabel}`;
    }
    return `${POINT_NAMES[Math.min(n, 3)]} - ${POINT_NAMES[Math.min(f, 3)]}`;
  }
}
