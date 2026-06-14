#!/usr/bin/env python3
"""把老爺新發球圖（4x2、洋紅底、含編號與球）處理成遊戲用 near-overhead.png。
策略：
  1. 洋紅去背
  2. 清掉每格上方白色編號（只清上緣，不動白短褲/襪）
  3. 保留第 1 格的球，移除第 2~8 格的黃色球（遊戲自己會畫拋球）
  4. 單一比例縮放（以第 1 格立姿為基準，對齊既有 locomotion 身高）→ 各幀大小一致
  5. 腳底對齊、依下半身置中，輸出 440x280（4x2，cell 110x140）
"""
from PIL import Image

SRC = "preview/serve-source.png"
OUT = "src/assets/players/near-overhead.png"
LOCO = "src/assets/players/near-locomotion.png"

COLS, ROWS = 4, 2
CELL_W, CELL_H = 110, 140        # 與 locomotion 同尺寸，確保繪製大小一致
BOTTOM_MARGIN = 2                # 腳底距 cell 底
NUM_STRIP = 90                   # 每格上緣編號區高度（清白字用）

def is_bg(r, g, b):
    # 洋紅背景：R 高、B 高、G 低
    return r > 140 and b > 120 and g < 110

def is_ball(r, g, b):
    # 網球黃綠：G 高、B 偏低、R≈G、G 明顯大於 B
    # 膚色 R>>G（r-g 大）排除；白褲/襪 g-b 小排除
    return b < 150 and g > 165 and (r - g) < 40 and (g - b) > 50

def is_whiteish(r, g, b):
    return r > 220 and g > 220 and b > 220

def is_hair(r, g, b):
    return 70 < r < 190 and 40 < g < 140 and b < 110 and r >= g >= b and (r - b) > 30

def key_cell(src, cx, cy, cw, ch, remove_ball):
    """回傳該格 RGBA（去背、去編號、視情況去球）"""
    cell = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    sp = src.load()
    dp = cell.load()
    # 先建球遮罩並擴張 2px，把抗鋸齒淡邊一併清除
    ballmask = [[False] * cw for _ in range(ch)] if remove_ball else None
    if remove_ball:
        for y in range(ch):
            for x in range(cw):
                r, g, b = sp[cx + x, cy + y][:3]
                if is_ball(r, g, b):
                    ballmask[y][x] = True
        grown = [[False] * cw for _ in range(ch)]
        R = 2
        for y in range(ch):
            for x in range(cw):
                if not ballmask[y][x]:
                    continue
                for dy in range(-R, R + 1):
                    for dx in range(-R, R + 1):
                        ny, nx = y + dy, x + dx
                        if 0 <= ny < ch and 0 <= nx < cw:
                            grown[ny][nx] = True
        ballmask = grown
    for y in range(ch):
        for x in range(cw):
            r, g, b = sp[cx + x, cy + y][:3]
            if is_bg(r, g, b):
                continue
            if y < NUM_STRIP and is_whiteish(r, g, b):
                continue  # 清掉上緣白色編號
            if ballmask and ballmask[y][x]:
                continue  # 去掉拋球（含淡邊）
            dp[x, y] = (r, g, b, 255)
    return cell

def content_bbox(img):
    bbox = img.getbbox()
    return bbox  # (l,t,r,b) or None

def feet_to_head(img):
    """已去背 RGBA：回傳 (腳到頭高, 頭頂y, 腳底y)。頭頂以髮色最高點為準。"""
    px = img.load()
    w, h = img.size
    hair_top = None
    feet = None
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 40:
                continue
            feet = y
            if hair_top is None and is_hair(r, g, b):
                hair_top = y
        if hair_top is None:
            # 仍未找到髮色：記錄目前列以備無髮（理論上不會發生）
            pass
    return (feet - hair_top, hair_top, feet) if (hair_top is not None and feet is not None) else None

def feet_centroid_x(img, bbox):
    """下半身（底部 22%）的 x 重心，用來水平置中（避免被伸出的球拍帶歪）"""
    l, t, r, b = bbox
    h = b - t
    y0 = b - max(6, int(h * 0.22))
    px = img.load()
    sx = cnt = 0
    for y in range(y0, b):
        for x in range(l, r):
            if px[x, y][3] > 40:
                sx += x
                cnt += 1
    return (sx / cnt) if cnt else (l + r) / 2

def main():
    src = Image.open(SRC).convert("RGB")
    W, H = src.size
    cw, ch = W // COLS, H // ROWS
    print(f"src {W}x{H}  cell {cw}x{ch}")

    # 1) 切格 + 去背/去編號/去球
    cells = []
    for r in range(ROWS):
        for c in range(COLS):
            idx = r * COLS + c
            keep_ball = (idx == 0)
            cell = key_cell(src, c * cw, r * ch, cw, ch, remove_ball=not keep_ball)
            bbox = content_bbox(cell)
            cells.append((cell, bbox))
            if bbox:
                print(f"  frame{idx+1}: bbox h={bbox[3]-bbox[1]} w={bbox[2]-bbox[0]} (ball={'keep' if keep_ball else 'cut'})")

    # 2) 參考身高：locomotion 第 1 格「腳到頭」＝待機正常大小基準
    loco = Image.open(LOCO).convert("RGBA")
    lcw, lch = loco.width // 4, loco.height // 2
    idle_v = feet_to_head(loco.crop((0, 0, lcw, lch)))
    idle_f2h = idle_v[0]
    print(f"idle feet-to-head = {idle_f2h}")

    # 3) 單一比例：以發球各「站姿」幀的腳到頭對齊 idle
    #    球拍舉過頭的幀（頭頂偵測會被咖啡色握把污染）以 headtop 閾值排除。
    for idx, (cell, _bbox) in enumerate(cells):
        v = feet_to_head(cell)
        if v:
            print(f"  frame{idx+1}: f2h={v[0]} headtop={v[1]}")
    # 以「發球準備格(第1格, 屈膝)」的腳到頭對齊待機 → 玩家盯著看的姿勢與待機同高，
    # 後續站直/伸展幀自然略高（合理），且因各幀同一比例不會忽大忽小。
    ready_f2h = feet_to_head(cells[0][0])[0]
    scale = idle_f2h / ready_f2h
    print(f"ready(frame1) f2h={ready_f2h}  -> single scale={scale:.3f}")

    # 4) 套用同一比例、腳底對齊、下半身置中，組回 4x2
    out = Image.new("RGBA", (CELL_W * COLS, CELL_H * ROWS), (0, 0, 0, 0))
    for idx, (cell, bbox) in enumerate(cells):
        if not bbox:
            continue
        l, t, r, b = bbox
        fcx = feet_centroid_x(cell, bbox)
        crop = cell.crop((l, t, r, b))
        nw, nh = max(1, round((r - l) * scale)), max(1, round((b - t) * scale))
        crop = crop.resize((nw, nh), Image.LANCZOS)
        # 在 cell 內的位置
        cell_col, cell_row = idx % COLS, idx // COLS
        ox = cell_col * CELL_W
        oy = cell_row * CELL_H
        # 水平：把腳重心對到 cell 中央
        feet_in_crop = (fcx - l) * scale
        paste_x = ox + round(CELL_W / 2 - feet_in_crop)
        # 垂直：內容底對齊 cell 底
        paste_y = oy + CELL_H - BOTTOM_MARGIN - nh
        out.alpha_composite(crop, (paste_x, paste_y))

    out.save(OUT)
    print(f"saved {OUT}  {out.size}")

if __name__ == "__main__":
    main()
