from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1] / "src" / "assets" / "players"
SHEETS = (
    "near-locomotion.png",
    "near-groundstrokes.png",
    "near-overhead.png",
    "far-core.png",
    "far-extra.png",
)
CELL = 512
PAD_X = 32
PAD_TOP = 20
BASELINE = 486


def normalize(path: Path) -> None:
    source = Image.open(path).convert("RGBA")
    frames: list[Image.Image] = []
    bounds: list[tuple[int, int, int, int]] = []

    for row in range(2):
        for col in range(4):
            x0 = round(col * source.width / 4)
            x1 = round((col + 1) * source.width / 4)
            y0 = round(row * source.height / 2)
            y1 = round((row + 1) * source.height / 2)
            frame = source.crop((x0, y0, x1, y1))
            bbox = frame.getchannel("A").getbbox()
            if bbox is None:
                bbox = (0, 0, frame.width, frame.height)
            frames.append(frame)
            bounds.append(bbox)

    max_w = max(right - left for left, _, right, _ in bounds)
    max_h = max(bottom - top for _, top, _, bottom in bounds)
    scale = min((CELL - PAD_X * 2) / max_w, (BASELINE - PAD_TOP) / max_h)

    atlas = Image.new("RGBA", (CELL * 4, CELL * 2))
    for index, (frame, bbox) in enumerate(zip(frames, bounds)):
        cropped = frame.crop(bbox)
        size = (
            max(1, round(cropped.width * scale)),
            max(1, round(cropped.height * scale)),
        )
        cropped = cropped.resize(size, Image.Resampling.LANCZOS)
        x = index % 4 * CELL + (CELL - cropped.width) // 2
        y = index // 4 * CELL + BASELINE - cropped.height
        atlas.alpha_composite(cropped, (x, y))

    atlas.save(path)
    print(f"normalized {path.name}: {atlas.size}, scale={scale:.3f}")


for sheet in SHEETS:
    normalize(ROOT / sheet)
