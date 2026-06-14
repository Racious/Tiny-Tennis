from collections import deque
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "reference" / "generated" / "near-groundstrokes-video-alpha.png"
OUTPUT = ROOT / "src" / "assets" / "players" / "near-groundstrokes.png"
COLS = 4
ROWS = 2
CELL = 512
PAD_X = 32
PAD_TOP = 20
BASELINE = 486
ALPHA_THRESHOLD = 8
MIN_COMPONENT_PIXELS = 10_000


def find_components(image: Image.Image) -> list[tuple[int, tuple[int, int, int, int]]]:
    alpha = image.getchannel("A")
    width, height = image.size
    pixels = alpha.load()
    visited = bytearray(width * height)
    components: list[tuple[int, tuple[int, int, int, int]]] = []

    for y in range(height):
        for x in range(width):
            index = y * width + x
            if visited[index] or pixels[x, y] <= ALPHA_THRESHOLD:
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
                    if visited[neighbor] or pixels[nx, ny] <= ALPHA_THRESHOLD:
                        continue
                    visited[neighbor] = 1
                    queue.append((nx, ny))
            if count >= MIN_COMPONENT_PIXELS:
                components.append((count, (left, top, right + 1, bottom + 1)))

    return components


source = Image.open(SOURCE).convert("RGBA")
components = find_components(source)
if len(components) != COLS * ROWS:
    raise RuntimeError(f"Expected 8 complete player components, found {len(components)}")

# Assign complete connected silhouettes to rows first, then preserve left-to-right action order.
components.sort(key=lambda item: (item[1][1] + item[1][3]) / 2)
ordered: list[tuple[int, tuple[int, int, int, int]]] = []
for row in range(ROWS):
    row_components = components[row * COLS:(row + 1) * COLS]
    row_components.sort(key=lambda item: (item[1][0] + item[1][2]) / 2)
    ordered.extend(row_components)

bounds = [bbox for _, bbox in ordered]
max_width = max(right - left for left, _, right, _ in bounds)
max_height = max(bottom - top for _, top, _, bottom in bounds)
scale = min((CELL - PAD_X * 2) / max_width, (BASELINE - PAD_TOP) / max_height)

atlas = Image.new("RGBA", (CELL * COLS, CELL * ROWS))
for index, bbox in enumerate(bounds):
    frame = source.crop(bbox)
    resized = frame.resize(
        (max(1, round(frame.width * scale)), max(1, round(frame.height * scale))),
        Image.Resampling.LANCZOS,
    )
    x = index % COLS * CELL + (CELL - resized.width) // 2
    y = index // COLS * CELL + BASELINE - resized.height
    atlas.alpha_composite(resized, (x, y))

atlas.save(OUTPUT)
print(f"repaired {OUTPUT.name}: {atlas.size}, scale={scale:.3f}")
for index, bbox in enumerate(bounds):
    print(f"frame {index}: source bounds={bbox}")
