// 鍵盤輸入：held（持續）與 pressed（邊緣觸發、可被消耗）
import type { Settings } from '../settings';
import { HitType, type Controller, type Intent } from '../types';

// 預設會 preventDefault 的鍵（避免捲動等瀏覽器預設行為）
const GAME_KEYS = new Set([
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  'KeyA', 'KeyD', 'KeyW', 'KeyS',
  'Space', 'KeyJ', 'KeyK', 'Enter',
  'F2', 'BracketLeft', 'BracketRight', 'Comma', 'Period', 'KeyP', 'KeyO',
]);

export class Input {
  private held = new Set<string>();
  private pressed = new Set<string>();

  constructor(target: Window = window) {
    target.addEventListener('keydown', (e) => {
      if (GAME_KEYS.has(e.code)) e.preventDefault();
      if (!e.repeat) {
        this.held.add(e.code);
        this.pressed.add(e.code);
      }
    });
    target.addEventListener('keyup', (e) => this.held.delete(e.code));
    target.addEventListener('blur', () => this.held.clear());
  }

  isHeld(...codes: string[]): boolean {
    return codes.some((c) => this.held.has(c));
  }

  /** 邊緣觸發且只觸發一次：避免同一影格多個固定步重複處理 */
  consumePressed(...codes: string[]): boolean {
    const hit = codes.some((c) => this.pressed.has(c));
    if (hit) codes.forEach((c) => this.pressed.delete(c));
    return hit;
  }

  /** 捕捉並消耗任一按下的鍵（供按鍵重新綁定）；可排除特定鍵 */
  consumeAnyPressed(exclude: string[] = []): string | null {
    for (const code of this.pressed) {
      if (!exclude.includes(code)) {
        this.pressed.delete(code);
        return code;
      }
    }
    return null;
  }

  /** 每個固定更新步結束時呼叫 */
  endFrame(): void {
    this.pressed.clear();
  }
}

/** 玩家鍵盤控制器：方向 + 擊球意圖（按鍵綁定來自設定，可自訂） */
export class KeyboardController implements Controller {
  constructor(private input: Input, private settings: Settings) {}

  update(): Intent {
    const i = this.input;
    const b = this.settings.binds;
    const left = i.isHeld(...b.left);
    const right = i.isHeld(...b.right);
    const up = i.isHeld(...b.up);
    const down = i.isHeld(...b.down);
    const lob = i.consumePressed(...b.lob);
    const hit = i.consumePressed(...b.hit) || lob;

    return {
      moveX: (right ? 1 : 0) - (left ? 1 : 0),
      moveY: (down ? 1 : 0) - (up ? 1 : 0),
      hit,
      hitType: lob ? HitType.LOB : HitType.NORMAL,
      aimX: right ? 1 : left ? -1 : 0,
      aimY: up ? 1 : down ? -1 : 0,
    };
  }
}
