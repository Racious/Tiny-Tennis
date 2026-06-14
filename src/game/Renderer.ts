// 透視投影 + 全部 Canvas 繪製（平滑向量風格：球場 / 球員 / 球 / 裁判椅 / UI）
// 物理皆在平面場地空間；只有這裡負責投影成梯形透視畫面。
// 邏輯座標 256×240，實際 canvas 以 RENDER_SCALE 倍解析度抗鋸齒繪製。
import {
  ALLEY_W, COLORS, COURT_D, COURT_W, CX, LOGICAL_H, LOGICAL_W, NET_Y, PX,
  S_FAR, S_NEAR, SERVICE_LINE_OFF, Y_FAR, Y_NEAR, Z_FACTOR,
} from '../constants';
import type { Player } from '../entities/Player';
import { BIND_ACTIONS, keyLabel, t } from '../settings';
import { lerp } from '../utils';
import type { Game } from './Game';
import nearLocomotionUrl from '../assets/players/near-locomotion.png';
import nearGroundstrokesUrl from '../assets/players/near-groundstrokes.png';
import nearOverheadUrl from '../assets/players/near-overhead.png';
import farCoreUrl from '../assets/players/far-core.png';
import farExtraUrl from '../assets/players/far-extra.png';
import umpireUrl from '../assets/umpire.png';

interface Projected {
  sx: number;
  sy: number;
  scale: number;
}

type Pose = 'idle' | 'run' | 'swing' | 'overhead';
type SpriteSheet = 'nearLocomotion' | 'nearGroundstrokes' | 'nearOverhead' | 'farCore' | 'farExtra';

interface SpriteAsset {
  image: HTMLImageElement;
  loaded: boolean;
}

const LINE_W = 1.6; // 界線寬（場地單位）
const SKY_H = 42;   // 上方觀眾席背景高度
// 固定人物尺寸（整格高度；素材已將「身體」正規化為固定比例，故不會忽大忽小）
const NEAR_SPRITE_H = 42; // 近端玩家固定格高（身體約佔 0.67 → 螢幕約 28px）
const FAR_SPRITE_H = 30;  // 遠端 CPU 固定格高（身體約佔 0.74 → 螢幕約 22px）
// 線審判定 → 改以裁判對話框呈現（其餘 GAME/MATCH 等仍走中央橫幅）
const LINE_CALLS = new Set(['OUT!', 'NET!', 'FAULT!', 'NET! FAULT!', 'DOUBLE FAULT!', 'TWO BOUNCES!']);

export class Renderer {
  private sprites: Record<SpriteSheet, SpriteAsset>;
  private umpire: SpriteAsset;

  constructor(private ctx: CanvasRenderingContext2D) {
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';
    this.sprites = {
      nearLocomotion: this.loadSprite(nearLocomotionUrl),
      nearGroundstrokes: this.loadSprite(nearGroundstrokesUrl),
      nearOverhead: this.loadSprite(nearOverheadUrl),
      farCore: this.loadSprite(farCoreUrl),
      farExtra: this.loadSprite(farExtraUrl),
    };
    this.umpire = this.loadSprite(umpireUrl);
  }

  private loadSprite(url: string): SpriteAsset {
    const asset: SpriteAsset = { image: new Image(), loaded: false };
    asset.image.onload = () => { asset.loaded = true; };
    asset.image.src = url;
    return asset;
  }

  private project(x: number, y: number): Projected {
    const t = y / COURT_D;
    const scale = lerp(S_FAR, S_NEAR, t);
    return {
      sx: CX + (x - COURT_W / 2) * scale * PX,
      sy: lerp(Y_FAR, Y_NEAR, t),
      scale,
    };
  }

  render(game: Game): void {
    const c = this.ctx;
    c.fillStyle = COLORS.apron;
    c.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    this.drawCrowd();

    if (game.phase === 'title') {
      this.drawScene(game, false);
      this.drawTitle(game);
      return;
    }
    // 逐盤板畫在球員之前（背景層）→ 即使重疊也是球員蓋過它，不會擋到球員
    if (game.score.mode === 'normal') this.drawSetBoard(game);
    this.drawScene(game, true);
    this.drawScoreboard(game);
    if (game.motionLab) this.drawMotionLab(game);

    if (game.phase === 'serve') this.drawServeHint(game);
    // 線審判定走裁判對話框；其餘大事件走中央橫幅
    if (game.phase === 'pointEnd' && game.currentBanner) {
      if (LINE_CALLS.has(game.currentBanner)) this.drawUmpireBubble(game.currentBanner);
      else this.drawBanner(game.currentBanner);
    }
    // 對打中的即時 IN! 播報
    if (game.umpireCall && (game.phase === 'rally' || game.phase === 'serve')) {
      this.drawUmpireBubble(game.umpireCall);
    }
    if (game.phase === 'pause') {
      this.overlay(0.5);
      this.drawBanner(t(game.settings.lang, 'pause'));
    }
    if (game.phase === 'gameOver') this.drawGameOver(game);
  }

  /** 上方藍色觀眾席牆＋重複圖樣＋橫幅 */
  private drawCrowd(): void {
    const c = this.ctx;
    c.fillStyle = COLORS.crowd;
    c.fillRect(0, 0, LOGICAL_W, SKY_H);
    // 重複觀眾圖樣（暗藍底紋 + 亮藍頭點）
    for (let y = 3; y < SKY_H - 4; y += 7) {
      for (let x = (y % 14 === 3 ? 4 : 10); x < LOGICAL_W; x += 12) {
        c.fillStyle = COLORS.crowdDark;
        c.fillRect(x, y, 7, 4);
        c.fillStyle = COLORS.crowdLite;
        c.fillRect(x + 1, y, 2, 2);
        c.fillRect(x + 4, y, 2, 2);
      }
    }
    // 中央橫幅看板
    c.fillStyle = COLORS.bannerBg;
    this.rrect(CX - 40, 2, 80, 12, 2);
    c.fill();
    this.text('A M A G I', CX, 8.5, COLORS.line, '700 8px Verdana, sans-serif');
    // 底緣壓邊
    c.fillStyle = COLORS.apronDark;
    c.fillRect(0, SKY_H - 2, LOGICAL_W, 2);
  }

  // ── 場景 ─────────────────────────────────────────
  private drawScene(game: Game, withBall: boolean): void {
    this.drawCourt();
    this.drawChair(game);
    this.drawPlayer(game, game.players.far);
    const showBall = withBall && !(game.phase === 'serve' && game.serveState === 'ready');
    const ballFar = game.ball.pos.y < NET_Y;
    if (showBall && ballFar) this.drawBall(game);
    this.drawNet();
    this.drawPlayer(game, game.players.near);
    if (showBall && !ballFar) this.drawBall(game);
  }

  /** 在場地空間中畫軸對齊矩形（投影為梯形） */
  private quad(x1: number, y1: number, x2: number, y2: number, color: string): void {
    const c = this.ctx;
    const a = this.project(x1, y1);
    const b = this.project(x2, y1);
    const d = this.project(x2, y2);
    const e = this.project(x1, y2);
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(a.sx, a.sy);
    c.lineTo(b.sx, b.sy);
    c.lineTo(d.sx, d.sy);
    c.lineTo(e.sx, e.sy);
    c.closePath();
    c.fill();
  }

  private drawCourt(): void {
    const L = COLORS.line;
    const A = ALLEY_W; // 雙打巷（視覺）
    this.quad(-A, 0, COURT_W + A, COURT_D, COLORS.court);
    // 底線（跨雙打全寬）
    this.quad(-A, 0, COURT_W + A, LINE_W, L);
    this.quad(-A, COURT_D - LINE_W, COURT_W + A, COURT_D, L);
    // 雙打邊線
    this.quad(-A, 0, -A + LINE_W, COURT_D, L);
    this.quad(COURT_W + A - LINE_W, 0, COURT_W + A, COURT_D, L);
    // 單打邊線（判定線）
    this.quad(0, 0, LINE_W, COURT_D, L);
    this.quad(COURT_W - LINE_W, 0, COURT_W, COURT_D, L);
    // 發球線（單打寬）
    const sf = NET_Y - SERVICE_LINE_OFF;
    const sn = NET_Y + SERVICE_LINE_OFF;
    this.quad(0, sf - LINE_W / 2, COURT_W, sf + LINE_W / 2, L);
    this.quad(0, sn - LINE_W / 2, COURT_W, sn + LINE_W / 2, L);
    // 中央發球線與底線中點記號
    const cx = COURT_W / 2;
    this.quad(cx - LINE_W / 2, sf, cx + LINE_W / 2, sn, L);
    this.quad(cx - LINE_W / 2, 0, cx + LINE_W / 2, 3, L);
    this.quad(cx - LINE_W / 2, COURT_D - 3, cx + LINE_W / 2, COURT_D, L);
  }

  private drawNet(): void {
    const c = this.ctx;
    const left = this.project(-ALLEY_W - 4, NET_Y);
    const right = this.project(COURT_W + ALLEY_W + 4, NET_Y);
    const h = 11 * left.scale * Z_FACTOR;
    const x0 = left.sx;
    const x1 = right.sx;
    const y = left.sy;
    const top = y - h + 2.5;
    // 黑色網格（可透視，球場從網眼透出）
    c.strokeStyle = COLORS.netMesh;
    c.lineWidth = 0.4;
    for (let x = x0 + 1.6; x < x1; x += 2.4) {
      c.beginPath();
      c.moveTo(x, top);
      c.lineTo(x, y);
      c.stroke();
    }
    for (let yy = top; yy <= y; yy += 2.4) {
      c.beginPath();
      c.moveTo(x0, yy);
      c.lineTo(x1, yy);
      c.stroke();
    }
    // 白色網帶
    c.fillStyle = COLORS.netTape;
    c.fillRect(x0, y - h, x1 - x0, 2.5);
    // 白色網柱
    c.fillStyle = COLORS.netPost;
    this.rrect(x0 - 1.5, y - h - 2, 3, h + 3, 1);
    c.fill();
    this.rrect(x1 - 1.5, y - h - 2, 3, h + 3, 1);
    c.fill();
  }

  /** 裁判席座標（chair 與對話框共用）：對齊網線、右側網柱外的 apron */
  private chairBase(): Projected {
    return this.project(COURT_W + ALLEY_W + 12, NET_Y);
  }

  /** 裁判椅（網柱右側高台）：用真人 sprite，頭依球的位置朝向 */
  private drawChair(game: Game): void {
    const base = this.chairBase();
    const x = base.sx;
    const y = base.sy;

    if (this.umpire.loaded) {
      // 頭部朝向：近端→面向鏡頭(0)、中段→側面(1)、遠端→背向(2)
      const b = game.ball;
      let frame = 1;
      if (b.active) {
        // 對打中追球的深度
        if (b.pos.y > NET_Y + 26) frame = 0;
        else if (b.pos.y < NET_Y - 26) frame = 2;
      } else if (game.phase === 'serve') {
        // 發球（球未擊出）時看向發球方
        frame = game.score.server === 'near' ? 0 : 2;
      }
      const img = this.umpire.image;
      const fw = img.naturalWidth / 3;
      const fh = img.naturalHeight;
      const h = 38;                  // 裁判席螢幕高度（網前景深，略小於近端球員）
      const w = h * (fw / fh);
      this.ctx.drawImage(img, frame * fw, 0, fw, fh, x - w / 2, y - h, w, h);
      return;
    }

    // 後備：未載入時畫簡單向量椅
    const c = this.ctx;
    const h = 40;
    c.strokeStyle = COLORS.chairWood;
    c.lineWidth = 1.4;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(x - 6, y); c.lineTo(x - 3.5, y - h + 14);
    c.moveTo(x + 6, y); c.lineTo(x + 3.5, y - h + 14);
    c.moveTo(x - 5.2, y - 6); c.lineTo(x + 5.2, y - 6);
    c.moveTo(x - 4.4, y - 16); c.lineTo(x + 4.4, y - 16);
    c.stroke();
    c.fillStyle = COLORS.chairSeat;
    this.rrect(x - 6, y - h + 11, 12, 4, 1.5); c.fill();
    this.rrect(x - 6, y - h - 1, 2.5, 13, 1.2); c.fill();
    c.fillStyle = '#f4f4f4';
    this.rrect(x - 3, y - h + 2, 6, 7, 2); c.fill();
    c.fillStyle = COLORS.skin;
    c.beginPath(); c.arc(x, y - h - 1, 2.4, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#d82800';
    c.fillRect(x - 2.6, y - h - 2.6, 5.2, 1.6);
  }

  // ── 球員（向量角色）─────────────────────────────
  private pickPose(pl: Player): Pose {
    if (pl.action === 'toss' || pl.action === 'serve' || pl.action === 'smash') return 'overhead';
    if (pl.action === 'forehand' || pl.action === 'backhand') return 'swing';
    if (pl.moving) return 'run';
    return 'idle';
  }

  private drawPlayer(game: Game, pl: Player): void {
    const proj = this.project(pl.pos.x, pl.pos.y);
    const far = pl.side === 'far';
    const pose = this.pickPose(pl);
    const serveReady = game.phase === 'serve'
      && game.serveState === 'ready'
      && game.score.server === pl.side;
    // 近端正反手有各自的完整動畫列；待機與移動才依方向鏡像。
    let mirror = false;
    if (serveReady) mirror = false;
    else if (pose === 'swing' && far) mirror = pl.action === 'backhand';
    else if (pose === 'idle' || pose === 'run') mirror = pl.facingX < 0;
    const shirt = far ? COLORS.aiBody : COLORS.playerBody;
    // 固定尺寸（不隨位置變大小）
    if (!this.drawSpritePlayer(proj.sx, proj.sy, far, mirror, pl, serveReady)) {
      const u = far ? 0.7 : 1.0;
      this.drawChar(proj.sx, proj.sy, u, shirt, far, pose, mirror, pl, game.contactPoint);
    }
  }

  private spriteFrame(
    pl: Player, serveReady = false,
  ): { sheet: SpriteSheet; row: number; frame: number } {
    if (pl.side === 'far') {
      if (pl.action === 'toss') {
        return { sheet: 'farExtra', row: 1, frame: 0 };
      }
      if (pl.action === 'serve' || pl.action === 'smash') {
        return { sheet: 'farExtra', row: 1, frame: Math.min(3, Math.floor(pl.actionProgress * 4)) };
      }
      if (pl.action === 'forehand' || pl.action === 'backhand') {
        // 正反手共用同一抽球作畫；反手由 drawPlayer 鏡像翻轉
        return { sheet: 'farCore', row: 1, frame: Math.min(3, Math.floor(pl.actionProgress * 4)) };
      }
      return {
        sheet: 'farCore',
        row: 0,
        frame: pl.moving ? Math.floor(pl.walkPhase * 10) % 4 : 0,
      };
    }
    if (serveReady) {
      // 持球準備：第一格內含手上的球，可沿底線左右調整站位。
      return { sheet: 'nearOverhead', row: 0, frame: 0 };
    }
    if (pl.action === 'toss') {
      // 持球格之後依序播放拋球、獎盃姿勢與球拍下沉蓄力（第 2～4 格）。
      return {
        sheet: 'nearOverhead',
        row: 0,
        frame: 1 + Math.min(2, Math.floor(pl.actionProgress * 3)),
      };
    }
    if (pl.action === 'serve' || pl.action === 'smash') {
      return { sheet: 'nearOverhead', row: 1, frame: Math.min(3, Math.floor(pl.actionProgress * 4)) };
    }
    if (pl.action === 'forehand' || pl.action === 'backhand') {
      return {
        sheet: 'nearGroundstrokes',
        row: pl.action === 'backhand' ? 1 : 0,
        frame: Math.min(3, Math.floor(pl.actionProgress * 4)),
      };
    }
    if (pl.moving || pl.action === 'run') {
      return { sheet: 'nearLocomotion', row: 1, frame: Math.floor(pl.walkPhase * 10) % 4 };
    }
    return { sheet: 'nearLocomotion', row: 0, frame: 0 }; // 待機定格穩定準備姿勢
  }

  private drawSpritePlayer(
    sx: number, sy: number, far: boolean, mirror: boolean, pl: Player, serveReady = false,
  ): boolean {
    const selection = this.spriteFrame(pl, serveReady);
    const asset = this.sprites[selection.sheet];
    if (!asset.loaded) return false;
    const source: CanvasImageSource = asset.image;
    const sw = asset.image.naturalWidth / 4;
    const sh = asset.image.naturalHeight / 2;
    // 固定高度，不隨位置景深縮放
    const height = far ? FAR_SPRITE_H : NEAR_SPRITE_H;
    const width = height * (sw / sh);

    const c = this.ctx;
    c.save();
    c.translate(sx, sy);
    // 近、遠端使用各自視角素材；只為左右持拍側做水平鏡像。
    if (mirror) c.scale(-1, 1);
    c.drawImage(
      source,
      selection.frame * sw,
      selection.row * sh,
      sw,
      sh,
      -width / 2,
      -height,
      width,
      height,
    );
    c.restore();
    return true;
  }

  /** 兩節式肢體（手肘 / 膝蓋在中點側偏） */
  private limb(
    u: number, x1: number, y1: number, x2: number, y2: number,
    bend: number, width: number, color: string,
  ): void {
    const c = this.ctx;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const ex = (x1 + x2) / 2 - (dy / len) * bend;
    const ey = (y1 + y2) / 2 + (dx / len) * bend;
    c.strokeStyle = color;
    c.lineWidth = width * u;
    c.beginPath();
    c.moveTo(x1 * u, y1 * u);
    c.lineTo(ex * u, ey * u);
    c.lineTo(x2 * u, y2 * u);
    c.stroke();
  }

  private drawChar(
    cxp: number, cyp: number, u: number, shirt: string,
    front: boolean, pose: Pose, mirror: boolean, pl: Player, contactPoint: number,
  ): void {
    const c = this.ctx;
    c.save();
    c.translate(cxp, cyp);
    if (mirror) c.scale(-1, 1);
    c.lineCap = 'round';
    c.lineJoin = 'round';

    type P = { x: number; y: number };
    const qbez = (a: P, b: P, d: P, t: number): P => {
      const v = 1 - t;
      return {
        x: v * v * a.x + 2 * v * t * b.x + t * t * d.x,
        y: v * v * a.y + 2 * v * t * b.y + t * t * d.y,
      };
    };
    const mix = (a: P, b: P, t: number): P => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });

    // 將可調觸球點映射到曲線中段：前段蓄力、觸球瞬間加速、後段完整收拍。
    const rawQ = pl.actionProgress;
    const q = rawQ <= contactPoint
      ? (rawQ / contactPoint) * 0.5
      : 0.5 + ((rawQ - contactPoint) / (1 - contactPoint)) * 0.5;
    const qe = q < 0.5
      ? 2 * q * q
      : 1 - Math.pow(-2 * q + 2, 3) / 2;
    const ph = Math.sin(pl.walkPhase * 11);

    // ── 姿勢參數（座標單位 u；「持拍側在 +x」，鏡像由外層處理）──
    let crouch = 0;          // 屈膝下沉量（+ 為蹲低）
    let lean = 0;            // 轉體（軀幹+頭繞髖旋轉）
    let footL: P = { x: -3.6, y: -1.5 };
    let footR: P = { x: 3.6, y: -1.5 };
    let legBendL = 0.9;
    let legBendR = -0.9;
    let handL: P = { x: -7.5, y: -14 };
    let handR: P = { x: 7.5, y: -13.5 };
    let bendL = 1.6;
    let bendR = -1.6;
    let swingPath: [P, P, P] | null = null; // 揮拍貝茲路徑（拍風殘影用）
    let racketRoot: P = { x: 5.5, y: -22 }; // 拍向 = 自此點的徑向

    switch (pose) {
      case 'idle':
        // 網球準備姿勢：屈膝、雙手持拍於身前
        crouch = 1.2;
        footL = { x: -4.4, y: -1.5 };
        footR = { x: 4.4, y: -1.5 };
        handR = { x: 2.2, y: -15.5 };
        handL = { x: -2, y: -15 };
        bendL = 2;
        bendR = -2;
        racketRoot = { x: 0, y: -22 };
        break;
      case 'run':
        crouch = 0.8;
        lean = ph * 0.04;
        footL = { x: -3.4 - ph * 4.2, y: -1.5 };
        footR = { x: 3.4 + ph * 4.2, y: -1.5 };
        legBendL = 1.2 + ph * 0.5;
        legBendR = -1.2 + ph * 0.5;
        handR = { x: 7 + ph * 1.8, y: -16.5 };
        handL = { x: -6.8 - ph * 1.8, y: -16.5 };
        break;
      case 'swing': {
        const backhand = pl.action === 'backhand';
        // 正手由持拍側低位向前上方抽擊；反手先轉肩，從身體反側橫掃並高位收拍。
        swingPath = backhand
          ? [{ x: -9, y: -16 }, { x: 12.5, y: -21 }, { x: 8, y: -34 }]
          : [{ x: 7, y: -12 }, { x: 16, y: -22 }, { x: -8, y: -34 }];
        handR = qbez(...swingPath, qe);
        bendR = backhand ? 1.1 - qe * 1.5 : -0.8 * (1 - qe);
        handL = backhand
          ? mix({ x: -5, y: -18 }, { x: 1, y: -17 }, qe)
          : mix({ x: 2.5, y: -17 }, { x: -9.5, y: -19.5 }, qe);
        bendL = 1.8;
        crouch = 2.2 * (1 - qe);
        lean = backhand ? -0.22 + 0.36 * qe : 0.18 - 0.38 * qe;
        footL = { x: -5.4, y: -1.5 };
        footR = { x: 6.6 - 2 * qe, y: -1.5 };
        legBendL = 1.2;
        legBendR = -1.6;
        break;
      }
      case 'overhead':
        if (pl.tossing) {
          // 拋球蓄力：屈膝、非持拍手指天、球拍背後下垂
          crouch = 1.6;
          lean = 0.06;
          handL = { x: -3.5 + qe * 1.5, y: -25 - qe * 13 };
          bendL = 0.6;
          handR = { x: 7 - qe * 2, y: -17 - qe * 5 };
          bendR = -2.2;
          footL = { x: -3.8, y: -1.5 };
          footR = { x: 4.2, y: -1.5 };
          racketRoot = { x: 1, y: -26 };
        } else {
          // 發球/殺球：背後引拍 → 頭頂最高點鞭擊（踮腳伸展）→ 身前收拍
          const smash = pl.action === 'smash';
          swingPath = smash
            ? [{ x: 7, y: -22 }, { x: 3, y: -40 }, { x: -10, y: -13 }]
            : [{ x: 7, y: -22 }, { x: 1, y: -45 }, { x: -9, y: -14 }];
          handR = qbez(...swingPath, qe);
          bendR = -0.6 * (1 - qe);
          handL = mix({ x: -4, y: -36 }, { x: -8, y: -17 }, qe);
          bendL = 1.2;
          // 擊球瞬間身體向上伸展（踮腳）
          crouch = 1.5 * (1 - qe) - 1.8 * Math.sin(Math.PI * Math.min(qe * 2, 1));
          lean = -0.05 + 0.12 * qe;
          footL = { x: -3, y: -1.5 };
          footR = { x: 3.4, y: -1.5 };
          legBendL = 0.9 * (1 - qe);
          legBendR = -0.9 * (1 - qe);
          racketRoot = { x: 2, y: -25 };
        }
        break;
    }

    const hipY = -10 + crouch;

    // 腳下陰影
    c.fillStyle = COLORS.shadow;
    c.beginPath();
    c.ellipse(0, 0, 7 * u, 2.1 * u, 0, 0, Math.PI * 2);
    c.fill();

    // 腿（兩節式＝有膝蓋）與球鞋
    const shoe = (f: P) => {
      c.fillStyle = COLORS.legs;
      c.beginPath();
      c.ellipse((f.x + 0.7) * u, (f.y + 0.4) * u, 2.6 * u, 1.4 * u, 0, 0, Math.PI * 2);
      c.fill();
    };
    this.limb(u, -2.6, hipY + 1.5, footL.x, footL.y, legBendL, 2.7, COLORS.skin);
    this.limb(u, 2.6, hipY + 1.5, footR.x, footR.y, legBendR, 2.7, COLORS.skin);
    shoe(footL);
    shoe(footR);

    // 短褲（髖部，不隨轉體）
    c.fillStyle = COLORS.shorts;
    this.rrect(-6 * u, (hipY - 3.5) * u, 12 * u, 6 * u, 2.5 * u);
    c.fill();
    c.strokeStyle = COLORS.outline;
    c.lineWidth = 0.8;
    c.stroke();

    // 軀幹 + 頭：繞髖部轉體
    const rotP = (x: number, y: number): P => {
      const dy = y - hipY;
      const cs = Math.cos(lean);
      const sn = Math.sin(lean);
      return { x: x * cs - dy * sn, y: hipY + x * sn + dy * cs };
    };
    c.save();
    c.translate(0, hipY * u);
    c.rotate(lean);
    c.translate(0, -hipY * u);
    c.fillStyle = shirt;
    this.rrect(-6.5 * u, (hipY - 13) * u, 13 * u, 13.5 * u, 3.5 * u);
    c.fill();
    c.strokeStyle = COLORS.outline;
    c.lineWidth = 0.8;
    c.stroke();
    // 頭與髮型；正面有臉
    const headY = hipY - 18;
    c.fillStyle = COLORS.skin;
    c.beginPath();
    c.arc(0, headY * u, 5.2 * u, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = COLORS.hair;
    if (front) {
      c.beginPath();
      c.arc(0, (headY - 0.5) * u, 5.3 * u, Math.PI * 1.02, Math.PI * 1.98);
      c.closePath();
      c.fill();
      c.fillStyle = '#202020';
      c.beginPath();
      c.arc(-1.9 * u, (headY + 0.6) * u, 0.7 * u, 0, Math.PI * 2);
      c.arc(1.9 * u, (headY + 0.6) * u, 0.7 * u, 0, Math.PI * 2);
      c.fill();
    } else {
      c.beginPath();
      c.arc(0, (headY - 0.6) * u, 5.2 * u, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();

    // 肩膀位置（隨轉體）
    const shL = rotP(-5.5, hipY - 12);
    const shR = rotP(5.5, hipY - 12);

    // 拍風殘影：沿實際揮拍路徑
    if (swingPath && q < 0.85) {
      c.strokeStyle = `rgba(255,255,255,${0.5 * (1 - q)})`;
      c.lineWidth = 2.4 * u;
      c.beginPath();
      const t0 = Math.max(0, qe - 0.38);
      for (let i = 0; i <= 8; i++) {
        const p = qbez(...swingPath, t0 + (qe - t0) * (i / 8));
        if (i === 0) c.moveTo(p.x * u, p.y * u);
        else c.lineTo(p.x * u, p.y * u);
      }
      c.stroke();
    }

    // 手臂（兩節式＝有手肘）
    this.limb(u, shL.x, shL.y, handL.x, handL.y, bendL, 2.4, COLORS.skin);
    this.limb(u, shR.x, shR.y, handR.x, handR.y, bendR, 2.4, COLORS.skin);

    // 球拍：自 racketRoot 的徑向延伸（揮拍時隨路徑掃動）
    const root = pose === 'swing' ? shR : racketRoot;
    const rackA = Math.atan2(handR.y - root.y, handR.x - root.x);
    this.drawRacket(u, handR, rackA);
    c.restore();
  }

  /** 裁判對話框（自右側裁判席指出，比照 FC Tennis 的 IN!/OUT!） */
  private drawUmpireBubble(text: string): void {
    const c = this.ctx;
    const base = this.chairBase();
    const headX = base.sx;
    const headTop = base.sy - 38 - 6; // 裁判頭頂之上（對齊 sprite 高度）
    c.font = '700 9px Verdana, sans-serif';
    const w = c.measureText(text).width + 10;
    const h = 13;
    let bx = headX - w + 2; // 對話框自裁判向左延伸
    if (bx < 3) bx = 3;
    const by = headTop - h;
    c.fillStyle = COLORS.line;
    this.rrect(bx, by, w, h, 3);
    c.fill();
    c.strokeStyle = '#101010';
    c.lineWidth = 0.8;
    c.stroke();
    // 指向裁判的尾巴
    c.fillStyle = COLORS.line;
    c.beginPath();
    c.moveTo(headX - 3, by + h - 1);
    c.lineTo(headX + 3, by + h + 4);
    c.lineTo(headX + 5, by + h - 1);
    c.closePath();
    c.fill();
    this.text(text, bx + w / 2, by + h / 2 + 0.5, '#101010', '700 9px Verdana, sans-serif');
  }

  private drawMotionLab(game: Game): void {
    const c = this.ctx;
    c.fillStyle = 'rgba(0,0,0,0.86)';
    this.rrect(6, 20, 112, 48, 4);
    c.fill();
    c.strokeStyle = COLORS.title;
    c.lineWidth = 0.8;
    c.stroke();
    this.text('MOTION LAB  F2', 12, 28, COLORS.title, '700 7px Verdana, sans-serif', 'left');
    this.text(`[ / ]  SPEED   ${game.motionSpeed.toFixed(1)}x`, 12, 39, COLORS.uiText, '600 6.5px Verdana, sans-serif', 'left');
    this.text(`, / .  CONTACT ${Math.round(game.contactPoint * 100)}%`, 12, 49, COLORS.uiText, '600 6.5px Verdana, sans-serif', 'left');
    this.text(`P PAUSE  O STEP  ${game.motionPaused ? 'PAUSED' : 'PLAY'}`, 12, 59, game.motionPaused ? COLORS.title : COLORS.uiDim, '600 6.5px Verdana, sans-serif', 'left');
  }

  private drawRacket(u: number, hand: { x: number; y: number }, angle: number): void {
    const c = this.ctx;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const gx = hand.x * u;
    const gy = hand.y * u;
    const hl = 5 * u; // 拍柄長
    c.strokeStyle = COLORS.racketHandle;
    c.lineWidth = 1.5 * u;
    c.beginPath();
    c.moveTo(gx, gy);
    c.lineTo(gx + dx * hl, gy + dy * hl);
    c.stroke();
    const ex = gx + dx * (hl + 4 * u);
    const ey = gy + dy * (hl + 4 * u);
    c.fillStyle = COLORS.racketHead;
    c.beginPath();
    c.ellipse(ex, ey, 3.4 * u, 4.4 * u, angle + Math.PI / 2, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = COLORS.racketRim;
    c.lineWidth = 0.9 * u;
    c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.85)';
    c.lineWidth = 0.5;
    c.beginPath();
    c.moveTo(ex - dx * 3.5 * u, ey - dy * 3.5 * u);
    c.lineTo(ex + dx * 3.5 * u, ey + dy * 3.5 * u);
    c.moveTo(ex - dy * 2.6 * u, ey + dx * 2.6 * u);
    c.lineTo(ex + dy * 2.6 * u, ey - dx * 2.6 * u);
    c.stroke();
  }

  private drawBall(game: Game): void {
    const b = game.ball;
    const { sx, sy, scale } = this.project(b.pos.x, b.pos.y);
    const c = this.ctx;
    // 快球殘影
    // 球半徑：較小的基準（貼地時小）× 高度（拋球/高吊到高處才變大）× 景深
    const ballR = (y: number, z: number) => (y < NET_Y ? 1.2 : 1.5) * (1 + Math.max(0, z) * 0.022);
    if (b.fast && b.active) {
      [0, 2].forEach((i, n) => {
        const t = b.trail[i];
        if (!t) return;
        const p = this.project(t.x, t.y);
        const ty = p.sy - t.z * p.scale * Z_FACTOR;
        c.fillStyle = n === 0 ? 'rgba(255,216,0,0.2)' : 'rgba(255,216,0,0.4)';
        c.beginPath();
        c.arc(p.sx, ty, ballR(t.y, t.z) * 0.8, 0, Math.PI * 2);
        c.fill();
      });
    }
    // 陰影固定在地面投影點；球越高陰影越小越淡
    const shFade = 1 / (1 + b.z * 0.022);
    c.fillStyle = `rgba(0,0,0,${0.4 * shFade})`;
    c.beginPath();
    c.ellipse(sx, sy, 2.0 * shFade, 0.95 * shFade, 0, 0, Math.PI * 2);
    c.fill();
    const by = sy - b.z * scale * Z_FACTOR;
    const r = ballR(b.pos.y, b.z);
    c.fillStyle = COLORS.ball;
    c.beginPath();
    c.arc(sx, by, r, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = COLORS.ballHi;
    c.beginPath();
    c.arc(sx - r * 0.3, by - r * 0.35, r * 0.4, 0, Math.PI * 2);
    c.fill();
  }

  // ── UI ───────────────────────────────────────────
  private rrect(x: number, y: number, w: number, h: number, r: number): void {
    const c = this.ctx;
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  private text(
    str: string, x: number, y: number, color = COLORS.uiText,
    font = '600 7.5px Verdana, sans-serif', align: CanvasTextAlign = 'center',
  ): void {
    const c = this.ctx;
    c.font = font;
    c.textAlign = align;
    c.textBaseline = 'middle';
    c.fillStyle = color;
    c.fillText(str, x, y);
  }

  /** 左上角比分黑框：當前這一分（含搶七）。一般模式逐盤局數另由 drawSetBoard 顯示 */
  private drawScoreboard(game: Game): void {
    const c = this.ctx;
    const s = game.score;
    const normal = s.mode === 'normal';
    const pn = ['0', '15', '30', '40'];
    const ptStr = (mine: number, theirs: number): string => {
      if (s.inTiebreak) return `${mine}`;
      if (mine >= 3 && theirs >= 3) return mine === theirs ? '40' : mine > theirs ? 'Ad' : '40';
      return pn[Math.min(mine, 3)];
    };
    const x = 6;
    const y = 5;
    const w = normal ? 52 : 66; // 一般模式只顯示 PT，較窄
    const h = 30;
    const gmX = x + 40;
    const ptX = x + w - 5;
    c.fillStyle = COLORS.uiBg;
    this.rrect(x, y, w, h, 3);
    c.fill();
    c.strokeStyle = COLORS.line;
    c.lineWidth = 0.6;
    c.stroke();

    const row = (label: string, swatch: string, games: number, point: string, serving: boolean, ry: number) => {
      c.fillStyle = swatch;
      this.rrect(x + 5, ry - 4, 6, 6, 1.5);
      c.fill();
      this.text(label, x + 14, ry - 1, COLORS.uiText, '700 7px Verdana, sans-serif', 'left');
      if (!normal) this.text(`${games}`, gmX, ry - 1, COLORS.uiDim, '600 7px Verdana, sans-serif', 'center');
      this.text(point, ptX, ry - 1, COLORS.title, '700 8.5px Verdana, sans-serif', 'right');
      if (serving) {
        c.fillStyle = COLORS.title;
        c.beginPath();
        c.arc(x + 12, ry - 7.5, 1.2, 0, Math.PI * 2);
        c.fill();
      }
    };
    const hd = '600 5.5px Verdana, sans-serif';
    if (!normal) this.text('GM', gmX, y + 6, COLORS.uiDim, hd, 'center');
    this.text(s.inTiebreak ? 'TB' : 'PT', ptX, y + 6, COLORS.uiDim, hd, 'right');
    row('CPU', COLORS.aiBody, s.games.far, ptStr(s.points.far, s.points.near), s.server === 'far', y + 16);
    row('P1', COLORS.playerBody, s.games.near, ptStr(s.points.near, s.points.far), s.server === 'near', y + 26);
  }

  /** AMAGI 橫幅下方的逐盤計分板（轉播式）：CPU/P1 × 各盤局數，精簡兩列、置中對齊 */
  private drawSetBoard(game: Game): void {
    const c = this.ctx;
    const s = game.score;
    const cols = s.setHistory.slice();
    if (!s.finished) cols.push({ near: s.games.near, far: s.games.far });
    if (cols.length === 0) cols.push({ near: 0, far: 0 });
    const n = cols.length;
    const currentIdx = s.finished ? -1 : n - 1;

    const boardW = 80;
    const bx = CX - boardW / 2;    // 置中、對齊上方 AMAGI 橫幅（已畫在球員後方，不會擋人）
    const by = 16;
    const boardH = 22;
    const cpuY = by + 7;
    const p1Y = by + 15;
    const labelArea = 30;          // 左側 CPU/P1 標籤區
    const cellsX0 = bx + labelArea;
    const cellsW = boardW - labelArea - 4;

    c.fillStyle = 'rgba(0,0,0,0.85)';
    this.rrect(bx, by, boardW, boardH, 3);
    c.fill();
    c.strokeStyle = COLORS.line;
    c.lineWidth = 0.6;
    c.stroke();

    const cellCx = (i: number) => cellsX0 + (i + 0.5) * (cellsW / n);
    const drawRow = (label: string, swatch: string, vals: number[], ry: number) => {
      c.fillStyle = swatch;
      this.rrect(bx + 5, ry - 3, 5, 5, 1.5);
      c.fill();
      this.text(label, bx + 12, ry, COLORS.uiText, '700 6.5px Verdana, sans-serif', 'left');
      vals.forEach((v, i) => {
        this.text(`${v}`, cellCx(i), ry, i === currentIdx ? COLORS.title : COLORS.uiText,
          '700 8px Verdana, sans-serif', 'center');
      });
    };
    drawRow('CPU', COLORS.aiBody, cols.map((cc) => cc.far), cpuY);
    drawRow('P1', COLORS.playerBody, cols.map((cc) => cc.near), p1Y);
  }

  private drawServeHint(game: Game): void {
    const lang = game.settings.lang;
    const second = game.faults > 0 ? t(lang, 'secondServe') : '';
    let msg: string;
    if (game.score.server === 'near') {
      msg = game.serveState === 'ready' ? second + t(lang, 'serveToss') : t(lang, 'serveHit');
    } else {
      msg = second + t(lang, 'serveCpu');
    }
    this.text(msg, CX, 50, COLORS.title);
  }

  private drawBanner(textStr: string): void {
    const c = this.ctx;
    c.font = '700 11px Verdana, sans-serif';
    const w = c.measureText(textStr).width + 22;
    const x = CX - w / 2;
    c.fillStyle = 'rgba(0,0,0,0.82)';
    this.rrect(x, 98, w, 22, 5);
    c.fill();
    c.strokeStyle = COLORS.line;
    c.lineWidth = 1;
    c.stroke();
    this.text(textStr, CX, 109.5, COLORS.title, '700 11px Verdana, sans-serif');
  }

  private overlay(alpha: number): void {
    this.ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    this.ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  }

  private blink(game: Game): boolean {
    return Math.floor(game.time * 2) % 2 === 0;
  }

  private drawTitle(game: Game): void {
    this.overlay(0.72);
    const lang = game.settings.lang;
    const tt = (k: string, a?: string | number) => t(lang, k, a);
    // 藍字白邊大標題（比照 FC Tennis）
    const c = this.ctx;
    c.font = '800 20px Verdana, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineJoin = 'round';
    c.strokeStyle = COLORS.line;
    c.lineWidth = 2.4;
    c.strokeText('AMAGI TENNIS', CX, 44);
    c.fillStyle = '#6c9bf5';
    c.fillText('AMAGI TENNIS', CX, 44);
    this.text(tt('subtitle'), CX, 62, '#9fdcb0', '600 8px Verdana, sans-serif');

    if (game.menu === 'main') this.drawMainMenu(game, tt);
    else if (game.menu === 'settings') this.drawSettingsMenu(game, tt);
    else this.drawKeyMenu(game, tt);
  }

  private drawMainMenu(game: Game, tt: (k: string, a?: string | number) => string): void {
    [tt('start'), tt('settings')].forEach((label, idx) => {
      const sel = game.menuIndex === idx;
      const text = sel ? `▶  ${label}  ◀` : label;
      this.text(text, CX, 110 + idx * 24, sel ? COLORS.title : COLORS.uiText, '700 13px Verdana, sans-serif');
    });
    this.text(tt('navMenu'), CX, 200, COLORS.uiDim, '600 8px Verdana, sans-serif');
  }

  private drawSettingsMenu(game: Game, tt: (k: string, a?: string | number) => string): void {
    const s = game.settings;
    const matchVal = s.mode === 'normal' ? tt('bestOf3') : `‹ ${tt('firstTo', s.matchGames)} ›`;
    const rows: Array<[string, string]> = [
      [tt('mode'), `‹ ${s.mode === 'normal' ? tt('modeNormal') : tt('modeSimple')} ›`],
      [tt('difficulty'), `‹ ${s.level} ›`],
      [tt('match'), matchVal],
      [tt('sound'), `‹ ${s.muted ? tt('off') : tt('on')} ›`],
      [tt('language'), `‹ ${tt('langName')} ›`],
      [tt('keyConfig'), '▸'],
      [tt('back'), ''],
    ];
    rows.forEach(([label, value], idx) => {
      const sel = game.menuIndex === idx;
      const y = 88 + idx * 16;
      const col = sel ? COLORS.title : COLORS.uiText;
      this.text((sel ? '‣ ' : '') + label, CX - 6, y, col, '600 10px Verdana, sans-serif', 'right');
      if (value) this.text(value, CX + 10, y, col, '600 9.5px Verdana, sans-serif', 'left');
    });
    this.text(tt('navSettings'), CX, 206, COLORS.uiDim, '600 7.5px Verdana, sans-serif');
  }

  private drawKeyMenu(game: Game, tt: (k: string, a?: string | number) => string): void {
    const s = game.settings;
    BIND_ACTIONS.forEach((a, idx) => {
      const sel = game.menuIndex === idx;
      const y = 84 + idx * 15;
      const col = sel ? COLORS.title : COLORS.uiText;
      const rebinding = sel && game.rebindAction === a;
      this.text((sel ? '‣ ' : '') + tt('act_' + a), CX - 6, y, col, '600 9px Verdana, sans-serif', 'right');
      this.text(rebinding ? tt('pressKey') : keyLabel(s.binds[a][0]), CX + 10, y,
        rebinding ? COLORS.title : col, '600 9px Verdana, sans-serif', 'left');
    });
    [tt('resetKeys'), tt('back')].forEach((label, k) => {
      const idx = BIND_ACTIONS.length + k;
      const sel = game.menuIndex === idx;
      this.text((sel ? '‣ ' : '') + label, CX, 84 + idx * 15, sel ? COLORS.title : COLORS.uiText,
        '600 9px Verdana, sans-serif');
    });
    this.text(game.rebindAction ? tt('pressKey') : tt('navKeys'), CX, 212, COLORS.uiDim, '600 7.5px Verdana, sans-serif');
  }

  private drawGameOver(game: Game): void {
    this.overlay(0.55);
    const lang = game.settings.lang;
    const s = game.score;
    this.text('MATCH!', CX, 80, COLORS.title, '700 17px Verdana, sans-serif');
    this.text(s.winner === 'near' ? t(lang, 'youWin') : t(lang, 'cpuWins'), CX, 108, COLORS.uiText, '700 14px Verdana, sans-serif');
    const score = s.mode === 'normal'
      ? `${t(lang, 'setCol')}  ${s.sets.near} - ${s.sets.far}`
      : `${t(lang, 'games')}  ${s.games.near} - ${s.games.far}`;
    this.text(score, CX, 132, COLORS.uiDim, '600 10px Verdana, sans-serif');
    if (this.blink(game)) {
      this.text(t(lang, 'pressEnter'), CX, 168, COLORS.title, '700 10px Verdana, sans-serif');
    }
  }
}
