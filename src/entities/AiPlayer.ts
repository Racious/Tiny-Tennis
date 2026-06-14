// AI 控制器：追球（含追蹤誤差與反應延遲）+ 回球選點 + 上網戰術
import {
  AI_ATTACK_GAP_RATE, AI_HOME, AI_RUSH_HOME, COURT_W, FAR_Y_MAX, FIXED_DT,
  SERVE_RETURN_PENALTY, type AiDifficulty,
} from '../constants';
import {
  emptyIntent, HitType, type Controller, type GameView, type Intent, type Vec2,
} from '../types';
import { clamp, pick, tri } from '../utils';

const DEAD_ZONE = 2.5;

export class AiController implements Controller {
  private lastLaunchId = -1;
  private rushDecidedFor = -1;
  private rushing = false;
  private reactTimer = 0;
  private perceived: Vec2 | null = null;

  constructor(private p: AiDifficulty) {}

  update(view: GameView): Intent {
    const intent = emptyIntent();
    const b = view.ball;

    // 發球準備階段（球未啟動）：站位由 Game 指定，不亂動；重置上網狀態
    if (!b.active) {
      this.rushing = false;
      return intent;
    }

    const incoming = b.lastHitBy !== view.mySide;

    // 自己擊球後：依機率決定是否上網壓迫（每次出手判斷一次）
    if (!incoming && b.launchId !== this.rushDecidedFor) {
      this.rushDecidedFor = b.launchId;
      if (!this.rushing && Math.random() < this.p.netRush) this.rushing = true;
    }

    // 對手擊球（或球彈跳）瞬間：取得預定落點 + 追蹤誤差，並重置反應延遲
    if (incoming && b.launchId !== this.lastLaunchId) {
      this.lastLaunchId = b.launchId;
      const factor = b.bounces > 0 ? 0.5 : 1; // 彈跳後修正：誤差與延遲減半
      // 接發球反應較慢（依等級放大反應幀）→ 角落快速發球可能成 ACE
      const servePen = b.isServe && b.bounces === 0 ? SERVE_RETURN_PENALTY : 1;
      this.reactTimer = (this.p.reactFrames / 60) * factor * servePen;
      this.perceived = {
        x: b.target.x + tri() * this.p.trackErr * factor * servePen,
        y: b.target.y + tri() * this.p.trackErr * 0.5 * factor,
      };
    }

    let dest: Vec2 | null = null;
    if (incoming && this.perceived) {
      this.reactTimer -= FIXED_DT;
      if (this.reactTimer <= 0) {
        dest = { x: this.perceived.x, y: clamp(this.perceived.y - 4, -10, FAR_Y_MAX) };
      }
    } else {
      dest = this.rushing ? AI_RUSH_HOME : AI_HOME;
    }

    if (dest) {
      const dx = dest.x - view.mePos.x;
      const dy = dest.y - view.mePos.y;
      intent.moveX = Math.abs(dx) > DEAD_ZONE ? Math.sign(dx) : 0;
      intent.moveY = Math.abs(dy) > DEAD_ZONE ? Math.sign(dy) : 0;
    }

    // 可擊球時揮拍並選落點：55% 打玩家反向空檔、其餘隨機
    if (view.canHit) {
      intent.hit = true;
      intent.hitType = HitType.NORMAL;
      intent.aimX = Math.random() < AI_ATTACK_GAP_RATE
        ? (view.oppPos.x < COURT_W / 2 ? 1 : -1)
        : pick([-1, 0, 1] as const);
      const r = Math.random();
      intent.aimY = r < this.p.deepRate ? 1 : r < this.p.deepRate + this.p.dropRate ? -1 : 0;
    }
    return intent;
  }
}
