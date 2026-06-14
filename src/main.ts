// 進入點：建 canvas context、組裝模組、啟動固定時間步主迴圈
import { FIXED_DT, LOGICAL_H, LOGICAL_W, RENDER_SCALE } from './constants';
import { AudioFx } from './game/Audio';
import { Game } from './game/Game';
import { Input } from './game/Input';
import { Renderer } from './game/Renderer';
import { Settings } from './settings';

const canvas = document.querySelector<HTMLCanvasElement>('#game');
if (!canvas) throw new Error('找不到 #game canvas');
// 邏輯座標 256×240、實際以 3 倍解析度平滑繪製
canvas.width = LOGICAL_W * RENDER_SCALE;
canvas.height = LOGICAL_H * RENDER_SCALE;

const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('無法建立 2D context');
ctx.scale(RENDER_SCALE, RENDER_SCALE);
ctx.imageSmoothingEnabled = true;

const input = new Input();
const audio = new AudioFx();
const settings = new Settings();
const game = new Game(input, audio, settings);
const renderer = new Renderer(ctx);

// 除錯掛勾（供開發檢視狀態，正式發布可移除）
(window as unknown as { __game: Game }).__game = game;

// 固定時間步（60 FPS accumulator）：不同螢幕更新率下手感一致
let last = performance.now();
let acc = 0;

function frame(now: number): void {
  acc += Math.min((now - last) / 1000, 0.25); // 分頁切回時避免爆量補幀
  last = now;
  while (acc >= FIXED_DT) {
    game.update(FIXED_DT);
    // 在固定步之後才清除按鍵邊緣狀態：高更新率螢幕下
    // 某些影格不含任何固定步，過早清除會丟失按鍵輸入
    input.endFrame();
    acc -= FIXED_DT;
  }
  renderer.render(game);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
