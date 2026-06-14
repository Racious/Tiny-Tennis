"""把 3 幀裁判圖（洋紅去背底）處理成乾淨 sprite：去背 → 切幀 → 對齊 → 輸出。
輸出 src/assets/umpire.png（3 欄 x 1 列，等格、底部對齊、水平置中）。
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "preview" / "umpire-3way-source.png"
OUTPUT = ROOT / "src" / "assets" / "umpire.png"
FRAMES = 3
TARGET_H = 240   # 正規化後內容高度（繪製時再縮到螢幕尺寸）
PAD = 6


def key_out_background(img: Image.Image) -> Image.Image:
    img = img.convert("RGBA")
    px = img.load()
    w, h = img.size
    corners = (px[2, 2], px[w - 3, 2], px[2, h - 3], px[w - 3, h - 3])
    key = tuple(sum(c[i] for c in corners) / 4 for i in range(3))
    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            dist = ((r - key[0]) ** 2 + (g - key[1]) ** 2 + (b - key[2]) ** 2) ** 0.5
            if dist <= 45:
                a = 0
            elif dist >= 105:
                a = 255
            else:
                a = round(255 * (dist - 45) / 60)
            px[x, y] = (r, g, b, a)
    return img


src = key_out_background(Image.open(SOURCE))
W, H = src.size
cw = W // FRAMES

# 切幀 + 緊裁
crops = []
for i in range(FRAMES):
    cell = src.crop((i * cw, 0, (i + 1) * cw, H))
    bbox = cell.getchannel("A").getbbox()
    if bbox is None:
        raise RuntimeError(f"frame {i} empty")
    crops.append(cell.crop(bbox))

# 統一縮放（以最高的內容為準縮到 TARGET_H）並對齊
scale = TARGET_H / max(c.height for c in crops)
scaled = [c.resize((max(1, round(c.width * scale)), max(1, round(c.height * scale))), Image.LANCZOS) for c in crops]
out_w = max(c.width for c in scaled) + PAD * 2
out_h = max(c.height for c in scaled) + PAD * 2

sheet = Image.new("RGBA", (out_w * FRAMES, out_h), (0, 0, 0, 0))
for i, c in enumerate(scaled):
    dx = i * out_w + (out_w - c.width) // 2          # 水平置中
    dy = out_h - PAD - c.height                       # 底部對齊
    sheet.paste(c, (dx, dy), c)

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
sheet.save(OUTPUT)
print(f"wrote {OUTPUT} -> {sheet.size}, cell {out_w}x{out_h}")
