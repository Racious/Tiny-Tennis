// 遊戲狀態機 + update 調度
// Title ─Enter→ Serve(拋球→揮擊) ─發球→ Rally ─得分→ PointEnd(橫幅) → Serve / GameOver
import {
  AI_LEVELS, ARC_DEEP, ARC_DROP, ARC_LOB, ARC_NORMAL, AIM_X_CENTER, AIM_X_SPREAD,
  BACKHAND_ANGLE, BACKHAND_CONTROL, BACKHAND_POWER, BALL_SPEED, BALL_SPEED_DEEP,
  BALL_SPEED_DROP, BALL_SPEED_LOB, COURT_D, COURT_W,
  DEEP_RISK, DEPTH_DEEP, DEPTH_DROP, DEPTH_LOB, DEPTH_NORMAL, DEPTH_SMASH,
  FLIGHT_MAX, FLIGHT_MIN, FOREHAND_POWER, GRAVITY_Z, JITTER_BASE, JITTER_STRETCH, MATCH_OPTIONS,
  MOVE_X_MAX, MOVE_X_MIN, NET_Y, PLAYER_SPEED, REACH, SERVE_AIM_SHIFT, SERVE_ARC_SWEET, SERVE_ARC_WEAK,
  SERVE_FLIGHT_MAX, SERVE_FLIGHT_MIN, SERVE_HAND_Z, SERVE_JITTER_SWEET,
  SERVE_JITTER_WEAK, SERVE_SPEED_SWEET, SERVE_SPEED_WEAK, SERVE_SWEET_MAX,
  SERVE_SWEET_MIN, SERVE_TOSS_V, SERVICE_LINE_OFF, SMASH_ARC, SMASH_FLIGHT_MIN,
  SERVE_BOUNCE_DECAY, SMASH_SPEED, SMASH_Z_MAX, SMASH_Z_MIN, Z_HIT_MAX, type AiDifficulty,
} from '../constants';
import { AiController } from '../entities/AiPlayer';
import { Ball } from '../entities/Ball';
import { Player } from '../entities/Player';
import {
  HitType, otherSide, type Controller, type GamePhase, type GameView,
  type Intent, type ServeCourt, type Side, type Vec2,
} from '../types';
import { BIND_ACTIONS, type BindAction, type Settings } from '../settings';
import { clamp, dist, lerp, pick, tri } from '../utils';
import type { AudioFx } from './Audio';
import { Input, KeyboardController } from './Input';
import { hitLaunch, isInHalf, isInServiceBox, startBounce, updateBall } from './Physics';
import { Score } from './Score';

interface BannerItem {
  text: string;
  time: number;
  sound?: 'point' | 'game' | 'match' | 'fault' | 'net';
}

const LABELS: Record<Side, string> = { near: 'P1', far: 'CPU' };

export class Game {
  phase: GamePhase = 'title';
  time = 0;
  // 主選單
  menu: 'main' | 'settings' | 'keyconfig' = 'main';
  menuIndex = 0;
  rebindAction: BindAction | null = null;
  score: Score;
  ball = new Ball();
  players: Record<Side, Player>;
  controllers: Record<Side, Controller>;
  banners: BannerItem[] = [];
  faults = 0;
  serveState: 'ready' | 'toss' = 'ready';
  private tossVel = 0;
  private bannerTimer = 0;
  private afterBanners: 'serve' | 'gameOver' = 'serve';
  private aiServeTimer = 0;
  private aiServeHitZ = 28;
  private resumePhase: GamePhase = 'serve';
  private aiParams: AiDifficulty = AI_LEVELS[2];
  motionLab = false;
  motionSpeed = 1;
  contactPoint = 0.46;
  motionPaused = false;
  umpireCall: string | null = null; // 裁判即時播報（IN! 等）
  private umpireCallTimer = 0;

  constructor(private input: Input, private audio: AudioFx, public settings: Settings) {
    this.audio.setMuted(settings.muted);
    this.score = new Score('near', { mode: settings.mode, gamesToWin: settings.matchGames });
    this.players = {
      near: new Player('near', PLAYER_SPEED),
      far: new Player('far', this.aiParams.speed),
    };
    this.controllers = {
      near: new KeyboardController(input, settings),
      far: new AiController(this.aiParams),
    };
  }

  get currentBanner(): string | null {
    return this.banners[0]?.text ?? null;
  }

  update(dt: number): void {
    this.time += dt;
    if (this.umpireCallTimer > 0) {
      this.umpireCallTimer -= dt;
      if (this.umpireCallTimer <= 0) this.umpireCall = null;
    }
    this.updateMotionLab();
    switch (this.phase) {
      case 'title':
        this.updateTitle();
        break;
      case 'serve':
        this.updateServe(dt);
        break;
      case 'rally':
        this.updateRally(dt);
        break;
      case 'pointEnd':
        this.updatePointEnd(dt);
        break;
      case 'pause':
        if (this.input.consumePressed('Enter')) this.phase = this.resumePhase;
        break;
      case 'gameOver':
        if (this.input.consumePressed('Enter')) {
          this.phase = 'title';
          this.menu = 'main';
          this.menuIndex = 0;
          this.audio.startTitleMusic();
        }
        break;
    }
  }

  private updateMotionLab(): void {
    if (this.input.consumePressed('F2')) this.motionLab = !this.motionLab;
    if (this.motionLab) {
      if (this.input.consumePressed('BracketLeft')) this.motionSpeed = clamp(this.motionSpeed - 0.1, 0.5, 1.8);
      if (this.input.consumePressed('BracketRight')) this.motionSpeed = clamp(this.motionSpeed + 0.1, 0.5, 1.8);
      if (this.input.consumePressed('Comma')) this.contactPoint = clamp(this.contactPoint - 0.02, 0.32, 0.62);
      if (this.input.consumePressed('Period')) this.contactPoint = clamp(this.contactPoint + 0.02, 0.32, 0.62);
      if (this.input.consumePressed('KeyP')) this.motionPaused = !this.motionPaused;
      if (this.input.consumePressed('KeyO') && this.motionPaused) {
        this.players.near.animationStep = true;
        this.players.far.animationStep = true;
      }
    }
    for (const player of Object.values(this.players)) {
      player.animationRate = this.motionSpeed;
      player.animationPaused = this.motionPaused;
    }
  }

  // ── Title ────────────────────────────────────────
  private updateTitle(): void {
    const i = this.input;

    // 重新綁定按鍵：捕捉下一個按下的鍵（Esc 取消）
    if (this.rebindAction) {
      if (i.consumePressed('Escape')) { this.rebindAction = null; return; }
      const code = i.consumeAnyPressed(['Escape', 'Enter']);
      if (code) {
        this.settings.binds[this.rebindAction] = [code];
        this.settings.save();
        this.rebindAction = null;
        this.audio.bounce();
      }
      return;
    }

    const up = i.consumePressed('ArrowUp', 'KeyW');
    const down = i.consumePressed('ArrowDown', 'KeyS');
    const left = i.consumePressed('ArrowLeft', 'KeyA');
    const right = i.consumePressed('ArrowRight', 'KeyD');
    const enter = i.consumePressed('Enter');
    const esc = i.consumePressed('Escape');
    if (up || down || left || right || enter || esc) {
      this.audio.unlock();
      this.audio.startTitleMusic();
    }

    const count = this.menuCount();
    if (up) { this.menuIndex = (this.menuIndex - 1 + count) % count; this.audio.bounce(); }
    if (down) { this.menuIndex = (this.menuIndex + 1) % count; this.audio.bounce(); }

    if (this.menu === 'main') {
      if (enter) {
        if (this.menuIndex === 0) { this.audio.stopMusic(); this.audio.game(); this.startMatch(); }
        else { this.menu = 'settings'; this.menuIndex = 0; this.audio.bounce(); }
      }
    } else if (this.menu === 'settings') {
      const dir = (right ? 1 : 0) - (left ? 1 : 0);
      if (this.menuIndex <= 4 && (dir !== 0 || enter)) this.adjustSetting(this.menuIndex, dir || 1);
      if (enter && this.menuIndex === 5) { this.menu = 'keyconfig'; this.menuIndex = 0; this.audio.bounce(); }
      if ((enter && this.menuIndex === 6) || esc) { this.menu = 'main'; this.menuIndex = 1; this.audio.bounce(); }
    } else { // keyconfig
      if (enter) {
        if (this.menuIndex < BIND_ACTIONS.length) this.rebindAction = BIND_ACTIONS[this.menuIndex];
        else if (this.menuIndex === BIND_ACTIONS.length) { this.settings.resetBinds(); this.audio.bounce(); }
        else { this.menu = 'settings'; this.menuIndex = 4; this.audio.bounce(); }
      }
      if (esc) { this.menu = 'settings'; this.menuIndex = 4; this.audio.bounce(); }
    }
  }

  menuCount(): number {
    if (this.menu === 'main') return 2;
    if (this.menu === 'settings') return 7;
    return BIND_ACTIONS.length + 2; // 各動作 + 重設 + 返回
  }

  private adjustSetting(index: number, dir: number): void {
    const s = this.settings;
    if (index === 0) {
      s.mode = s.mode === 'simple' ? 'normal' : 'simple';
    } else if (index === 1) {
      s.level = clamp(s.level + (dir >= 0 ? 1 : -1), 1, AI_LEVELS.length);
    } else if (index === 2) {
      if (s.mode === 'simple') {
        const k = MATCH_OPTIONS.indexOf(s.matchGames as typeof MATCH_OPTIONS[number]);
        s.matchGames = MATCH_OPTIONS[(k + 1) % MATCH_OPTIONS.length];
      }
    } else if (index === 3) {
      s.muted = !s.muted;
      this.audio.setMuted(s.muted);
    } else if (index === 4) {
      s.lang = s.lang === 'en' ? 'zh' : 'en';
    }
    s.save();
    this.audio.bounce();
  }

  private startMatch(): void {
    this.aiParams = AI_LEVELS[this.settings.level - 1];
    this.players.far = new Player('far', this.aiParams.speed);
    this.controllers.far = new AiController(this.aiParams);
    this.score = new Score('near', { mode: this.settings.mode, gamesToWin: this.settings.matchGames });
    this.faults = 0;
    this.banners = [];
    this.setupServe();
  }

  // ── Serve ────────────────────────────────────────
  private setupServe(): void {
    const server = this.score.server;
    const court = this.score.serveCourt;
    // Deuce side = 發球者右手側：近端為畫面右、遠端為畫面左（面向鏡頭）
    const nearX = court === 'deuce' ? 70 : 30;
    const farX = court === 'deuce' ? 30 : 70;
    if (server === 'near') {
      this.players.near.pos = { x: nearX, y: COURT_D + 6 };
      this.players.far.pos = { x: court === 'deuce' ? 25 : 75, y: 18 };
    } else {
      this.players.far.pos = { x: farX, y: -6 };
      this.players.near.pos = { x: court === 'deuce' ? 75 : 25, y: COURT_D - 18 };
    }
    this.players.near.finishToss();
    this.players.far.finishToss();
    // 球置於發球者手上（未啟動，僅供繪製）
    this.ball.active = false;
    this.ball.z = SERVE_HAND_Z;
    this.ball.bounces = 0;
    this.serveState = 'ready';
    this.aiServeTimer = 0.9 + Math.random() * 0.6;
    this.phase = 'serve';
  }

  private startToss(server: Player): void {
    this.serveState = 'toss';
    this.tossVel = SERVE_TOSS_V;
    server.startToss();
    this.audio.toss();
  }

  private updateServe(dt: number): void {
    if (this.input.consumePressed('Enter')) {
      this.resumePhase = 'serve';
      this.phase = 'pause';
      return;
    }
    const server = this.score.server;
    const receiver = otherSide(server);
    const sp = this.players[server];

    // 接球方可自由移動站位
    const rIntent = this.controllers[receiver].update(this.makeView(receiver));
    this.players[receiver].update(rIntent, dt);

    // 發球方：拋球前可沿底線自由左右站位（限正確發球半邊）；拋球後鎖定
    const sIntent = this.controllers[server].update(this.makeView(server));
    if (server === 'near' && this.serveState === 'ready') {
      sp.update({ ...sIntent, moveY: 0, hit: false }, dt, true);
      const [lo, hi] = this.score.serveCourt === 'deuce'
        ? [COURT_W / 2, MOVE_X_MAX]
        : [MOVE_X_MIN, COURT_W / 2];
      sp.pos.x = clamp(sp.pos.x, lo, hi);
      sp.pos.y = COURT_D + 6; // 維持在底線後方
    } else {
      sp.update({ ...sIntent, moveX: 0, moveY: 0, hit: false }, dt, false);
    }

    // 球跟著發球者的手
    this.ball.pos = { x: sp.pos.x + 4, y: sp.pos.y };

    // 拋球中：垂直運動，落回手上則重新持球
    if (this.serveState === 'toss') {
      this.ball.z += this.tossVel * dt;
      this.tossVel -= GRAVITY_Z * dt;
      if (this.ball.z <= SERVE_HAND_Z && this.tossVel < 0) {
        this.ball.z = SERVE_HAND_Z;
        this.serveState = 'ready';
        sp.finishToss();
      }
    }

    if (server === 'near') {
      if (sIntent.hit) {
        if (this.serveState === 'ready') this.startToss(sp);
        else this.executeServe(sIntent.aimX, sIntent.aimY);
      }
    } else {
      this.aiServeTimer -= dt;
      if (this.serveState === 'ready' && this.aiServeTimer <= 0) {
        this.startToss(sp);
        // AI 依難度決定揮擊高度：甜蜜點或失手偏低
        this.aiServeHitZ = Math.random() < this.aiParams.serveSweet
          ? SERVE_SWEET_MIN + 2 + Math.random() * (SERVE_SWEET_MAX - SERVE_SWEET_MIN - 4)
          : 16 + Math.random() * 7;
      } else if (this.serveState === 'toss' && this.tossVel < 0 && this.ball.z <= this.aiServeHitZ) {
        // CPU 隨機選角度與球性
        this.executeServe(pick([-1, 0, 1] as const), pick([-1, 0, 1] as const));
      }
    }
  }

  /**
   * 發球。aimX：←/→ 落點角度（外角/中路/內角）；aimY：↑ 平快深球、↓ 慢速高吊安全球。
   * 觸球高度 z（時機）連續決定力量、平直度與準度——打得越高越快越平越準。
   */
  private executeServe(aimX: -1 | 0 | 1, aimY: -1 | 0 | 1): void {
    const server = this.score.server;
    const court = this.score.serveCourt;
    const sp = this.players[server];
    const half = otherSide(server);
    const z = this.ball.z;

    // 時機（觸球高度）→ 0~1：手上=0、甜蜜點頂=1
    const hi = clamp((z - SERVE_HAND_Z) / (SERVE_SWEET_MAX - SERVE_HAND_Z), 0, 1);
    let speed = lerp(SERVE_SPEED_WEAK, SERVE_SPEED_SWEET, hi);
    let arc = lerp(SERVE_ARC_WEAK, SERVE_ARC_SWEET, hi);
    // ↑ 平快深球；↓ 慢速高吊安全球
    if (aimY > 0) { speed *= 1.12; arc *= 0.72; }
    else if (aimY < 0) { speed *= 0.86; arc *= 1.45; }
    // 時機越好越準（抖動越小）
    const jitter = lerp(SERVE_JITTER_WEAK, SERVE_JITTER_SWEET, hi);

    // 落點 x：←/→ 在發球區內取外角/中路/內角（瞄準本身夾在區內，抖動才有失誤風險）
    const boxCx = this.serviceBoxCenterX(half, court);
    const boxHalf = COURT_W / 4;
    let tx = clamp(boxCx + aimX * SERVE_AIM_SHIFT, boxCx - boxHalf + 3, boxCx + boxHalf - 3);
    // 落點深度：↑ 深（靠發球線）、↓ 短（靠網）、無=中段
    const d = aimY > 0 ? 0.82 : aimY < 0 ? 0.34 : 0.6; // 0=網、1=發球線
    const ty = half === 'far' ? NET_Y - SERVICE_LINE_OFF * d : NET_Y + SERVICE_LINE_OFF * d;

    const target: Vec2 = { x: tx + tri() * jitter, y: ty + tri() * jitter };
    const from = { ...sp.pos };
    const ft = clamp(dist(from, target) / speed, SERVE_FLIGHT_MIN, SERVE_FLIGHT_MAX);
    hitLaunch(this.ball, from, z, target, ft, arc, server, true);
    sp.finishToss();
    sp.swingSide = 1;
    sp.startSwing(HitType.NORMAL, 'serve');
    sp.connect();
    sp.overheadSwing = true; // 發球為過頂揮拍
    this.serveState = 'ready';
    if (hi > 0.6) this.audio.smash();
    else this.audio.hit();
    this.phase = 'rally';
  }

  private serviceBoxCenterX(targetHalf: Side, court: ServeCourt): number {
    const q = COURT_W / 4;
    if (targetHalf === 'far') return court === 'deuce' ? q : COURT_W - q;
    return court === 'deuce' ? COURT_W - q : q;
  }

  // ── Rally ────────────────────────────────────────
  private updateRally(dt: number): void {
    if (this.input.consumePressed('Enter')) {
      this.resumePhase = 'rally';
      this.phase = 'pause';
      return;
    }
    for (const side of ['near', 'far'] as Side[]) {
      const player = this.players[side];
      const intent = this.controllers[side].update(this.makeView(side));
      player.update(intent, dt);
      if (intent.hit && player.canSwing) {
        const ballRight = this.ball.pos.x >= player.pos.x;
        const forehand = side === 'near' ? ballRight : !ballRight;
        const smash = this.ball.z >= SMASH_Z_MIN && this.ball.z <= SMASH_Z_MAX;
        player.swingSide = ballRight ? 1 : -1;
        player.startSwing(intent.hitType, smash ? 'smash' : forehand ? 'forehand' : 'backhand');
        if (side === 'near') this.audio.whiff(); // 揮拍嗖聲
      }
      // 揮拍有效窗口內球進入範圍即命中；方向取觸球瞬間的持鍵
      if (player.swingWindow > 0 && this.hittable(side)) {
        this.performHit(side, { ...intent, hitType: player.pendingHitType });
        player.connect();
      }
    }
    const step = updateBall(this.ball, dt);
    if (step === 'landed') this.handleLanding();
    else if (step === 'netted') this.handleNetted();
  }

  private hittable(side: Side): boolean {
    const b = this.ball;
    const p = this.players[side];
    if (!b.active || b.bounces >= 2 || b.lastHitBy === side) return false;
    if (b.isServe && b.bounces === 0) return false; // 發球須先落地，不可截擊
    const zOk = b.z <= Z_HIT_MAX || (b.z >= SMASH_Z_MIN && b.z <= SMASH_Z_MAX);
    if (!zOk) return false;
    const onMySide = side === 'near' ? b.pos.y > NET_Y - 2 : b.pos.y < NET_Y + 2;
    return onMySide && dist(b.pos, p.pos) <= REACH;
  }

  private performHit(side: Side, intent: Intent): void {
    const b = this.ball;
    const p = this.players[side];
    const stretch = clamp(dist(b.pos, p.pos) / REACH, 0, 1);
    const isSmash = b.z >= SMASH_Z_MIN;

    let speed = BALL_SPEED;
    let arc = ARC_NORMAL;
    let depth = DEPTH_NORMAL;
    let risk = 1;
    let ftMin = FLIGHT_MIN;
    if (isSmash) {
      // 高球扣殺：快、平、狠
      speed = SMASH_SPEED;
      arc = SMASH_ARC;
      depth = DEPTH_SMASH;
      risk = 0.9;
      ftMin = SMASH_FLIGHT_MIN;
    } else if (intent.hitType === HitType.LOB) {
      speed = BALL_SPEED_LOB;
      arc = ARC_LOB;
      depth = DEPTH_LOB;
    } else if (intent.aimY > 0) {
      speed = BALL_SPEED_DEEP;
      arc = ARC_DEEP;
      depth = DEPTH_DEEP;
      risk = DEEP_RISK;
    } else if (intent.aimY < 0) {
      speed = BALL_SPEED_DROP;
      arc = ARC_DROP;
      depth = DEPTH_DROP;
    }
    if (side === 'far') speed *= this.aiParams.power;

    // 正手 / 反手：依觸球在持拍側或反側自動判定
    // 近端球員右手持拍（畫面右側為正手）；遠端面向鏡頭，其右手在畫面左側
    const ballRight = b.pos.x >= p.pos.x;
    const forehand = side === 'near' ? ballRight : !ballRight;
    let xSpread = AIM_X_SPREAD;
    let control = 1;
    if (!isSmash) {
      if (forehand) {
        speed *= FOREHAND_POWER;  // 正手：力量
      } else {
        speed *= BACKHAND_POWER;  // 反手：角度與控球
        xSpread *= BACKHAND_ANGLE;
        control = BACKHAND_CONTROL;
      }
    }

    const half = otherSide(side);
    const extra = side === 'far' ? this.aiParams.aimJitter : 0;
    const sigma = (JITTER_BASE + JITTER_STRETCH * stretch * stretch + extra) * risk * control;
    const target: Vec2 = {
      x: AIM_X_CENTER + intent.aimX * xSpread + tri() * sigma,
      y: (half === 'far' ? depth : COURT_D - depth) + tri() * sigma * 0.85,
    };
    const from = { ...b.pos };
    const ft = clamp(dist(from, target) / speed, ftMin, FLIGHT_MAX);
    p.swingSide = ballRight ? 1 : -1;
    p.overheadSwing = isSmash;
    // 觸球瞬間依球實際所在側修正正/反手動畫（按鍵預判時球可能還在另一側）
    if (!isSmash) p.action = forehand ? 'forehand' : 'backhand';
    hitLaunch(b, from, Math.max(b.z, 4), target, ft, arc, side);
    if (isSmash) this.audio.smash();
    else this.audio.hit();
  }

  private handleLanding(): void {
    const b = this.ball;
    if (b.bounces > 0) {
      // 第二次觸地：擊球方得分
      this.endPoint(b.lastHitBy!, 'TWO BOUNCES!');
      return;
    }
    if (b.isServe) {
      const server = b.lastHitBy!;
      if (isInServiceBox(b.pos, otherSide(server), this.score.serveCourt)) {
        startBounce(b, SERVE_BOUNCE_DECAY); // 發球彈跳後保留較多速度
        b.isServe = false;
        this.callIn();
        this.audio.bounce();
      } else {
        this.handleFault();
      }
      return;
    }
    const hitter = b.lastHitBy!;
    if (isInHalf(b.pos, otherSide(hitter))) {
      startBounce(b);
      this.callIn();
      this.audio.bounce();
    } else {
      this.endPoint(otherSide(hitter), 'OUT!');
    }
  }

  /** 裁判即時喊 IN!（界內落地） */
  private callIn(): void {
    this.umpireCall = 'IN!';
    this.umpireCallTimer = 0.7;
  }

  private handleNetted(): void {
    const b = this.ball;
    if (b.isServe) {
      this.handleFault(true);
      return;
    }
    this.endPoint(otherSide(b.lastHitBy!), 'NET!');
  }

  private handleFault(netted = false): void {
    const server = this.ball.lastHitBy!;
    this.faults++;
    this.ball.active = false;
    if (this.faults >= 2) {
      this.endPoint(otherSide(server), 'DOUBLE FAULT!');
    } else {
      this.queueBanners(
        [{ text: netted ? 'NET! FAULT!' : 'FAULT!', time: 0.9, sound: netted ? 'net' : 'fault' }],
        'serve',
      );
    }
  }

  // ── PointEnd / 橫幅佇列 ──────────────────────────
  private endPoint(winner: Side, text: string): void {
    this.faults = 0;
    this.ball.active = false;
    this.umpireCall = null; // 點數結束清除即時播報，改由橫幅/對話框呈現
    const ev = this.score.pointWon(winner);
    const queue: BannerItem[] = [{ text, time: 1.1, sound: text === 'NET!' ? 'net' : 'point' }];
    if (ev.gameWon && !ev.setWon && !ev.matchWon) {
      queue.push({ text: `GAME ${LABELS[ev.gameWon]}`, time: 1.4, sound: 'game' });
    }
    if (ev.setWon && !ev.matchWon) {
      queue.push({ text: `SET ${LABELS[ev.setWon]}`, time: 1.5, sound: 'game' });
    }
    if (ev.matchWon) {
      queue.push({ text: 'MATCH!', time: 1.6, sound: 'match' });
    }
    this.queueBanners(queue, ev.matchWon ? 'gameOver' : 'serve');
  }

  private queueBanners(queue: BannerItem[], after: 'serve' | 'gameOver'): void {
    this.banners = queue;
    this.afterBanners = after;
    this.bannerTimer = queue[0].time;
    this.playBannerSound(queue[0]);
    this.phase = 'pointEnd';
  }

  private playBannerSound(item: BannerItem): void {
    if (item.sound) this.audio[item.sound]();
  }

  private updatePointEnd(dt: number): void {
    this.bannerTimer -= dt;
    if (this.bannerTimer > 0) return;
    this.banners.shift();
    if (this.banners.length > 0) {
      this.bannerTimer = this.banners[0].time;
      this.playBannerSound(this.banners[0]);
      return;
    }
    if (this.afterBanners === 'serve') this.setupServe();
    else this.phase = 'gameOver';
  }

  // ── View ─────────────────────────────────────────
  private makeView(side: Side): GameView {
    const b = this.ball;
    return {
      phase: this.phase,
      mySide: side,
      mePos: { ...this.players[side].pos },
      oppPos: { ...this.players[otherSide(side)].pos },
      ball: {
        active: b.active,
        pos: { ...b.pos },
        z: b.z,
        target: { ...b.target },
        lastHitBy: b.lastHitBy,
        bounces: b.bounces,
        launchId: b.launchId,
        isServe: b.isServe,
      },
      canHit: this.hittable(side),
    };
  }
}
