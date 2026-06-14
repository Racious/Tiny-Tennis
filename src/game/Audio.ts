// WebAudio 方波合成音效 + NES 風標題音樂（免音檔素材）
const N = {
  C3: 130.81, E3: 164.81, F3: 174.61, G3: 196, A3: 220, C4: 261.63, G4: 392,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880, C6: 1046.5,
};
const R = 0; // 休止符

const EIGHTH = 0.21;
// 原創 NES 風小調式旋律（避免使用任天堂原曲）
const MELODY: number[] = [
  N.E5, N.G5, N.A5, R,    N.G5, N.E5, N.C5, R,
  N.D5, N.E5, N.F5, N.D5, N.E5, R,    N.C5, R,
  N.E5, N.G5, N.A5, R,    N.C6, R,    N.A5, N.G5,
  N.E5, N.D5, N.C5, N.D5, N.E5, R,    R,    R,
];
const BASS: number[] = [ // 四分音符
  N.C3, N.G3, N.A3, N.E3, N.F3, N.C3, N.G3, N.G3,
  N.C3, N.G3, N.A3, N.E3, N.F3, N.G3, N.C4, R,
];
const TUNE_LEN = MELODY.length * EIGHTH;

export class AudioFx {
  muted = false;
  private ctx: AudioContext | null = null;
  private musicHandle: number | null = null;
  private musicNodes: OscillatorNode[] = [];

  /** 設定靜音：靜音時停掉目前音樂 */
  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) this.stopMusic();
  }

  /** 需在使用者手勢（按鍵）後呼叫一次 */
  unlock(): void {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        this.ctx = null;
      }
    }
    void this.ctx?.resume();
  }

  private tone(
    freq: number, dur: number, delay = 0, vol = 0.12,
    type: OscillatorType = 'square', track = false,
  ): void {
    if (this.muted || !this.ctx || freq <= 0) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
    if (track) {
      this.musicNodes.push(osc);
      osc.onended = () => {
        this.musicNodes = this.musicNodes.filter((o) => o !== osc);
      };
    }
  }

  // ── 音效 ─────────────────────────────────────────
  hit(): void { this.tone(680, 0.07); }
  smash(): void { this.tone(520, 0.05); this.tone(880, 0.09, 0.04, 0.16); }
  toss(): void { this.tone(440, 0.05, 0, 0.07); }
  bounce(): void { this.tone(170, 0.05, 0, 0.09); }
  whiff(): void { this.tone(240, 0.04, 0, 0.05); }
  net(): void { this.tone(140, 0.18, 0, 0.1); this.tone(95, 0.2, 0.06, 0.08); }
  fault(): void { this.tone(110, 0.25, 0, 0.1); }
  point(): void { this.tone(523, 0.09); this.tone(660, 0.12, 0.1); }
  game(): void { this.tone(523, 0.09); this.tone(660, 0.09, 0.1); this.tone(784, 0.16, 0.2); }
  match(): void { [523, 660, 784, 1047].forEach((f, i) => this.tone(f, 0.12, i * 0.12)); }

  // ── 標題音樂 ─────────────────────────────────────
  startTitleMusic(): void {
    if (this.muted || !this.ctx || this.musicHandle !== null) return;
    const schedule = () => {
      MELODY.forEach((f, i) => this.tone(f, EIGHTH * 0.92, i * EIGHTH, 0.055, 'square', true));
      BASS.forEach((f, i) => this.tone(f, EIGHTH * 1.8, i * EIGHTH * 2, 0.09, 'triangle', true));
    };
    schedule();
    this.musicHandle = window.setInterval(schedule, TUNE_LEN * 1000);
  }

  stopMusic(): void {
    if (this.musicHandle !== null) {
      clearInterval(this.musicHandle);
      this.musicHandle = null;
    }
    this.musicNodes.forEach((o) => {
      try {
        o.stop();
      } catch {
        // 已停止的節點忽略
      }
    });
    this.musicNodes = [];
  }
}
