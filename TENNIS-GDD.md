# AMAGI TENNIS — 復古 2D 網球遊戲 MVP 企畫書

> 狀態：企畫完成、尚未實作。專案將建立於 `think` 之外的全新獨立目錄（名稱待定，暫以 `<project-name>` 佔位）。
> 實作開始後，本文件轉存為專案內 `docs/GDD.md`。

## 一、背景與目標

打造一款參考早期 Game Boy / NES 網球（如 Tennis GPS-1）的 2D 復古像素網球遊戲：簡單、直覺、節奏快，可單人對 AI 完成完整比賽，後續可擴充雙人本機對戰。明確排除 3D 擬真、生涯模式、連線等複雜功能，目標是先交付可玩的 MVP。

先前已用單檔 HTML 原型驗證過完整玩法（落點導向球物理、stretch 風險手感、AI 追球模型、完整網球計分），手感參數已證實可行，本次以正式模組化 TypeScript 專案重建並升級。

已確認的三項方向決策：

| 決策項 | 結論 |
|---|---|
| 球場視角 | **斜俯視透視**（NES Tennis 式梯形球場，遠小近大） |
| MVP 計分制 | **先取 3 局**（每局 0/15/30/40/Deuce/Adv） |
| 美術配色 | **NES 彩色**（綠場、白線、黃球、紅/藍球員，對比優先） |

## 二、遊戲概要

- 玩家控制**近端（下半場）**球員，AI 控制**遠端（上半場）**球員。
- 核心循環：發球 → 對打 → 得分判定（出界 / 兩次落地）→ 得分橫幅 → 重置下一分 → 局 → 場。
- 一場 = 先取 3 局者勝；發球權每局輪替、每分輪換發球區（Deuce / Ad side）。

## 三、技術選型

- **Vite + TypeScript + HTML Canvas 2D**，零遊戲框架依賴。
- 邏輯解析度 **256×240**（NES 規格），CSS 放大 3 倍顯示，`image-rendering: pixelated`。
- 主迴圈：`requestAnimationFrame` + 固定時間步（60 FPS accumulator），不同螢幕更新率下手感一致。
- 音效：WebAudio 方波合成（免音檔素材），列為階段三加分項。
- 後續桌面版可用 Tauri 直接包覆，不影響架構。

## 四、專案結構

```
<project-name>/
  index.html
  package.json
  tsconfig.json
  docs/GDD.md            ← 本企畫書
  src/
    main.ts              // 進入點：建 canvas、組裝模組、啟動主迴圈
    constants.ts         // 場地尺寸、速度、顏色、難度、手感參數（集中可調）
    types.ts             // 共用型別：Vec2、Side、HitType、GamePhase、Intent…
    game/Game.ts         // 遊戲狀態機 + update/render 調度
    game/Input.ts        // 鍵盤輸入（held / pressed 邊緣觸發）
    game/Renderer.ts     // 透視投影 + 全部 Canvas 繪製（球場/球員/球/UI）
    game/Physics.ts      // 球飛行、彈跳、出界、落地次數、擊球判定
    game/Score.ts        // 計分狀態機（純邏輯、零依賴、可單元測試）
    game/Audio.ts        // WebAudio 簡單音效（階段三）
    entities/Ball.ts     // 球的狀態資料
    entities/Player.ts   // 球員實體（位置、揮拍、移動範圍限制）
    entities/AiPlayer.ts // AI 控制邏輯（追球、回球選點、難度參數）
```

## 五、核心系統設計

### 5.1 座標系統與透視投影（關鍵架構）

**邏輯與視覺徹底分離**：物理、AI、判定全在「平面場地空間」進行——場地為矩形 `(x, y)` 加球的高度 `z`；只有 Renderer 負責投影成梯形透視畫面。

投影模型（線性透視即可）：

```
t = y / COURT_DEPTH                 // 0 = 遠端底線、1 = 近端底線
scale(t)  = lerp(S_FAR, S_NEAR, t)  // 例：0.62 → 1.00
screenX   = CX + (x - COURT_W/2) * scale(t) * PX
screenY   = lerp(Y_FAR, Y_NEAR, t)
球繪製於  screenY - z * scale(t) * Z_FACTOR，陰影固定畫在 (screenX, screenY)
```

- 球員 sprite 備遠/近兩種尺寸（遠端小、近端大）即可，不需連續縮放。
- 好處：物理簡單正確、出界判定在矩形空間直觀完成、未來換視角只需替換 Renderer。

### 5.2 球物理 — 落點導向（target-based）拋物線模型

- 擊球瞬間即決定**落點與飛行時間**：球以線性位移飛向落點，高度走拋物線 `z = arc·4p(1-p)`。
- 落地瞬間判定 in / out（發球時改判發球區）；界內則進入第一彈後的滑行段（速度衰減、彈跳弧變小），第二次觸地 = 擊球方得分。
- 過網：落點導向模型天然保證過網，MVP 不做掛網失誤（型別預留欄位，後續擴充）。
- 不採全自由剛體物理的理由：出界判定確定性高、AI 可直接預知落點、節奏可控，正是早期掌機網球的手感本質。

### 5.3 擊球判定與手感

| 要求 | 設計 |
|---|---|
| 擊球容錯 | 容錯半徑 reach ≈ 球員寬度 2 倍，且球高 z 低於上限即可擊中 |
| 方向依操作微調 | 擊球瞬間按住 ←/→ 決定左/中/右落點；↑ 深球（快但險）；↓ 小球 |
| 太早/太晚易出界 | `stretch = 擊球距離 / reach`，落點隨機抖動量隨 stretch 放大——站好位打的球穩，伸長手救的球容易飛出界 |
| 球速有反應時間 | 一拍飛行約 1.0~1.2 秒（沿用原型驗證值，換算後進 `constants.ts`） |
| 揮空懲罰 | 揮空有約 0.25 秒冷卻，防止無腦連打 |
| K 鍵預留 | `HitType` 列舉（NORMAL / LOB / POWER），擊球介面先收型別參數，MVP 中 LOB 先以高弧慢球或同普通球暫代 |

### 5.4 控制架構（為雙人對戰鋪路）

```
interface Controller { update(view: GameView): Intent }
  ├─ KeyboardController（玩家：方向 + 擊球意圖）
  └─ AiController（AI：追球 + 回球決策）
```

球員實體不關心輸入來源——後續雙人本機 = 把第二組 KeyboardController 接到上半場球員，零架構改動。

### 5.5 AI 設計（初版刻意不強）

- 對手擊球瞬間取得球的預定落點 → 加上**追蹤誤差**（trackErr）與**反應延遲**（reactFrames）後移動，速度有上限。
- 回球選點：55% 打玩家反向空檔、其餘隨機，落點帶抖動——AI 自己也會打出界送分。
- 難度參數表（速度 / 反應 / 誤差 / 抖動）集中在 `constants.ts`；MVP 先調出 Easy / Normal 兩檔，以「玩家可打出 3~6 拍來回、Normal 互有勝負」為調校標準。

### 5.6 計分模組（Score.ts，純邏輯）

- 分 → 局（0/15/30/40、Deuce、Adv）→ 場（先取 3 局）。
- 負責：發球權輪替（每局）、發球區輪換（每分，Deuce/Ad side）、輸出顯示字串（`"30 - 15"`、`"DEUCE"`、`"GAME PLAYER"`、`"MATCH!"`）與事件（pointWon / gameWon / matchWon）。
- 零 DOM、零 Canvas 依賴 → 可用 vitest 直接單元測試。

### 5.7 遊戲狀態機

```
Title ─Enter→ Serve ─發球→ Rally ─得分→ PointEnd(橫幅)
                ↑                            │
                └────── 未分勝負 ─────────────┘→ 分出勝負 → GameOver ─Enter→ Title
Rally/Serve ─Enter→ Pause ─Enter→ 返回
```

## 六、操作設計

| 按鍵 | 功能 |
|---|---|
| 方向鍵 / WASD | 移動球員（限己方半場：不可過網、可小幅超出邊線） |
| Space / J | 普通擊球、發球 |
| K | 高吊球／強力球（預留，MVP 暫同普通擊球） |
| Enter | 開始 / 暫停 / 重新開始 |

## 七、視覺風格（NES 彩色）

- 深綠場地、白色界線與球網帶、場外暗綠 apron；**黃色網球 + 深色陰影**（任何背景上都醒目）。
- 玩家紅衣、AI 藍衣，像素小人（頭/身/腿/球拍，揮拍時球拍抬起 1 格動畫即可）。
- UI：頂部比分列（局數 + 當前分 + 發球方標記）、中央得分橫幅（OUT! / TWO BOUNCES / GAME 等）、Title 與 GameOver 畫面。
- 一切以可讀性優先，不追求精緻美術。

## 八、開發階段與驗收標準

**階段一：骨架與畫面**
- Vite + TS 專案建立、固定時間步主迴圈、Input 模組。
- Renderer 畫出透視球場、球網、雙方球員、靜置球、比分 UI 框架。
- 玩家可移動且受半場限制。
- ✅ 驗收：畫面透視正確、移動流暢、無法越網。

**階段二：球與判定**
- Ball + Physics：落點導向飛行、彈跳、出界、兩次落地、擊球判定（含 stretch 手感）。
- 臨時計分顯示，得分後重置球。
- ✅ 驗收：玩家可手動發球並與「會自動回球的假 AI」打完一分，in/out 與兩彈判定正確。

**階段三：AI、計分與狀態機**
- AiController 完整行為、正式發球流程（發球區、輪替）、Score.ts 完整計分、Title/PointEnd/Pause/GameOver 狀態、WebAudio 音效（加分項）。
- ✅ 驗收：可從 Title 開始與 AI 完整打完「先取 3 局」一場比賽並重開。

## 九、MVP 明確不包含

複雜角色能力、裝備系統、線上連線、3D、複雜動畫、大量美術素材、掛網失誤、Tiebreak／完整盤制。

## 十、後續擴充 Roadmap

雙人本機對戰（第二組鍵位）→ Hard 難度 → K 鍵吊球/力量球實裝 → 掛網與壓線特寫 → 完整盤制與搶七 → 手把支援 → Tauri 桌面打包。

## 十一、驗證方式

- `npm run dev` 啟動（設定 `.claude/launch.json` 供 preview 工具使用），以 preview 截圖逐狀態驗證畫面（Title / Serve / Rally / PointEnd / GameOver）。
- `Score.ts` 以 vitest 單元測試：Deuce/Adv 進出、局轉換、發球權與發球區輪替、先取 3 局終局。
- 手動驗證手感：與 Normal AI 對打，確認 3~6 拍來回、伸手救球易出界、揮空冷卻成立。

## 十二、完成後回報格式

每階段完成後回報：1) 已完成功能 2) 如何執行 3) 操作方式 4) 目前限制 5) 下一步建議。
