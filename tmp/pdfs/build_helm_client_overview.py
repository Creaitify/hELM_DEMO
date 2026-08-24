from __future__ import annotations

from pathlib import Path
from typing import Iterable, Sequence

from PIL import Image
from fontTools.ttLib import TTFont as FontToolsTTFont
from fontTools.varLib.instancer import instantiateVariableFont
from reportlab.lib.colors import Color, HexColor
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[2]
CAP = ROOT / "tmp" / "pdfs" / "captures"
OUT = ROOT / "output" / "pdf" / "HELM_Client_Product_Overview.pdf"

W, H = 960.0, 540.0
TOTAL_PAGES = 21

NIGHT = HexColor("#070A12")
NIGHT_2 = HexColor("#0B0E1A")
NIGHT_3 = HexColor("#131829")
NIGHT_4 = HexColor("#1D2438")
NIGHT_INK = HexColor("#F2F4F8")
NIGHT_MUTED = HexColor("#A7AEC0")
NIGHT_FAINT = HexColor("#6E7688")
CANVAS = HexColor("#ECEEF4")
SURFACE = HexColor("#FFFFFF")
SURFACE_SUBTLE = HexColor("#F6F7FA")
SURFACE_SUNK = HexColor("#EEF0F5")
LINE = HexColor("#E2E4EC")
LINE_STRONG = HexColor("#C6CAD8")
INK = HexColor("#10131C")
INK_700 = HexColor("#343B4B")
INK_500 = HexColor("#656D80")
INK_400 = HexColor("#8B92A3")
HELM = HexColor("#2F43C9")
HELM_DARK = HexColor("#22318F")
HELM_SOFT = HexColor("#DEE4FB")
IRIS = HexColor("#7C5BFF")
PEACH = HexColor("#FFDDD0")
PEACH_STRONG = HexColor("#F7AA8E")
GOOD = HexColor("#0A7F59")
GOOD_SOFT = HexColor("#E7F3EE")
WARN = HexColor("#A4620F")
WARN_SOFT = HexColor("#FAF1E3")
BAD = HexColor("#C31F3C")
BAD_SOFT = HexColor("#FBE9ED")

SANS = "HelmSans"
SANS_BOLD = "HelmSansBold"
SANS_LIGHT = "HelmSansLight"
MONO = "HelmMono"
MONO_BOLD = "HelmMonoBold"
INR_SANS = "HelmINRSans"
INR_SANS_BOLD = "HelmINRSansBold"

IMG = {
    "hero": CAP / "supplied-hero.png",
    "security": CAP / "supplied-security.png",
    "closing": CAP / "supplied-closing.png",
    "briefing": CAP / "supplied-briefing.png",
    "performance": CAP / "supplied-performance.png",
    "connections": CAP / "supplied-connections.png",
    "team": CAP / "supplied-team.png",
    "investigation": CAP / "supplied-investigation.png",
    "campaigns": CAP / "extra-campaigns.png",
    "intelligence": CAP / "extra-intelligence.png",
    "library": CAP / "extra-library.png",
    "campaign_detail": CAP / "extra-campaign-detail.png",
}

_image_sizes: dict[Path, tuple[int, int]] = {}
_image_readers: dict[Path, ImageReader] = {}


def register_fonts() -> None:
    font_dir = Path(r"C:\Windows\Fonts")
    source = Path(r"C:\Users\prach\AppData\Local\Microsoft\Windows\Fonts\InstrumentSans-VariableFont_wdth,wght.ttf")
    static_dir = ROOT / "tmp" / "pdfs" / "fonts"
    static_dir.mkdir(parents=True, exist_ok=True)
    regular = static_dir / "InstrumentSans-Regular.ttf"
    bold = static_dir / "InstrumentSans-Bold.ttf"
    if not regular.exists():
        font = FontToolsTTFont(str(source))
        instantiateVariableFont(font, {"wght": 400, "wdth": 100}, inplace=True)
        font.save(str(regular))
    if not bold.exists():
        font = FontToolsTTFont(str(source))
        instantiateVariableFont(font, {"wght": 700, "wdth": 100}, inplace=True)
        font.save(str(bold))
    pdfmetrics.registerFont(TTFont(SANS, str(regular)))
    pdfmetrics.registerFont(TTFont(SANS_BOLD, str(bold)))
    pdfmetrics.registerFont(TTFont(SANS_LIGHT, str(regular)))
    pdfmetrics.registerFont(TTFont(MONO, str(font_dir / "consola.ttf")))
    pdfmetrics.registerFont(TTFont(MONO_BOLD, str(font_dir / "consolab.ttf")))
    pdfmetrics.registerFont(TTFont(INR_SANS, str(font_dir / "segoeui.ttf")))
    pdfmetrics.registerFont(TTFont(INR_SANS_BOLD, str(font_dir / "segoeuib.ttf")))


def font_for_text(font: str, text: str) -> str:
    """Use a metrically compatible embedded fallback for the Indian rupee glyph."""
    if "₹" not in text:
        return font
    if font == SANS_BOLD:
        return INR_SANS_BOLD
    if font in (SANS, SANS_LIGHT):
        return INR_SANS
    return font


def image_size(path: Path) -> tuple[int, int]:
    if path not in _image_sizes:
        with Image.open(path) as image:
            _image_sizes[path] = image.size
    return _image_sizes[path]


def image_reader(path: Path) -> ImageReader:
    if path not in _image_readers:
        _image_readers[path] = ImageReader(str(path))
    return _image_readers[path]


def set_fill(c: canvas.Canvas, color, alpha: float | None = None) -> None:
    c.setFillColor(color)
    if alpha is not None:
        c.setFillAlpha(alpha)


def set_stroke(c: canvas.Canvas, color, alpha: float | None = None) -> None:
    c.setStrokeColor(color)
    if alpha is not None:
        c.setStrokeAlpha(alpha)


def draw_tracking_text(
    c: canvas.Canvas,
    text: str,
    x: float,
    y: float,
    font: str,
    size: float,
    tracking: float,
    color,
) -> float:
    c.saveState()
    c.setFillColor(color)
    c.setFont(font, size)
    cursor = x
    for char in text:
        c.drawString(cursor, y, char)
        cursor += pdfmetrics.stringWidth(char, font, size) + tracking
    c.restoreState()
    return cursor


def wrap_lines(text: str, font: str, size: float, max_width: float) -> list[str]:
    words = text.split()
    if not words:
        return []
    lines: list[str] = []
    current = words[0]
    for word in words[1:]:
        test = f"{current} {word}"
        if pdfmetrics.stringWidth(test, font, size) <= max_width:
            current = test
        else:
            lines.append(current)
            current = word
    lines.append(current)
    return lines


def draw_paragraph(
    c: canvas.Canvas,
    text: str,
    x: float,
    y: float,
    max_width: float,
    font: str = SANS,
    size: float = 12,
    leading: float | None = None,
    color=INK_500,
    max_lines: int | None = None,
) -> float:
    leading = leading or size * 1.45
    font = font_for_text(font, text)
    lines = wrap_lines(text, font, size, max_width)
    if max_lines is not None:
        lines = lines[:max_lines]
    c.saveState()
    c.setFillColor(color)
    c.setFont(font, size)
    for line in lines:
        c.drawString(x, y, line)
        y -= leading
    c.restoreState()
    return y


def draw_image_cover(
    c: canvas.Canvas,
    path: Path,
    x: float,
    y: float,
    w: float,
    h: float,
    focal: tuple[float, float] = (0.5, 0.5),
    radius: float = 0,
    overlay=None,
    overlay_alpha: float = 0.0,
) -> None:
    iw, ih = image_size(path)
    scale = max(w / iw, h / ih)
    dw, dh = iw * scale, ih * scale
    dx = x + (w - dw) * focal[0]
    dy = y + (h - dh) * (1 - focal[1])
    c.saveState()
    clip = c.beginPath()
    if radius:
        clip.roundRect(x, y, w, h, radius)
    else:
        clip.rect(x, y, w, h)
    c.clipPath(clip, stroke=0, fill=0)
    c.drawImage(image_reader(path), dx, dy, width=dw, height=dh, preserveAspectRatio=True, mask="auto")
    if overlay is not None and overlay_alpha > 0:
        c.setFillColor(overlay)
        c.setFillAlpha(overlay_alpha)
        c.rect(x, y, w, h, stroke=0, fill=1)
    c.restoreState()


def draw_image_contain(
    c: canvas.Canvas,
    path: Path,
    x: float,
    y: float,
    w: float,
    h: float,
    radius: float = 0,
    background=SURFACE,
) -> tuple[float, float, float, float]:
    iw, ih = image_size(path)
    scale = min(w / iw, h / ih)
    dw, dh = iw * scale, ih * scale
    dx, dy = x + (w - dw) / 2, y + (h - dh) / 2
    c.saveState()
    c.setFillColor(background)
    c.roundRect(x, y, w, h, radius, stroke=0, fill=1)
    clip = c.beginPath()
    if radius:
        clip.roundRect(x, y, w, h, radius)
    else:
        clip.rect(x, y, w, h)
    c.clipPath(clip, stroke=0, fill=0)
    c.drawImage(image_reader(path), dx, dy, width=dw, height=dh, preserveAspectRatio=True, mask="auto")
    c.restoreState()
    return dx, dy, dw, dh


def draw_mark(c: canvas.Canvas, x: float, y: float, size: float, tone: str = "dark") -> None:
    color = NIGHT_INK if tone == "dark" else INK
    quiet = Color(0.66, 0.72, 0.86, 0.72) if tone == "dark" else Color(0.18, 0.26, 0.79, 0.68)
    c.saveState()
    c.setLineWidth(max(0.8, size * 0.055))
    c.setStrokeColor(quiet)
    c.circle(x + size / 2, y + size / 2, size * 0.38, stroke=1, fill=0)
    c.circle(x + size / 2, y + size / 2, size * 0.23, stroke=1, fill=0)
    c.setStrokeColor(color)
    c.line(x + size * 0.48, y + size * 0.5, x + size * 0.78, y + size * 0.74)
    c.setFillColor(color)
    c.circle(x + size * 0.5, y + size * 0.5, size * 0.06, stroke=0, fill=1)
    c.restoreState()


def draw_wordmark(c: canvas.Canvas, x: float, y: float, dark: bool = True, size: float = 15) -> None:
    draw_mark(c, x, y - 3, size + 3, "dark" if dark else "light")
    draw_tracking_text(
        c,
        "HELM",
        x + size + 10,
        y,
        SANS_BOLD,
        size,
        1.7,
        NIGHT_INK if dark else INK,
    )


def draw_dark_grid(c: canvas.Canvas, step: float = 52) -> None:
    c.saveState()
    c.setLineWidth(0.5)
    c.setStrokeColor(Color(0.38, 0.46, 0.7, 0.12))
    x = 0.0
    while x <= W:
        c.line(x, 0, x, H)
        x += step
    y = 0.0
    while y <= H:
        c.line(0, y, W, y)
        y += step
    c.restoreState()


def draw_footer(c: canvas.Canvas, page: int, dark: bool, sample: bool = False) -> None:
    line_color = Color(1, 1, 1, 0.10) if dark else LINE
    quiet = NIGHT_FAINT if dark else INK_400
    c.saveState()
    c.setStrokeColor(line_color)
    c.setLineWidth(0.6)
    c.line(54, 27, 906, 27)
    draw_tracking_text(c, "HELM / PRODUCT OVERVIEW", 54, 12, MONO, 7.4, 0.65, quiet)
    if sample:
        c.setFont(MONO, 7.4)
        c.setFillColor(quiet)
        c.drawCentredString(W / 2, 12, "ILLUSTRATIVE SAMPLE WORKSPACE / NOT CUSTOMER DATA")
    c.setFont(MONO, 7.4)
    c.setFillColor(quiet)
    c.drawRightString(906, 12, f"{page:02d} / {TOTAL_PAGES:02d}")
    c.restoreState()


def begin_page(c: canvas.Canvas, page: int, title: str, dark: bool, sample: bool = False) -> None:
    c.bookmarkPage(f"page-{page}")
    c.addOutlineEntry(title, f"page-{page}", level=0, closed=False)
    c.setFillColor(NIGHT if dark else CANVAS)
    c.rect(0, 0, W, H, stroke=0, fill=1)
    if dark:
        draw_dark_grid(c)
    if page not in (1, 21):
        draw_footer(c, page, dark, sample)


def draw_kicker(c: canvas.Canvas, text: str, x: float, y: float, dark: bool) -> None:
    color = Color(0.70, 0.75, 0.90, 0.78) if dark else HELM_DARK
    draw_tracking_text(c, text.upper(), x, y, MONO_BOLD, 8.2, 1.0, color)


def draw_title(
    c: canvas.Canvas,
    text: str,
    x: float,
    y: float,
    max_width: float,
    dark: bool,
    size: float = 36,
    leading: float | None = None,
    font: str = SANS_BOLD,
) -> float:
    return draw_paragraph(
        c,
        text,
        x,
        y,
        max_width,
        font=font,
        size=size,
        leading=leading or size * 1.02,
        color=NIGHT_INK if dark else INK,
    )


def draw_card(
    c: canvas.Canvas,
    x: float,
    y: float,
    w: float,
    h: float,
    title: str,
    body: str,
    dark: bool = False,
    accent=None,
    index: str | None = None,
) -> None:
    fill = Color(0.055, 0.07, 0.13, 0.88) if dark else SURFACE
    stroke = Color(1, 1, 1, 0.12) if dark else LINE
    c.saveState()
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.setLineWidth(0.7)
    c.roundRect(x, y, w, h, 10, stroke=1, fill=1)
    if accent is not None:
        c.setFillColor(accent)
        c.roundRect(x, y + h - 4, w, 4, 2, stroke=0, fill=1)
    text_x = x + 18
    if index is not None:
        c.setFillColor(accent or HELM)
        c.circle(x + 24, y + h - 25, 10, stroke=0, fill=1)
        c.setFillColor(NIGHT if dark else SURFACE)
        c.setFont(MONO_BOLD, 7.8)
        c.drawCentredString(x + 24, y + h - 28, index)
        text_x = x + 42
    c.setFillColor(NIGHT_INK if dark else INK)
    c.setFont(SANS_BOLD, 13.4)
    c.drawString(text_x, y + h - 31, title)
    draw_paragraph(
        c,
        body,
        x + 18,
        y + h - 54,
        w - 36,
        font=SANS,
        size=10.3,
        leading=15.0,
        color=NIGHT_MUTED if dark else INK_500,
    )
    c.restoreState()


def draw_stat(c: canvas.Canvas, x: float, y: float, w: float, label: str, value: str, note: str, tone=HELM) -> None:
    c.saveState()
    c.setFillColor(SURFACE)
    c.setStrokeColor(LINE)
    c.roundRect(x, y, w, 90, 10, stroke=1, fill=1)
    c.setFillColor(tone)
    c.rect(x, y, 4, 90, stroke=0, fill=1)
    draw_tracking_text(c, label.upper(), x + 17, y + 67, MONO_BOLD, 7.4, 0.7, INK_400)
    c.setFont(font_for_text(SANS_BOLD, value), 24)
    c.setFillColor(INK)
    c.drawString(x + 17, y + 38, value)
    c.setFont(font_for_text(SANS, note), 8.7)
    c.setFillColor(INK_500)
    c.drawString(x + 17, y + 17, note)
    c.restoreState()


def draw_arrow(c: canvas.Canvas, x1: float, y1: float, x2: float, y2: float, color, width: float = 1.2) -> None:
    c.saveState()
    c.setStrokeColor(color)
    c.setFillColor(color)
    c.setLineWidth(width)
    c.line(x1, y1, x2, y2)
    angle = 5.5
    c.line(x2, y2, x2 - angle, y2 + angle * 0.55)
    c.line(x2, y2, x2 - angle, y2 - angle * 0.55)
    c.restoreState()


def page_01_cover(c: canvas.Canvas) -> None:
    begin_page(c, 1, "Cover", True)
    draw_image_cover(c, IMG["hero"], 430, 0, 530, H, focal=(1.0, 0.52), overlay=NIGHT, overlay_alpha=0.18)
    c.saveState()
    c.setFillColor(NIGHT)
    c.rect(0, 0, 430, H, stroke=0, fill=1)
    c.restoreState()
    draw_wordmark(c, 60, 482, dark=True, size=15)
    draw_kicker(c, "Google Ads + Meta Ads / Product overview", 60, 414, True)
    draw_title(c, "The decision layer for paid media.", 60, 360, 370, True, size=42, leading=43)
    draw_paragraph(
        c,
        "A comprehensive product overview for marketing and performance teams.",
        60,
        236,
        320,
        font=SANS,
        size=15,
        leading=22,
        color=NIGHT_MUTED,
    )
    c.setFillColor(PEACH)
    c.roundRect(60, 147, 310, 43, 8, stroke=0, fill=1)
    c.setFillColor(INK)
    c.setFont(SANS_BOLD, 9.7)
    c.drawString(78, 163, "SEE WHAT MOVED. KNOW WHAT TO MOVE NEXT.")
    c.setStrokeColor(Color(1, 1, 1, 0.12))
    c.line(60, 88, 350, 88)
    draw_tracking_text(c, "ILLUSTRATIVE PRODUCT ENVIRONMENT", 60, 64, MONO, 7.5, 0.7, NIGHT_FAINT)
    c.setFont(SANS, 8.7)
    c.setFillColor(NIGHT_FAINT)
    c.drawString(60, 45, "Screens use fictional sample data and do not represent customer results.")


def page_02_promise(c: canvas.Canvas) -> None:
    begin_page(c, 2, "Executive promise", True)
    draw_kicker(c, "Executive promise", 56, 482, True)
    c.setFont(SANS_BOLD, 46)
    c.setFillColor(NIGHT_INK)
    c.drawString(56, 418, "See what moved.")
    c.setFillColor(HexColor("#C9D5FF"))
    c.drawString(56, 369, "Know what to move next.")
    draw_paragraph(
        c,
        "HELM is paid-media intelligence for brands, agencies and performance teams managing Google Ads and Meta Ads across one or many accounts. It sits between platform reporting and the person responsible for where the next unit of budget goes.",
        56,
        305,
        580,
        size=15,
        leading=22,
        color=NIGHT_MUTED,
    )
    x_positions = [56, 351, 646]
    items = [
        ("ONE DECISION CONTEXT", "Workspace, account scope, period, comparison, freshness and currency remain visible."),
        ("EVIDENCE BESIDE ASSERTION", "Every finding carries a basis, source, caveat and path back to the numbers."),
        ("HUMAN CONTROL", "Recommendations are bounded proposals. Review and decision remain explicit."),
    ]
    for index, ((title, body), x) in enumerate(zip(items, x_positions), start=1):
        draw_card(c, x, 85, 258, 128, title, body, dark=True, accent=[HELM, IRIS, PEACH_STRONG][index - 1], index=f"0{index}")


def page_03_problem(c: canvas.Canvas) -> None:
    begin_page(c, 3, "The operating problem", False)
    draw_kicker(c, "The operating problem", 56, 482, False)
    draw_title(c, "Paid media has no shortage of dashboards. It has a decision problem.", 56, 438, 835, False, size=34, leading=37)
    draw_paragraph(
        c,
        "Google Ads and Meta Ads describe performance through different event definitions, attribution windows, account structures and reporting rhythms. The hard part is deciding which movement matters, whether the comparison is valid and what action is proportionate.",
        56,
        348,
        820,
        size=13.2,
        leading=19,
        color=INK_500,
    )
    cards = [
        ("Fragmented truth", "The same commercial outcome can be represented differently by each platform.", BAD),
        ("Context risk", "Currency, timezone, freshness and attribution can invalidate a convenient roll-up.", WARN),
        ("Decision gap", "Reporting often stops before evidence, risk, ownership and the next step are explicit.", HELM),
    ]
    for i, (title, body, accent) in enumerate(cards):
        draw_card(c, 56 + i * 290, 154, 266, 132, title, body, dark=False, accent=accent, index=f"0{i+1}")
    c.setFillColor(INK)
    c.setFont(SANS_BOLD, 16)
    c.drawString(56, 102, "The HELM response")
    c.setStrokeColor(LINE_STRONG)
    c.setLineWidth(1)
    c.line(205, 108, 905, 108)
    c.setFont(MONO, 10)
    c.setFillColor(HELM_DARK)
    c.drawRightString(905, 102, "SCOPE + MOVEMENT + BASIS + EVIDENCE + PROPOSED NEXT STEP")


def page_04_model(c: canvas.Canvas) -> None:
    begin_page(c, 4, "The HELM model", True)
    draw_kicker(c, "Operating grammar", 56, 482, True)
    draw_title(c, "HELM makes the decision trail visible.", 56, 438, 650, True, size=36)
    draw_paragraph(
        c,
        "The product follows one disciplined sequence from source truth to a reviewable decision.",
        56,
        385,
        620,
        size=13.2,
        leading=19,
        color=NIGHT_MUTED,
    )
    node_w, node_h, gap = 148, 154, 24
    start_x, y = 56, 154
    nodes = [
        ("01", "Signal", "Preserve provider identity, account hierarchy and source values.", HELM),
        ("02", "Discrepancy", "Surface differences in definition, freshness and compatibility.", IRIS),
        ("03", "Evidence", "Attach the exact window, comparison, formula, source and exclusions.", HexColor("#A9BDFF")),
        ("04", "Recommendation", "Propose a bounded action with assumptions, risk and stop conditions.", PEACH_STRONG),
        ("05", "Human decision", "Approve, revise, save or dismiss. Nothing is executed automatically in the experience shown.", GOOD),
    ]
    for i, (index, title, body, accent) in enumerate(nodes):
        x = start_x + i * (node_w + gap)
        draw_card(c, x, y, node_w, node_h, title, body, dark=True, accent=accent, index=index)
        if i < len(nodes) - 1:
            draw_arrow(c, x + node_w + 4, y + node_h / 2, x + node_w + gap - 5, y + node_h / 2, Color(0.64, 0.72, 1, 0.48))
    c.setFillColor(NIGHT_MUTED)
    c.setFont(SANS, 11)
    c.drawString(56, 102, "This sequence is both the product model and the visual logic of the interface.")


def page_05_context(c: canvas.Canvas) -> None:
    begin_page(c, 5, "Connected decision context", True, sample=True)
    draw_kicker(c, "Connected decision context", 56, 486, True)
    draw_title(c, "Every account enters the same decision context.", 56, 450, 520, True, size=29, leading=31)
    draw_paragraph(
        c,
        "The Northstar sample workspace keeps platform identity, account scope, period, currency, freshness and exclusions visible around the recommendation.",
        625,
        452,
        278,
        size=11.2,
        leading=16,
        color=NIGHT_MUTED,
    )
    c.setStrokeColor(Color(1, 1, 1, 0.16))
    c.roundRect(52, 63, 856, 344, 10, stroke=1, fill=0)
    draw_image_cover(c, IMG["hero"], 53, 64, 854, 342, focal=(0.5, 0.48), radius=9)
    markers = [(96, 346), (356, 320), (690, 312), (738, 160)]
    for i, (x, y) in enumerate(markers, start=1):
        c.setFillColor(PEACH if i == 4 else HELM_SOFT)
        c.circle(x, y, 10, stroke=0, fill=1)
        c.setFillColor(INK)
        c.setFont(MONO_BOLD, 7.5)
        c.drawCentredString(x, y - 2.7, f"{i:02d}")
    labels = [
        "Account scope and data quality",
        "Complete reporting window",
        "Cross-channel reconciliation",
        "Bounded recommendation",
    ]
    for i, label in enumerate(labels):
        x = 60 + i * 211
        c.setFillColor(NIGHT_MUTED)
        c.setFont(SANS, 8.8)
        c.drawString(x, 43, f"{i+1:02d}  {label}")


def page_06_product_map(c: canvas.Canvas) -> None:
    begin_page(c, 6, "Product surface map", False, sample=True)
    draw_kicker(c, "Product surface", 52, 487, False)
    draw_title(c, "From morning brief to durable decision record.", 52, 450, 740, False, size=31)
    draw_paragraph(
        c,
        "HELM keeps daily triage, cross-channel exploration, investigation and decision artifacts inside one operating system.",
        52,
        410,
        780,
        size=11.8,
        leading=17,
        color=INK_500,
    )
    shots = [
        ("CAMPAIGNS", IMG["campaigns"]),
        ("INTELLIGENCE", IMG["intelligence"]),
        ("LIBRARY", IMG["library"]),
    ]
    for i, (label, path) in enumerate(shots):
        x = 52 + i * 286
        c.setFillColor(SURFACE)
        c.setStrokeColor(LINE)
        c.roundRect(x, 190, 266, 186, 8, stroke=1, fill=1)
        draw_image_contain(c, path, x + 1, 213, 264, 162, radius=7, background=SURFACE)
        draw_tracking_text(c, label, x + 12, 198, MONO_BOLD, 7.2, 0.65, INK_400)
    stages = [
        ("Briefing", "Triage"),
        ("Campaigns", "Explore"),
        ("Investigate", "Explain"),
        ("Decision", "Review"),
        ("Library", "Remember"),
    ]
    for i, (title, action) in enumerate(stages):
        x = 60 + i * 171
        c.setFillColor(HELM if i < 4 else GOOD)
        c.circle(x, 117, 8, stroke=0, fill=1)
        if i < len(stages) - 1:
            c.setStrokeColor(LINE_STRONG)
            c.line(x + 10, 117, x + 153, 117)
        c.setFillColor(INK)
        c.setFont(SANS_BOLD, 10.2)
        c.drawString(x - 7, 88, title)
        c.setFillColor(INK_400)
        c.setFont(MONO, 7.2)
        c.drawString(x - 7, 72, action.upper())


def page_07_reconciliation(c: canvas.Canvas) -> None:
    begin_page(c, 7, "Cross-channel reconciliation", True, sample=True)
    draw_kicker(c, "One money view", 56, 482, True)
    draw_title(c, "The platforms can disagree. Your decision still cannot.", 56, 445, 630, True, size=34, leading=36)
    draw_paragraph(
        c,
        "Provider-reported values remain inspectable. HELM maps only compatible purchase events to a common illustrative 7-day-click basis, publishes freshness and exclusions, and declines invalid blended totals.",
        56,
        360,
        520,
        size=12.2,
        leading=18,
        color=NIGHT_MUTED,
    )
    cards = [
        ("GOOGLE ADS READS", "1,356", "Primary Purchase / provider view", HELM),
        ("META ADS READS", "1,104", "Purchase / provider view", IRIS),
        ("HELM MAPPED VIEW", "2,268", "Purchases / common basis", PEACH_STRONG),
    ]
    x_positions = [56, 332, 650]
    widths = [236, 236, 254]
    for i, ((label, value, note, accent), x, w) in enumerate(zip(cards, x_positions, widths)):
        c.setFillColor(NIGHT_2 if i < 2 else NIGHT_3)
        c.setStrokeColor(Color(1, 1, 1, 0.14) if i < 2 else Color(0.49, 0.36, 1, 0.65))
        c.roundRect(x, 170, w, 132, 10, stroke=1, fill=1)
        c.setFillColor(accent)
        c.circle(x + 20, 276, 4, stroke=0, fill=1)
        draw_tracking_text(c, label, x + 32, 271, MONO_BOLD, 7.2, 0.55, NIGHT_FAINT if i < 2 else HexColor("#C3B8FF"))
        c.setFillColor(NIGHT_INK)
        c.setFont(SANS_BOLD, 29)
        c.drawString(x + 20, 225, value)
        c.setFillColor(NIGHT_MUTED)
        c.setFont(SANS, 9.8)
        c.drawString(x + 20, 197, note)
        if i < 2:
            draw_arrow(c, x + w + 6, 236, x + w + 32, 236, Color(0.66, 0.72, 1, 0.55))
    c.setFillColor(Color(1, 1, 1, 0.06))
    c.roundRect(56, 78, 848, 55, 8, stroke=0, fill=1)
    draw_tracking_text(c, "VISIBLE BASIS", 74, 111, MONO_BOLD, 7.2, 0.6, NIGHT_FAINT)
    c.setFont(SANS, 10.2)
    c.setFillColor(NIGHT_MUTED)
    c.drawString(74, 91, "INR / Asia/Kolkata / 25 Jul - 23 Aug 2026 / current partial day excluded / delayed and incompatible accounts separated")


def page_08_briefing(c: canvas.Canvas) -> None:
    begin_page(c, 8, "Morning Briefing", False, sample=True)
    draw_kicker(c, "Morning Briefing", 52, 487, False)
    draw_title(c, "A brief built around what deserves attention.", 52, 451, 520, False, size=29, leading=31)
    draw_paragraph(
        c,
        "One scoreline, visible caveats and a decision-first hierarchy replace the usual wall of disconnected KPI cards.",
        625,
        454,
        280,
        size=10.8,
        leading=15.5,
        color=INK_500,
    )
    c.setFillColor(SURFACE)
    c.setStrokeColor(LINE)
    c.roundRect(52, 69, 856, 342, 9, stroke=1, fill=1)
    draw_image_cover(c, IMG["briefing"], 53, 70, 854, 340, focal=(0.5, 0.48), radius=8)
    points = [(347, 292), (586, 290), (758, 290), (318, 143)]
    for i, (x, y) in enumerate(points, start=1):
        c.setFillColor(PEACH if i == 4 else HELM)
        c.circle(x, y, 8.5, stroke=0, fill=1)
        c.setFillColor(SURFACE)
        c.setFont(MONO_BOLD, 6.8)
        c.drawCentredString(x, y - 2.3, str(i))
    legends = ["Scope + freshness", "Definitions + deltas", "Unavailable is explicit", "Partial data disclosed first"]
    for i, legend in enumerate(legends):
        x = 57 + i * 210
        c.setFont(SANS, 8.4)
        c.setFillColor(INK_500)
        c.drawString(x, 45, f"{i+1:02d}  {legend}")


def page_09_movement(c: canvas.Canvas) -> None:
    begin_page(c, 9, "Performance movement", False, sample=True)
    draw_kicker(c, "Performance movement", 52, 487, False)
    draw_title(c, "Movement becomes a narrative, not another chart.", 52, 451, 680, False, size=31)
    draw_paragraph(
        c,
        "Material changes are annotated directly on the series, placing budget shifts, creative refreshes, rising frequency and capacity constraints beside the movement they help explain.",
        52,
        407,
        830,
        size=10.8,
        leading=15.5,
        color=INK_500,
    )
    c.setFillColor(SURFACE)
    c.setStrokeColor(LINE)
    c.roundRect(52, 80, 856, 300, 9, stroke=1, fill=1)
    draw_image_cover(c, IMG["performance"], 53, 81, 854, 298, focal=(0.5, 0.45), radius=8)
    events = [
        ("29 JUL", "Creative refresh", GOOD),
        ("04 AUG", "Budget raised 40%", WARN),
        ("11 AUG", "Frequency crossed 4.0", WARN),
        ("17 AUG", "High Intent budget constraint", BAD),
    ]
    for i, (date, label, tone) in enumerate(events):
        x = 56 + i * 211
        c.setFillColor(tone)
        c.circle(x + 4, 53, 3, stroke=0, fill=1)
        draw_tracking_text(c, date, x + 14, 49, MONO_BOLD, 7.0, 0.45, INK_400)
        c.setFillColor(INK_700)
        c.setFont(SANS, 8.5)
        c.drawString(x + 14, 35, label)


def page_10_signals(c: canvas.Canvas) -> None:
    begin_page(c, 10, "Illustrative decision story - signals", False, sample=True)
    draw_kicker(c, "Illustrative decision story / What changed", 52, 487, False)
    draw_title(c, "A budget increase met a tired creative.", 52, 451, 610, False, size=33)
    draw_paragraph(
        c,
        "The decision does not come from one metric. HELM connects delivery, efficiency, creative repetition and available capacity across the selected accounts.",
        52,
        407,
        820,
        size=11.2,
        leading=16,
        color=INK_500,
    )
    stats = [
        ("DAILY BUDGET", "+40%", "Broad 04 / 4 Aug", WARN),
        ("CPA MOVEMENT", "+31%", "₹1,869 to ₹2,449", BAD),
        ("FREQUENCY", "3.2 to 4.8", "Creative repetition", IRIS),
    ]
    for i, (label, value, note, tone) in enumerate(stats):
        draw_stat(c, 52 + i * 195, 264, 178, label, value, note, tone)
    c.setFillColor(SURFACE)
    c.setStrokeColor(LINE)
    c.roundRect(638, 176, 270, 188, 9, stroke=1, fill=1)
    draw_image_contain(c, IMG["campaign_detail"], 639, 177, 268, 186, radius=8, background=SURFACE)
    draw_card(c, 52, 154, 273, 82, "Creative signal", "The leading creative's 3-second view rate fell from 32% to 24% as frequency climbed.", dark=False, accent=IRIS)
    draw_card(c, 344, 154, 273, 82, "Capacity signal", "Google High Intent held a ₹1,733 CPA while losing 18% of eligible impressions to budget.", dark=False, accent=HELM)
    draw_card(c, 638, 70, 270, 79, "Comparison basis", "25 Jul - 23 Aug 2026 versus the previous 30 complete days.", dark=False, accent=GOOD)


def page_11_action(c: canvas.Canvas) -> None:
    begin_page(c, 11, "Illustrative decision story - proposed action", True, sample=True)
    draw_kicker(c, "Illustrative decision story / Proposed action", 56, 482, True)
    draw_title(c, "HELM proposes a test - not a verdict.", 56, 444, 640, True, size=35)
    draw_paragraph(
        c,
        "Shift up to ₹1,20,000 from Meta Prospecting / Broad 04 into Google Non-Brand / High Intent for 14 days.",
        56,
        391,
        720,
        size=14.2,
        leading=21,
        color=NIGHT_MUTED,
    )
    c.setFillColor(Color(0.06, 0.07, 0.13, 0.94))
    c.setStrokeColor(Color(0.49, 0.36, 1, 0.58))
    c.roundRect(56, 174, 848, 160, 12, stroke=1, fill=1)
    c.setFillColor(PEACH)
    c.roundRect(74, 284, 214, 30, 7, stroke=0, fill=1)
    draw_tracking_text(c, "PROPOSED / NOT EXECUTED", 90, 294, MONO_BOLD, 7.1, 0.55, INK)
    c.setFillColor(NIGHT_INK)
    c.setFont(SANS_BOLD, 18)
    c.drawString(78, 244, "Meta Prospecting / Broad 04")
    draw_arrow(c, 330, 246, 430, 246, Color(0.66, 0.72, 1, 0.68), 1.5)
    c.drawString(466, 244, "Google Non-Brand / High Intent")
    for x, label, value in [
        (78, "CAP", "₹1,20,000"),
        (342, "HORIZON", "14 days"),
        (606, "MODELLED RANGE", "₹42k - ₹68k"),
    ]:
        draw_tracking_text(c, label, x, 205, MONO_BOLD, 7.2, 0.55, NIGHT_FAINT)
        c.setFillColor(NIGHT_INK if label != "MODELLED RANGE" else PEACH)
        c.setFont(font_for_text(SANS_BOLD, value), 15)
        c.drawString(x, 182, value)
    c.setFont(SANS_BOLD, 11.5)
    c.setFillColor(NIGHT_INK)
    c.drawString(56, 133, "Named stop conditions")
    stops = [
        "High Intent CPA exceeds ₹1,900 on a 3-day rolling basis.",
        "Impression share lost to budget falls below 4% before the cap is reached.",
        "Blended purchases fall more than 8% against the trailing two weeks.",
    ]
    for i, stop in enumerate(stops):
        x = 56 + i * 284
        c.setFillColor(PEACH_STRONG)
        c.circle(x + 4, 99, 3.2, stroke=0, fill=1)
        draw_paragraph(c, stop, x + 16, 104, 250, size=9.2, leading=13, color=NIGHT_MUTED)
    c.setFont(SANS, 7.7)
    c.setFillColor(NIGHT_FAINT)
    c.drawString(56, 38, "Modelled sample output, not a forecast or guarantee. View-through effects, saturation past the cap and revenue impact are excluded.")


def page_12_investigations(c: canvas.Canvas) -> None:
    begin_page(c, 12, "Investigations", False, sample=True)
    draw_kicker(c, "Investigations", 52, 487, False)
    draw_title(c, "Begin with intent, not a blank prompt.", 52, 450, 250, False, size=31, leading=34)
    draw_paragraph(
        c,
        "The investigation surface inherits workspace, account scope, range, comparison and freshness before work begins.",
        52,
        360,
        235,
        size=11.4,
        leading=17,
        color=INK_500,
    )
    draw_tracking_text(c, "NAMED RUN STAGES", 52, 284, MONO_BOLD, 7.5, 0.65, HELM_DARK)
    stages = ["Queued", "Collecting evidence", "Analyzing", "Reviewing", "Waiting for decision", "Complete"]
    y = 255
    for i, stage in enumerate(stages):
        c.setFillColor(HELM if i < 4 else (WARN if i == 4 else GOOD))
        c.circle(58, y + 2, 3.2, stroke=0, fill=1)
        c.setFillColor(INK_700)
        c.setFont(SANS, 9.7)
        c.drawString(70, y - 2, stage)
        if i < len(stages) - 1:
            c.setStrokeColor(LINE_STRONG)
            c.line(58, y - 8, 58, y - 21)
        y -= 31
    c.setFillColor(SURFACE)
    c.setStrokeColor(LINE)
    c.roundRect(318, 56, 590, 426, 11, stroke=1, fill=1)
    draw_image_cover(c, IMG["investigation"], 319, 57, 588, 424, focal=(0.5, 0.5), radius=10)


def page_13_anatomy(c: canvas.Canvas) -> None:
    begin_page(c, 13, "Finding-to-decision anatomy", True)
    draw_kicker(c, "Decision anatomy", 56, 482, True)
    draw_title(c, "An opinion is useful only when it can be checked.", 56, 444, 740, True, size=34)
    draw_paragraph(
        c,
        "HELM separates observation, evidence and recommendation so every step can be inspected and challenged.",
        56,
        392,
        680,
        size=12.2,
        leading=18,
        color=NIGHT_MUTED,
    )
    items = [
        ("Finding", "A precise observation, financial exposure, source accounts, time window, comparison, evidence class, confidence and caveats.", HELM),
        ("Evidence", "Reported or derived values, metric definition, disclosed formula, source account, freshness, exclusions and a chart or table.", IRIS),
        ("Recommendation", "Affected campaigns, rationale, expected direction or range, assumptions, risk, urgency, effort, stop conditions and review state.", PEACH_STRONG),
    ]
    for i, (title, body, accent) in enumerate(items):
        draw_card(c, 56 + i * 288, 181, 264, 162, title, body, dark=True, accent=accent, index=f"0{i+1}")
    classes = [
        ("OBSERVED", "Directly present in source data."),
        ("CALCULATED", "Derived through a disclosed formula."),
        ("INFERRED", "A judgment drawn from several signals."),
    ]
    for i, (label, body) in enumerate(classes):
        x = 56 + i * 288
        c.setFillColor(Color(1, 1, 1, 0.06))
        c.roundRect(x, 86, 264, 58, 8, stroke=0, fill=1)
        draw_tracking_text(c, label, x + 14, 119, MONO_BOLD, 7.2, 0.55, [HELM_SOFT, HexColor("#C3B8FF"), PEACH][i])
        c.setFont(SANS, 8.9)
        c.setFillColor(NIGHT_MUTED)
        c.drawString(x + 14, 99, body)


def page_14_metrics(c: canvas.Canvas) -> None:
    begin_page(c, 14, "Metric integrity", False)
    draw_kicker(c, "Metric integrity", 52, 487, False)
    draw_title(c, "HELM refuses the convenient wrong answer.", 52, 451, 680, False, size=32)
    draw_paragraph(
        c,
        "A decision layer earns trust by naming what a metric is, where it came from and what it cannot support.",
        52,
        408,
        720,
        size=11.7,
        leading=17,
        color=INK_500,
    )
    rows = [
        ("CPA", "Media cost per mapped purchase; not automatically customer acquisition cost."),
        ("Attributed value", "Platform-reported conversion value; not audited revenue."),
        ("Clicks", "Link clicks and all clicks remain distinct definitions."),
        ("Reach", "A people-oriented estimate; not interchangeable with impressions."),
        ("Conversion basis", "Google and Meta events remain inspectable before a mapped view is shown."),
        ("Derived metrics", "Every formula is disclosed, including 3-second view rate and hold rate."),
        ("Currency", "Cross-currency totals remain unavailable without a named conversion basis."),
        ("Availability", "Unsupported values are shown as Not available, never estimated."),
    ]
    x_positions = [52, 480]
    for i, (label, body) in enumerate(rows):
        col, row = i // 4, i % 4
        x = x_positions[col]
        y = 333 - row * 74
        c.setFillColor(SURFACE)
        c.setStrokeColor(LINE)
        c.roundRect(x, y, 408, 60, 8, stroke=1, fill=1)
        c.setFillColor(HELM if col == 0 else IRIS)
        c.rect(x, y, 3.5, 60, stroke=0, fill=1)
        c.setFillColor(INK)
        c.setFont(SANS_BOLD, 10.8)
        c.drawString(x + 16, y + 36, label)
        draw_paragraph(c, body, x + 116, y + 40, 276, size=8.7, leading=12.2, color=INK_500, max_lines=2)


def page_15_campaigns(c: canvas.Canvas) -> None:
    begin_page(c, 15, "Campaign and creative intelligence", False, sample=True)
    draw_kicker(c, "Campaign and creative intelligence", 52, 487, False)
    draw_title(c, "Media and creative belong in the same line of sight.", 52, 451, 720, False, size=31)
    draw_paragraph(
        c,
        "The explorer moves from a cross-channel portfolio view into a durable campaign record. Creative repetition, view behavior, spend share and cost per purchase stay connected to commercial consequence.",
        52,
        407,
        830,
        size=10.8,
        leading=15.5,
        color=INK_500,
    )
    c.setFillColor(SURFACE)
    c.setStrokeColor(LINE)
    c.roundRect(52, 171, 548, 210, 9, stroke=1, fill=1)
    draw_image_contain(c, IMG["campaigns"], 53, 194, 546, 186, radius=8, background=SURFACE)
    draw_tracking_text(c, "PORTFOLIO VIEW", 66, 180, MONO_BOLD, 7.0, 0.55, INK_400)
    c.roundRect(620, 171, 288, 210, 9, stroke=1, fill=1)
    draw_image_contain(c, IMG["campaign_detail"], 621, 194, 286, 186, radius=8, background=SURFACE)
    draw_tracking_text(c, "CAMPAIGN VIEW", 634, 180, MONO_BOLD, 7.0, 0.55, INK_400)
    callouts = [
        ("Cross-channel explorer", "Search, platform, status, level and sortable commercial metrics."),
        ("Durable campaign record", "Overview, Ads & Creative and Intelligence remain linked to one campaign."),
        ("Creative consequence", "Frequency and view behavior are interpreted alongside spend and CPA."),
    ]
    for i, (title, body) in enumerate(callouts):
        draw_card(c, 52 + i * 288, 67, 264, 78, title, body, dark=False, accent=[HELM, IRIS, PEACH_STRONG][i])


def page_16_connections(c: canvas.Canvas) -> None:
    begin_page(c, 16, "Connections", False, sample=True)
    draw_kicker(c, "Connections", 52, 487, False)
    draw_title(c, "Read what matters. Change nothing by default.", 52, 451, 700, False, size=31)
    draw_paragraph(
        c,
        "Identity, readable data, account selection, health and freshness are explicit. Provider access and operational controls remain separate decisions.",
        52,
        407,
        830,
        size=10.8,
        leading=15.5,
        color=INK_500,
    )
    c.setFillColor(SURFACE)
    c.setStrokeColor(LINE)
    c.roundRect(52, 88, 856, 294, 9, stroke=1, fill=1)
    draw_image_cover(c, IMG["connections"], 53, 89, 854, 292, focal=(0.5, 0.46), radius=8)
    labels = [
        ("01", "Readable capabilities"),
        ("02", "Explicit non-permissions"),
        ("03", "Health + freshness"),
        ("04", "Disconnect is not deletion"),
    ]
    for i, (index, label) in enumerate(labels):
        x = 56 + i * 211
        c.setFillColor(HELM_SOFT if i < 3 else PEACH)
        c.roundRect(x, 44, 198, 25, 6, stroke=0, fill=1)
        c.setFillColor(INK)
        c.setFont(MONO_BOLD, 7.1)
        c.drawString(x + 10, 53, index)
        c.setFont(SANS, 8.2)
        c.drawString(x + 35, 52, label)


def page_17_team(c: canvas.Canvas) -> None:
    begin_page(c, 17, "Team and workspace", False, sample=True)
    draw_kicker(c, "Team and workspace", 52, 487, False)
    draw_title(c, "One workspace. Clear responsibility.", 52, 450, 270, False, size=31, leading=34)
    draw_paragraph(
        c,
        "Membership, invitations and governance remain separate from daily media work. The interface represents four clear roles.",
        52,
        356,
        235,
        size=11.2,
        leading=16.5,
        color=INK_500,
    )
    roles = [
        ("Owner", "Workspace control"),
        ("Admin", "Membership + configuration"),
        ("Analyst", "Analysis + investigation"),
        ("Viewer", "Read access"),
    ]
    y = 267
    for i, (role, meaning) in enumerate(roles):
        c.setFillColor([HELM, IRIS, GOOD, INK_400][i])
        c.circle(59, y + 2, 4, stroke=0, fill=1)
        c.setFillColor(INK)
        c.setFont(SANS_BOLD, 10.2)
        c.drawString(72, y, role)
        c.setFillColor(INK_500)
        c.setFont(SANS, 8.8)
        c.drawString(137, y, meaning)
        y -= 36
    c.setFillColor(WARN_SOFT)
    c.roundRect(52, 85, 235, 54, 8, stroke=0, fill=1)
    c.setFillColor(WARN)
    c.setFont(SANS_BOLD, 9.5)
    c.drawString(66, 114, "Pending invitations remain visible")
    c.setFillColor(INK_500)
    c.setFont(SANS, 8.4)
    c.drawString(66, 98, "until accepted or withdrawn.")
    c.setFillColor(SURFACE)
    c.setStrokeColor(LINE)
    c.roundRect(318, 56, 590, 426, 10, stroke=1, fill=1)
    draw_image_cover(c, IMG["team"], 319, 57, 588, 424, focal=(0.53, 0.47), radius=9)


def page_18_security(c: canvas.Canvas) -> None:
    begin_page(c, 18, "Security and access", True, sample=True)
    draw_kicker(c, "Security and access", 52, 490, True)
    c.setFillColor(Color(1, 1, 1, 0.13))
    c.roundRect(50, 55, 860, 410, 10, stroke=0, fill=1)
    draw_image_contain(c, IMG["security"], 52, 57, 856, 406, radius=9, background=NIGHT)
    c.setFillColor(Color(0.03, 0.04, 0.07, 0.90))
    c.roundRect(52, 57, 856, 48, 0, stroke=0, fill=1)
    c.setFillColor(PEACH)
    c.rect(52, 57, 4, 48, stroke=0, fill=1)
    c.setFont(SANS_BOLD, 9.2)
    c.setFillColor(NIGHT_INK)
    c.drawString(70, 84, "PRODUCTION CONTROL NOTE")
    c.setFont(SANS, 8.6)
    c.setFillColor(NIGHT_MUTED)
    c.drawString(70, 68, "The screenshot presents the intended access model. Live identity and provider authorization are part of the production integration scope.")


def page_19_agency(c: canvas.Canvas) -> None:
    begin_page(c, 19, "Agency operating rhythm", True)
    draw_kicker(c, "Why this fits a marketing company", 56, 482, True)
    draw_title(c, "Built for the rhythm of an agency team.", 56, 444, 660, True, size=35)
    draw_paragraph(
        c,
        "HELM turns the daily sequence from observation to client-ready decision into one shared operating rhythm.",
        56,
        391,
        700,
        size=12.2,
        leading=18,
        color=NIGHT_MUTED,
    )
    stages = [
        ("Performance lead", "Open the Briefing", "See what deserves action."),
        ("Analyst", "Investigate", "Check movement, basis and evidence."),
        ("Creative strategist", "Translate", "Turn fatigue into the next test."),
        ("Account lead / CMO", "Decide", "Review assumptions, risk and range."),
        ("Workspace owner", "Govern", "Keep access, connections and audit clear."),
    ]
    y = 280
    for i, (role, action, outcome) in enumerate(stages):
        x = 58 + i * 170
        c.setFillColor([HELM, IRIS, HexColor("#A9BDFF"), PEACH_STRONG, GOOD][i])
        c.circle(x + 8, y, 7, stroke=0, fill=1)
        if i < len(stages) - 1:
            draw_arrow(c, x + 18, y, x + 150, y, Color(0.65, 0.72, 1, 0.40), 1.0)
        draw_tracking_text(c, f"0{i+1}", x, y - 38, MONO_BOLD, 7.2, 0.55, NIGHT_FAINT)
        c.setFillColor(NIGHT_INK)
        c.setFont(SANS_BOLD, 10.5)
        c.drawString(x, y - 58, role)
        c.setFillColor([HELM_SOFT, HexColor("#C3B8FF"), HexColor("#C9D5FF"), PEACH, HexColor("#A7E5CF")][i])
        c.setFont(SANS_BOLD, 9.4)
        c.drawString(x, y - 78, action)
        draw_paragraph(c, outcome, x, y - 96, 148, size=8.8, leading=12.5, color=NIGHT_MUTED, max_lines=2)
    c.setFillColor(Color(1, 1, 1, 0.06))
    c.roundRect(56, 76, 848, 57, 8, stroke=0, fill=1)
    c.setFillColor(NIGHT_INK)
    c.setFont(SANS_BOLD, 12)
    c.drawString(74, 106, "The operational result")
    c.setFillColor(NIGHT_MUTED)
    c.setFont(SANS, 10.2)
    c.drawString(244, 106, "Less context rebuilding, more consistent client narratives and a clearer handoff from observation to action.")


def page_20_scope(c: canvas.Canvas) -> None:
    begin_page(c, 20, "Current product scope", False, sample=True)
    draw_kicker(c, "Current product scope", 52, 487, False)
    c.setFillColor(INK)
    c.setFont(SANS_BOLD, 30)
    c.drawString(52, 451, "A complete interface experience,")
    c.drawString(52, 419, "with a clear path to live operations.")
    left_x, right_x = 52, 497
    c.setFillColor(SURFACE)
    c.setStrokeColor(LINE)
    c.roundRect(left_x, 182, 411, 210, 10, stroke=1, fill=1)
    c.roundRect(right_x, 182, 411, 210, 10, stroke=1, fill=1)
    c.setFillColor(GOOD_SOFT)
    c.roundRect(left_x + 16, 350, 178, 25, 6, stroke=0, fill=1)
    draw_tracking_text(c, "DEMONSTRATED INTERFACE", left_x + 27, 359, MONO_BOLD, 7.1, 0.5, GOOD)
    c.setFillColor(HELM_SOFT)
    c.roundRect(right_x + 16, 350, 183, 25, 6, stroke=0, fill=1)
    draw_tracking_text(c, "PRODUCTION INTEGRATION", right_x + 27, 359, MONO_BOLD, 7.1, 0.5, HELM_DARK)
    current = [
        "Responsive public and authenticated product experience",
        "Briefing, Campaigns, Intelligence, Library and Settings",
        "Google and Meta multi-account scenarios",
        "Partial, stale, incompatible and unavailable data states",
        "Reviewable findings, evidence and recommendation states",
    ]
    future = [
        "Identity sessions and provider authorization callbacks",
        "Live Google Ads and Meta Ads synchronization",
        "Backend workspace authorization and persistent storage",
        "Persistent decisions, reports, exports and audit",
        "Campaign mutation and execution remain out of scope",
    ]
    for col_x, items, tone in [(left_x, current, GOOD), (right_x, future, HELM)]:
        y = 324
        for item in items:
            c.setFillColor(tone)
            c.circle(col_x + 24, y + 2, 3, stroke=0, fill=1)
            draw_paragraph(c, item, col_x + 36, y + 6, 350, size=9.1, leading=12.5, color=INK_700, max_lines=2)
            y -= 35
    c.setFillColor(SURFACE)
    c.setStrokeColor(LINE)
    c.roundRect(52, 62, 856, 94, 10, stroke=1, fill=1)
    c.setFillColor(PEACH)
    c.rect(52, 62, 4, 94, stroke=0, fill=1)
    c.setFillColor(INK)
    c.setFont(SANS_BOLD, 10.2)
    c.drawString(72, 131, "Demonstration disclosure")
    draw_paragraph(
        c,
        "The screens in this document show HELM's current interface using an illustrative Northstar Group workspace. Account names, IDs, dates, campaign events and performance figures are sample data. Live authentication, platform authorization, data synchronization, persistence and campaign execution are not part of the current build.",
        72,
        110,
        815,
        size=9.0,
        leading=13.2,
        color=INK_500,
        max_lines=4,
    )


def page_21_closing(c: canvas.Canvas) -> None:
    begin_page(c, 21, "Closing", False)
    c.setFillColor(NIGHT)
    c.rect(0, H - 43, W, 43, stroke=0, fill=1)
    c.setFillColor(CANVAS)
    c.rect(0, 0, W, H - 43, stroke=0, fill=1)
    draw_image_contain(c, IMG["closing"], 0, 42, W, 456, radius=0, background=CANVAS)
    c.setFillColor(CANVAS)
    c.rect(0, 0, W, 42, stroke=0, fill=1)
    draw_wordmark(c, 54, 18, dark=False, size=10)
    c.setFillColor(INK_500)
    c.setFont(SANS, 8.2)
    c.drawRightString(906, 17, "See what moved. Know what to move next.")


PAGES = [
    page_01_cover,
    page_02_promise,
    page_03_problem,
    page_04_model,
    page_05_context,
    page_06_product_map,
    page_07_reconciliation,
    page_08_briefing,
    page_09_movement,
    page_10_signals,
    page_11_action,
    page_12_investigations,
    page_13_anatomy,
    page_14_metrics,
    page_15_campaigns,
    page_16_connections,
    page_17_team,
    page_18_security,
    page_19_agency,
    page_20_scope,
    page_21_closing,
]


def build() -> None:
    register_fonts()
    missing = [str(path) for path in IMG.values() if not path.exists()]
    if missing:
        raise FileNotFoundError("Missing screenshot assets:\n" + "\n".join(missing))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUT), pagesize=(W, H), pageCompression=1)
    c.setTitle("HELM - The Decision Layer for Paid Media")
    c.setAuthor("HELM")
    c.setSubject("Comprehensive product overview for marketing and performance teams")
    c.setCreator("HELM")
    c._doc.info.producer = "HELM"
    for index, page in enumerate(PAGES):
        page(c)
        if index < len(PAGES) - 1:
            c.showPage()
    c.save()
    print(OUT)


if __name__ == "__main__":
    build()
