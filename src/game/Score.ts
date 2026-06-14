// 計分狀態機：分（0/15/30/40/Deuce/Adv）→ 局 → 場（先取 N 局）
// 純邏輯、零 DOM / Canvas 依賴，可直接單元測試。
import { GAMES_TO_WIN } from '../constants';
import { otherSide, type ServeCourt, type Side } from '../types';

export interface ScoreEvents {
  pointWon: Side;
  gameWon?: Side;
  matchWon?: Side;
}

const POINT_NAMES = ['0', '15', '30', '40'];

export class Score {
  points: Record<Side, number> = { near: 0, far: 0 };
  games: Record<Side, number> = { near: 0, far: 0 };
  server: Side;
  finished = false;
  winner: Side | null = null;
  private pointsInGame = 0;

  constructor(firstServer: Side = 'near', readonly gamesToWin = GAMES_TO_WIN) {
    this.server = firstServer;
  }

  /** 發球區每分輪換：本局第偶數分自 Deuce side 發 */
  get serveCourt(): ServeCourt {
    return this.pointsInGame % 2 === 0 ? 'deuce' : 'ad';
  }

  pointWon(winner: Side): ScoreEvents {
    const ev: ScoreEvents = { pointWon: winner };
    if (this.finished) return ev;

    this.points[winner]++;
    this.pointsInGame++;

    const loser = otherSide(winner);
    if (this.points[winner] >= 4 && this.points[winner] - this.points[loser] >= 2) {
      this.games[winner]++;
      this.points = { near: 0, far: 0 };
      this.pointsInGame = 0;
      ev.gameWon = winner;
      if (this.games[winner] >= this.gamesToWin) {
        this.finished = true;
        this.winner = winner;
        ev.matchWon = winner;
      } else {
        this.server = otherSide(this.server); // 發球權每局輪替
      }
    }
    return ev;
  }

  pointsDisplay(nearLabel = 'P1', farLabel = 'CPU'): string {
    const n = this.points.near;
    const f = this.points.far;
    if (n >= 3 && f >= 3) {
      if (n === f) return 'DEUCE';
      return `ADV ${n > f ? nearLabel : farLabel}`;
    }
    return `${POINT_NAMES[Math.min(n, 3)]} - ${POINT_NAMES[Math.min(f, 3)]}`;
  }
}
