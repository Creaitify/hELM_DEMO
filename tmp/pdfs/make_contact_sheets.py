from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parent / "renders"
pages = sorted(root.glob("helm-*.png"), key=lambda path: int(path.stem.split("-")[-1]))
font = ImageFont.truetype(r"C:\Windows\Fonts\segoeuib.ttf", 20)

for sheet_index, start in enumerate(range(0, len(pages), 7), start=1):
    group = pages[start:start + 7]
    thumb_w, thumb_h, label_h = 480, 270, 32
    sheet = Image.new("RGB", (thumb_w * 3, (thumb_h + label_h) * 3), "#20232e")
    draw = ImageDraw.Draw(sheet)
    for index, path in enumerate(group):
        page = Image.open(path).convert("RGB")
        page.thumbnail((thumb_w, thumb_h), Image.Resampling.LANCZOS)
        col, row = index % 3, index // 3
        x = col * thumb_w + (thumb_w - page.width) // 2
        y = row * (thumb_h + label_h) + label_h
        sheet.paste(page, (x, y))
        page_number = start + index + 1
        draw.text((col * thumb_w + 12, row * (thumb_h + label_h) + 5), f"PAGE {page_number:02d}", fill="white", font=font)
    sheet.save(root / f"contact-{sheet_index}.png", optimize=True)
