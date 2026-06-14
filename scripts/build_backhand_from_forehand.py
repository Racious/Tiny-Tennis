from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ATLAS_PATH = ROOT / "src" / "assets" / "players" / "near-groundstrokes.png"
CELL = 512


atlas = Image.open(ATLAS_PATH).convert("RGBA")
if atlas.size != (CELL * 4, CELL * 2):
    raise RuntimeError(f"Unexpected atlas size: {atlas.size}")

for column in range(4):
    left = column * CELL
    forehand = atlas.crop((left, 0, left + CELL, CELL))
    backhand = forehand.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    atlas.paste(backhand, (left, CELL))

atlas.save(ATLAS_PATH)
print(f"rebuilt backhand row from mirrored forehand: {ATLAS_PATH}")
