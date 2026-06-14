from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "reference" / "generated" / "near-overhead-video-alpha.png"
OUTPUT = ROOT / "src" / "assets" / "players" / "near-overhead.png"
CELL = 512
COLS = 4
ROWS = 2
BASELINE = 486
PAD_X = 32
PAD_TOP = 20

# Ball centers measured on the original 1717x916 generated sheet.
BALLS = ((155, 256, 15), (731, 85, 14), (1115, 30, 14), (1133, 483, 14))


def components(image: Image.Image) -> list[tuple[int, tuple[int, int, int, int]]]:
    alpha = image.getchannel("A")
    width, height = image.size
    pixels = alpha.load()
    visited = bytearray(width * height)
    found: list[tuple[int, tuple[int, int, int, int]]] = []
    for y in range(height):
        for x in range(width):
            index = y * width + x
            if visited[index] or pixels[x, y] <= 8:
                continue
            visited[index] = 1
            queue = deque([(x, y)])
            count = 0
            left = right = x
            top = bottom = y
            while queue:
                px, py = queue.popleft()
                count += 1
                left = min(left, px)
                right = max(right, px)
                top = min(top, py)
                bottom = max(bottom, py)
                for nx, ny in ((px - 1, py), (px + 1, py), (px, py - 1), (px, py + 1)):
                    if not (0 <= nx < width and 0 <= ny < height):
                        continue
                    neighbor = ny * width + nx
                    if visited[neighbor] or pixels[nx, ny] <= 8:
                        continue
                    visited[neighbor] = 1
                    queue.append((nx, ny))
            if count >= 10_000:
                found.append((count, (left, top, right + 1, bottom + 1)))
    return found


source = Image.open(SOURCE).convert("RGBA")
draw = ImageDraw.Draw(source)
for cx, cy, radius in BALLS:
    draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=(0, 0, 0, 0))

players = components(source)
if len(players) != 8:
    raise RuntimeError(f"Expected 8 player silhouettes, found {len(players)}")
players.sort(key=lambda item: (item[1][1] + item[1][3]) / 2)
ordered = []
for row in range(ROWS):
    group = players[row * COLS:(row + 1) * COLS]
    group.sort(key=lambda item: (item[1][0] + item[1][2]) / 2)
    ordered.extend(group)

bounds = [bbox for _, bbox in ordered]
max_width = max(right - left for left, _, right, _ in bounds)
max_height = max(bottom - top for _, top, _, bottom in bounds)
scale = min((CELL - PAD_X * 2) / max_width, (BASELINE - PAD_TOP) / max_height)

atlas = Image.new("RGBA", (CELL * COLS, CELL * ROWS))
for index, bbox in enumerate(bounds):
    frame = source.crop(bbox)
    frame = frame.resize(
        (max(1, round(frame.width * scale)), max(1, round(frame.height * scale))),
        Image.Resampling.LANCZOS,
    )
    x = index % COLS * CELL + (CELL - frame.width) // 2
    y = index // COLS * CELL + BASELINE - frame.height
    atlas.alpha_composite(frame, (x, y))

atlas.save(OUTPUT)
print(f"rebuilt {OUTPUT.name} without embedded balls: {atlas.size}, scale={scale:.3f}")
