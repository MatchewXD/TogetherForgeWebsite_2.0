"""Chroma-key near-magenta backgrounds to transparency for Get Involved spots."""
from pathlib import Path
from PIL import Image

src_dir = Path(__file__).resolve().parents[1] / "public/images/spot_illustrations/Get_Involved"


def key_magenta(img: Image.Image) -> Image.Image:
    img = img.convert("RGBA")
    pixels = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            # Distance from pure magenta (255, 0, 255)
            dist = ((r - 255) ** 2 + (g - 0) ** 2 + (b - 255) ** 2) ** 0.5
            magenta_score = (r + b) / 2.0 - g
            if r > 220 and b > 220 and g < 80:
                alpha = 0
            elif r > 200 and b > 200 and g < 140 and magenta_score > 90:
                alpha = max(0, min(255, int((g - 40) * 2.55)))
                alpha = min(a, alpha, max(0, int((dist - 35) * (255 / 55))))
            else:
                alpha = max(0, min(255, int((dist - 35) * (255 / 55))))
                alpha = min(a, alpha)
            if alpha != a:
                pixels[x, y] = (r, g, b, alpha)
    return img


def main():
    for p in sorted(src_dir.glob("*.png")):
        im = Image.open(p)
        out = key_magenta(im)
        out.save(p, "PNG", optimize=True)
        print(f"keyed {p.name} size={out.size}")
    print("done")


if __name__ == "__main__":
    main()
