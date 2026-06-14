// 球員實體：位置、移動範圍限制、揮拍與動畫狀態
import {
  COURT_D, FAR_Y_MAX, FAR_Y_MIN, HIT_COOLDOWN, MOVE_X_MAX, MOVE_X_MIN,
  NEAR_Y_MAX, NEAR_Y_MIN, SWING_TIME, SWING_WINDOW, WHIFF_COOLDOWN, COURT_W,
} from '../constants';
import { HitType, type Intent, type Side, type Vec2 } from '../types';
import { clamp } from '../utils';

export class Player {
  pos: Vec2;
  swingTimer = 0;
  swingWindow = 0;       // 揮拍有效窗口：>0 期間球進入範圍即命中
  cooldown = 0;
  pendingHitType = HitType.NORMAL; // 揮拍當下記住的球種（K 為邊緣觸發）
  // 動畫狀態
  moving = false;
  facingX: -1 | 1 = 1;
  walkPhase = 0;
  swingSide: 1 | -1 = 1;  // 正手 / 反手（球拍畫在哪一側）
  tossing = false;        // 發球拋球姿勢
  overheadSwing = false;  // 過頂揮拍（發球擊出 / 殺球）
  action: 'idle' | 'run' | 'toss' | 'serve' | 'forehand' | 'backhand' | 'smash' = 'idle';
  actionTime = 0;
  actionDuration = 0.55;
  animationRate = 1;
  animationPaused = false;
  animationStep = false;

  constructor(readonly side: Side, public speed: number) {
    this.pos = side === 'near'
      ? { x: COURT_W / 2, y: COURT_D - 30 }
      : { x: COURT_W / 2, y: 30 };
  }

  get canSwing(): boolean {
    return this.cooldown <= 0;
  }

  update(intent: Intent, dt: number, allowMove = true): void {
    const animationDt = this.animationPaused && !this.animationStep ? 0 : dt * this.animationRate;
    this.animationStep = false;
    this.actionTime = Math.min(this.actionDuration, this.actionTime + animationDt);
    this.swingTimer = Math.max(0, this.swingTimer - dt);
    this.swingWindow = Math.max(0, this.swingWindow - dt);
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (!allowMove) {
      this.moving = false;
      return;
    }

    let { moveX, moveY } = intent;
    // 發球揮拍（含拋球）期間不可位移——已起跳發球動作就站定
    if (this.action === 'serve' || this.tossing) {
      moveX = 0;
      moveY = 0;
    }
    this.moving = moveX !== 0 || moveY !== 0;
    if (moveX < 0) this.facingX = -1;
    else if (moveX > 0) this.facingX = 1;
    if (this.moving) this.walkPhase += dt;
    if (this.swingTimer <= 0 && !this.tossing && this.actionTime >= this.actionDuration) {
      this.action = this.moving ? 'run' : 'idle';
      this.actionTime = 0;
      this.actionDuration = 1;
    } else if (this.swingTimer <= 0 && !this.tossing && this.moving && this.action === 'idle') {
      this.action = 'run';
    }
    if (moveX !== 0 && moveY !== 0) {
      moveX *= Math.SQRT1_2;
      moveY *= Math.SQRT1_2;
    }
    this.pos.x = clamp(this.pos.x + moveX * this.speed * dt, MOVE_X_MIN, MOVE_X_MAX);
    const yMin = this.side === 'near' ? NEAR_Y_MIN : FAR_Y_MIN;
    const yMax = this.side === 'near' ? NEAR_Y_MAX : FAR_Y_MAX;
    this.pos.y = clamp(this.pos.y + moveY * this.speed * dt, yMin, yMax);
  }

  /** 開始揮拍：先視為揮空（短冷卻），窗口內觸球再升級為命中 */
  startSwing(
    hitType: HitType,
    action: 'serve' | 'forehand' | 'backhand' | 'smash' = 'forehand',
  ): void {
    this.swingTimer = SWING_TIME;
    this.swingWindow = SWING_WINDOW;
    this.cooldown = WHIFF_COOLDOWN;
    this.pendingHitType = hitType;
    this.overheadSwing = false;
    this.action = action;
    this.actionTime = 0;
    this.actionDuration = action === 'serve' ? 0.72 : action === 'smash' ? 0.58 : 0.52;
  }

  startToss(): void {
    this.tossing = true;
    this.action = 'toss';
    this.actionTime = 0;
    this.actionDuration = 0.82;
  }

  finishToss(): void {
    this.tossing = false;
    this.action = 'idle';
    this.actionTime = 0;
    this.actionDuration = 1;
  }

  get actionProgress(): number {
    return this.actionDuration > 0 ? Math.min(1, this.actionTime / this.actionDuration) : 1;
  }

  /** 窗口內成功觸球 */
  connect(): void {
    this.swingWindow = 0;
    this.cooldown = HIT_COOLDOWN;
  }
}
