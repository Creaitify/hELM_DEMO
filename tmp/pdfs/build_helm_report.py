from __future__ import annotations

from pathlib import Path

from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    Image,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[2]
CAP = ROOT / "tmp" / "pdfs" / "captures"
OUT = ROOT / "output" / "pdf" / "HELM_Client_Product_Overview.pdf"

PAGE_W, PAGE_H = A4
MARGIN_X = 18 * mm
MARGIN_TOP = 19 * mm
MARGIN_BOTTOM = 18 * mm
CONTENT_W = PAGE_W - 2 * MARGIN_X

INK = HexColor("#111521")
TEXT = HexColor("#394255")
MUTED = HexColor("#6E778A")
INDIGO = HexColor("#3046CC")
INDIGO_SOFT = HexColor("#EEF1FF")
PEACH = HexColor("#FFF0EA")
GREEN = HexColor("#087B58")
GREEN_SOFT = HexColor("#EAF6F1")
AMBER = HexColor("#A4610A")
AMBER_SOFT = HexColor("#FFF6E7")
LINE = HexColor("#DDE1EA")
PAPER = HexColor("#FFFFFF")
SURFACE = HexColor("#F6F7FA")

FONT = "HelmReport"
FONT_BOLD = "HelmReportBold"
FONT_MONO = "HelmReportMono"

SHOTS = {
    "hero": CAP / "cover-signin.png",
    "briefing": CAP / "supplied-briefing.png",
    "performance": CAP / "supplied-performance.png",
    "investigation": CAP / "supplied-investigation.png",
    "connections": CAP / "supplied-connections.png",
    "team": CAP / "supplied-team.png",
    "security": CAP / "supplied-security.png",
    "closing": CAP / "supplied-closing.png",
}


def register_fonts() -> None:
    font_dir = Path(r"C:\Windows\Fonts")
    pdfmetrics.registerFont(TTFont(FONT, str(font_dir / "segoeui.ttf")))
    pdfmetrics.registerFont(TTFont(FONT_BOLD, str(font_dir / "segoeuib.ttf")))
    pdfmetrics.registerFont(TTFont(FONT_MONO, str(font_dir / "consola.ttf")))


register_fonts()

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(
    name="CoverKicker", fontName=FONT_MONO, fontSize=8.2, leading=11,
    textColor=INDIGO, spaceAfter=7, uppercase=True,
))
styles.add(ParagraphStyle(
    name="CoverTitle", fontName=FONT_BOLD, fontSize=30, leading=34,
    textColor=INK, spaceAfter=12,
))
styles.add(ParagraphStyle(
    name="CoverSub", fontName=FONT, fontSize=12.2, leading=18,
    textColor=TEXT, spaceAfter=16,
))
styles.add(ParagraphStyle(
    name="SectionKicker", fontName=FONT_MONO, fontSize=7.8, leading=10,
    textColor=INDIGO, spaceAfter=5,
))
styles.add(ParagraphStyle(
    name="H1Doc", fontName=FONT_BOLD, fontSize=23, leading=27,
    textColor=INK, spaceAfter=8,
))
styles.add(ParagraphStyle(
    name="H2Doc", fontName=FONT_BOLD, fontSize=14.5, leading=18,
    textColor=INK, spaceBefore=6, spaceAfter=5,
))
styles.add(ParagraphStyle(
    name="BodyDoc", fontName=FONT, fontSize=9.7, leading=14.2,
    textColor=TEXT, spaceAfter=7,
))
styles.add(ParagraphStyle(
    name="SmallDoc", fontName=FONT, fontSize=8.2, leading=11.6,
    textColor=MUTED, spaceAfter=5,
))
styles.add(ParagraphStyle(
    name="BulletDoc", fontName=FONT, fontSize=9.4, leading=13.5,
    textColor=TEXT, leftIndent=12, firstLineIndent=-7, bulletIndent=0,
    spaceAfter=4,
))
styles.add(ParagraphStyle(
    name="CalloutTitle", fontName=FONT_BOLD, fontSize=10, leading=13,
    textColor=INK, spaceAfter=3,
))
styles.add(ParagraphStyle(
    name="CalloutBody", fontName=FONT, fontSize=8.8, leading=12.3,
    textColor=TEXT,
))
styles.add(ParagraphStyle(
    name="TableHead", fontName=FONT_BOLD, fontSize=8.4, leading=11,
    textColor=INK,
))
styles.add(ParagraphStyle(
    name="TableCell", fontName=FONT, fontSize=8.2, leading=11.3,
    textColor=TEXT,
))
styles.add(ParagraphStyle(
    name="TableCellBold", fontName=FONT_BOLD, fontSize=8.4, leading=11.3,
    textColor=INK,
))
styles.add(ParagraphStyle(
    name="Caption", fontName=FONT, fontSize=7.4, leading=10.5,
    textColor=MUTED, alignment=TA_LEFT, spaceBefore=4, spaceAfter=10,
))
styles.add(ParagraphStyle(
    name="CenterSmall", fontName=FONT, fontSize=8.5, leading=12,
    textColor=TEXT, alignment=TA_CENTER,
))


def p(text: str, style: str = "BodyDoc") -> Paragraph:
    return Paragraph(text, styles[style])


def bullet(text: str) -> Paragraph:
    return Paragraph(f"- {text}", styles["BulletDoc"])


def screenshot(path: Path, max_height: float = 270) -> Table:
    with PILImage.open(path) as im:
        iw, ih = im.size
    width = CONTENT_W
    height = width * ih / iw
    if height > max_height:
        height = max_height
        width = height * iw / ih
    image = Image(str(path), width=width, height=height)
    frame = Table([[image]], colWidths=[width + 8], rowHeights=[height + 8])
    frame.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PAPER),
        ("BOX", (0, 0), (-1, -1), 0.7, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ]))
    return frame


def info_band(items: list[tuple[str, str]], fills: list[colors.Color] | None = None) -> Table:
    fills = fills or [SURFACE] * len(items)
    row = []
    for title, body in items:
        row.append([p(title, "CalloutTitle"), p(body, "CalloutBody")])
    cells = [Table([[cell[0]], [cell[1]]], colWidths=[CONTENT_W / len(items) - 18]) for cell in row]
    outer = Table([cells], colWidths=[CONTENT_W / len(items)] * len(items))
    commands = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOX", (0, 0), (-1, -1), 0.6, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.6, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
    ]
    for idx, fill in enumerate(fills):
        commands.append(("BACKGROUND", (idx, 0), (idx, 0), fill))
    outer.setStyle(TableStyle(commands))
    return outer


def section_page(kicker: str, title: str, lead: str, shot_key: str, caption: str, bullets: list[str], callouts=None):
    flow = [
        p(kicker.upper(), "SectionKicker"),
        p(title, "H1Doc"),
        p(lead, "BodyDoc"),
        Spacer(1, 4),
        screenshot(SHOTS[shot_key]),
        p(caption, "Caption"),
    ]
    if callouts:
        flow.extend([info_band(callouts), Spacer(1, 8)])
    flow.extend(bullet(item) for item in bullets)
    flow.append(PageBreak())
    return flow


def table(data, widths, header=True) -> Table:
    rows = []
    for r, row in enumerate(data):
        style = "TableHead" if header and r == 0 else "TableCell"
        rows.append([p(str(cell), style) for cell in row])
    t = Table(rows, colWidths=widths, repeatRows=1 if header else 0)
    cmds = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.45, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]
    if header:
        cmds += [("BACKGROUND", (0, 0), (-1, 0), HexColor("#EEF0F5"))]
    for r in range(1 if header else 0, len(rows)):
        if r % 2 == 0:
            cmds.append(("BACKGROUND", (0, r), (-1, r), HexColor("#FAFAFC")))
    t.setStyle(TableStyle(cmds))
    return t


def header_footer(c, doc):
    page = doc.page
    c.saveState()
    if page > 1:
        c.setStrokeColor(LINE)
        c.setLineWidth(0.5)
        c.line(MARGIN_X, PAGE_H - 13 * mm, PAGE_W - MARGIN_X, PAGE_H - 13 * mm)
        c.setFont(FONT_BOLD, 8)
        c.setFillColor(INK)
        c.drawString(MARGIN_X, PAGE_H - 10.2 * mm, "HELM")
        c.setFont(FONT_MONO, 6.8)
        c.setFillColor(MUTED)
        c.drawRightString(PAGE_W - MARGIN_X, PAGE_H - 10.2 * mm, "CLIENT PRODUCT BRIEF")
    c.setStrokeColor(LINE)
    c.line(MARGIN_X, 12 * mm, PAGE_W - MARGIN_X, 12 * mm)
    c.setFont(FONT, 7.1)
    c.setFillColor(MUTED)
    c.drawString(MARGIN_X, 8.4 * mm, "Illustrative product interface and sample workspace")
    c.drawRightString(PAGE_W - MARGIN_X, 8.4 * mm, f"{page:02d}")
    c.restoreState()


def build_story():
    story = []

    # Cover
    story += [
        Spacer(1, 13 * mm),
        p("HELM / CLIENT PRODUCT BRIEF", "CoverKicker"),
        p("The decision layer for paid media", "CoverTitle"),
        p("A comprehensive overview for marketing companies, agency teams and performance leaders evaluating HELM as their operating system for cross-channel paid-media decisions.", "CoverSub"),
        screenshot(SHOTS["hero"], max_height=250),
        p("HELM brings Google Ads and Meta Ads into one reviewable decision context. The interface shown throughout this report uses an illustrative Northstar Group workspace and sample performance data.", "Caption"),
        Spacer(1, 8),
        info_band([
            ("One decision context", "Account scope, date range, freshness, currency and comparison remain visible."),
            ("Evidence before action", "Every finding keeps its basis, exclusions, confidence and source context attached."),
            ("Human control", "Recommendations are bounded proposals. HELM does not silently execute account changes."),
        ], [INDIGO_SOFT, SURFACE, PEACH]),
        PageBreak(),
    ]

    # Executive overview
    story += [
        p("EXECUTIVE OVERVIEW", "SectionKicker"),
        p("What HELM is", "H1Doc"),
        p("HELM is a paid-media decision system for brands, agencies and performance teams managing Google Ads and Meta Ads. It replaces fragmented reporting and repeated manual analysis with a single operating view built around what changed, why it matters and what decision should happen next.", "BodyDoc"),
        p("The operating problem", "H2Doc"),
        bullet("Platform dashboards use different event definitions, attribution windows, account structures and reporting rhythms."),
        bullet("Teams spend valuable review time rebuilding context before they can discuss the actual decision."),
        bullet("Recommendations are often separated from the evidence, assumptions and exclusions that produced them."),
        p("The HELM response", "H2Doc"),
        table([
            ["Stage", "What HELM does", "What the client receives"],
            ["Signal", "Preserves provider identity, account hierarchy and source values.", "A reliable starting point."],
            ["Discrepancy", "Surfaces differences in definitions, freshness and compatibility.", "Visible limits and caveats."],
            ["Evidence", "Attaches the exact window, comparison, formula, source and exclusions.", "A decision that can be checked."],
            ["Recommendation", "Proposes a bounded action with assumptions, risk and stop conditions.", "A practical next move."],
            ["Human decision", "Supports review, revision, approval, saving or dismissal.", "Clear accountability."],
        ], [70, 235, 190]),
        Spacer(1, 12),
        p("Designed for agency work", "H2Doc"),
        info_band([
            ("Performance lead", "Opens the daily Briefing and identifies what deserves action."),
            ("Analyst", "Investigates movement, validates basis and checks evidence."),
            ("Account lead or CMO", "Reviews assumptions, risk and the proposed next step."),
        ], [SURFACE, SURFACE, SURFACE]),
        PageBreak(),
    ]

    story += section_page(
        "01 / Morning Briefing",
        "A daily brief built around what deserves attention",
        "The Briefing is the operating front door: one scoreline, one visible data-quality state and one ordered list of decisions.",
        "briefing",
        "Figure 1. Morning Briefing with scoreline metrics, comparison deltas and an explicit partial-data notice.",
        [
            "The scoreline covers spend, attributed value, ROAS, CPA, purchases and availability of new-customer reporting.",
            "Definitions sit beside the metrics so conversion value is not confused with audited revenue and CPA is not presented as CAC.",
            "If an account is stale or incomplete, HELM separates it from blended totals and explains the exclusion before showing findings.",
            "Priority findings are grouped by whether they need a decision, deserve watching or are working as expected.",
        ],
    )

    story += section_page(
        "02 / Performance movement",
        "Movement becomes a narrative, not another chart",
        "HELM annotates the series with the events that help explain the change, turning a time series into a reviewable decision trail.",
        "performance",
        "Figure 2. Spend movement with direct annotations for budget changes, creative refreshes, frequency pressure and budget constraints.",
        [
            "Users can switch between spend, attributed value, ROAS, CPA and purchases while keeping the same comparison basis.",
            "Material changes are attached to the dates on which they occurred rather than hidden in a separate legend or commentary thread.",
            "Supporting diagnostics connect spend allocation, impression-share constraints and creative repetition to the same review window.",
        ],
    )

    story += section_page(
        "03 / Investigations",
        "Start with intent, not a blank prompt",
        "Investigations inherit account scope, date range, comparison and freshness before the work begins.",
        "investigation",
        "Figure 3. Intent-led investigation launcher for performance diagnosis, weekly review, budget reallocation and creative fatigue.",
        [
            "Named investigation paths reduce ambiguity and make the expected output clear before the run starts.",
            "A custom question remains available, but it is still grounded in the connected accounts and active scope.",
            "Runs move through explicit stages such as queued, collecting evidence, analyzing, reviewing, waiting for decision and complete.",
            "The resulting memo keeps findings, evidence, recommendation, decision notes and sources together as one durable record.",
        ],
    )

    story += section_page(
        "04 / Connections",
        "Readable access is explicit. Account changes are not implied.",
        "The Connections ledger separates identity, accessible accounts, selected scope, freshness and read permissions from operational authority.",
        "connections",
        "Figure 4. Google Ads and Meta Ads connection states, account selection, freshness and read-only boundaries.",
        [
            "Google access covers campaign, ad group, keyword and ad performance, daily delivery metrics and conversion-action definitions.",
            "Meta access covers campaign, ad-set and ad performance, daily spend, reach, frequency, purchases and creative engagement.",
            "The interface explicitly states what HELM never does, including changing budgets, bids, delivery or campaign status in the experience shown.",
            "Pause, disconnect and stored-history deletion remain separate and deliberate controls.",
        ],
    )

    story += section_page(
        "05 / Team and governance",
        "One workspace. Clear responsibility.",
        "Membership, invitation status and governance remain separate from daily performance work.",
        "team",
        "Figure 5. Workspace team directory with Owner, Admin, Analyst and Viewer roles plus pending invitations.",
        [
            "Owners control the workspace and its highest-risk settings.",
            "Admins manage membership and configuration; Analysts conduct analysis and investigations; Viewers retain read access.",
            "Pending invitations stay visible until accepted or withdrawn.",
            "An audit surface is designed to preserve actor, action, target, context and time for governance review.",
        ],
    )

    story += section_page(
        "06 / Security and access",
        "When HELM has an opinion, it carries receipts",
        "The security model is designed around read-only access, separate authorizations, explicit disconnection and workspace-scoped membership.",
        "security",
        "Figure 6. Public security and access explanation presented in the supplied HELM interface.",
        [
            "Work identity and provider authorization are treated as separate grants.",
            "Connecting an ad account is designed to grant reporting access only; it does not imply permission to change delivery.",
            "Disconnecting stops future synchronization, while deleting stored history is a separate confirmed action.",
            "Recommendations publish the accounts read, exact window, exclusions, confidence and supporting evidence.",
        ],
    )

    story += section_page(
        "07 / Product position",
        "The next decision should not begin with six tabs",
        "HELM consolidates scope, movement, evidence and decision records without erasing provider-level context.",
        "closing",
        "Figure 7. Closing product statement and access points for the HELM experience.",
        [
            "The objective is not simply fewer screens; it is less context rebuilding before each commercial decision.",
            "The product keeps Google Ads and Meta Ads visible as distinct sources while providing a shared decision basis where valid.",
            "Read-only connections remain the default posture throughout the experience.",
        ],
    )

    # Agent fleet
    story += [
        p("INTERNAL OPERATING ARCHITECTURE", "SectionKicker"),
        p("Agent fleet", "H1Doc"),
        p("HELM uses a fixed specialist roster with a fixed review order. The user speaks to HELM; the specialist stages operate behind the workflow. Every specialist output must pass a grounding and quality gate before it can advance.", "BodyDoc"),
        table([
            ["Fleet member", "Responsibility", "Control"],
            ["HELM Orchestrator", "Reads the request, establishes context, plans the run, routes work and presents the final response.", "The single user-facing coordinator."],
            ["Analyst", "Turns stored performance context into findings, risks, opportunities and ranked actions.", "Claims must be grounded in stored figures."],
            ["Reviewer", "Scores each specialist output for quality and grounding, then approves, revises or blocks it.", "Unapproved work cannot advance."],
            ["Creative", "Translates approved analysis into strategy, copy directions and visual briefs.", "Runs only after analysis approval."],
            ["Image generation", "Renders approved visual briefs into finished creative assets.", "Runs only after direction approval."],
            ["Media Buyer", "Represents a possible controlled account-execution role.", "Disabled in the current release; HELM does not change the ad account."],
        ], [105, 250, 140]),
        Spacer(1, 12),
        p("Why the fixed fleet matters", "H2Doc"),
        info_band([
            ("Predictable ownership", "Each stage has one defined responsibility and a known output."),
            ("Grounded decisions", "The reviewer checks that claims map back to the supplied context."),
            ("Bounded progression", "A stage advances only after its required approval is satisfied."),
        ], [INDIGO_SOFT, GREEN_SOFT, AMBER_SOFT]),
        Spacer(1, 12),
        bullet("Progress is derived from stored workflow steps; the interface does not invent activity or completion."),
        bullet("Revision loops are bounded. If required quality or grounding is not reached, the workflow blocks and reports the unresolved issues."),
        bullet("The fleet is an internal operating architecture, not a substitute for the client-facing evidence and decision record."),
        PageBreak(),
    ]

    story += [
        p("AGENT WORKFLOW", "SectionKicker"),
        p("How one request becomes a reviewed output", "H1Doc"),
        p("The workflow separates analysis, review, creative development and rendering so the output can be inspected at every meaningful boundary.", "BodyDoc"),
        table([
            ["Step", "Owner", "Input", "Output / gate"],
            ["1. Context", "HELM Orchestrator", "User request, workspace, scope, range and freshness", "A defined workflow plan"],
            ["2. Analysis", "Analyst", "Stored campaign context and supplied documents", "Findings, ranked actions and confidence"],
            ["3. Analysis review", "Reviewer", "Analysis and claimed context", "Approve, request revision or block"],
            ["4. Creative strategy", "Creative", "Approved analysis and brand documents", "Strategy, copy variants and visual briefs"],
            ["5. Creative review", "Reviewer", "Creative output and approved context", "Approve, request revision or block"],
            ["6. Rendering", "Image generation", "Approved solution-document briefs", "Creative assets for review"],
            ["7. Final review", "Reviewer and human owner", "Assets, evidence and decision context", "Accepted output or documented changes"],
        ], [62, 98, 157, 178]),
        Spacer(1, 14),
        p("Operating safeguards", "H2Doc"),
        bullet("Specialists do not communicate independently with the client; HELM maintains one coherent response and one visible decision trail."),
        bullet("Every recommendation remains a proposal until a named human decision is recorded."),
        bullet("The current product experience is read-only. Campaign mutation, budget changes and bid execution remain out of scope."),
        bullet("Provider, model and rendering choices are implementation details and can change without changing the client workflow."),
        Spacer(1, 12),
        info_band([
            ("Evidence", "What was read, calculated or inferred remains visible."),
            ("Review", "Quality and grounding are checked before work advances."),
            ("Control", "A human remains responsible for the commercial decision."),
        ], [SURFACE, SURFACE, SURFACE]),
        PageBreak(),
    ]

    # Scope and closing
    story += [
        p("CURRENT SCOPE", "SectionKicker"),
        p("What the supplied product experience demonstrates", "H1Doc"),
        table([
            ["Demonstrated interface", "Production integration required"],
            ["Responsive public and authenticated product surfaces", "Live identity sessions and provider authorization callbacks"],
            ["Briefing, Campaigns, Intelligence, Library and Settings", "Live Google Ads and Meta Ads synchronization"],
            ["Multi-account Google and Meta scenarios", "Backend workspace authorization and persistent storage"],
            ["Partial, stale, incompatible and unavailable data states", "Persistent decisions, reports, exports and audit records"],
            ["Reviewable findings, evidence and recommendation states", "Operational monitoring, support and production controls"],
        ], [CONTENT_W / 2, CONTENT_W / 2]),
        Spacer(1, 14),
        p("Demonstration disclosure", "H2Doc"),
        p("The screens in this document show HELM's current interface using an illustrative Northstar Group workspace. Account names, IDs, dates, campaign events and performance figures are sample data. Live authentication, provider authorization, data synchronization, persistence and campaign execution are not part of the current build.", "BodyDoc"),
        p("Commercial fit for a marketing company", "H2Doc"),
        bullet("A consistent daily briefing for performance teams and account owners."),
        bullet("A shared evidence base for budget, efficiency and creative conversations."),
        bullet("Client-ready recommendations with visible assumptions, exclusions and stop conditions."),
        bullet("A durable record connecting the observation, investigation, decision and outcome."),
        Spacer(1, 18),
        info_band([
            ("HELM", "See what moved. Know what to move next."),
        ], [INDIGO_SOFT]),
    ]
    return story


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc = BaseDocTemplate(
        str(OUT), pagesize=A4,
        leftMargin=MARGIN_X, rightMargin=MARGIN_X,
        topMargin=MARGIN_TOP, bottomMargin=MARGIN_BOTTOM,
        title="HELM - Client Product Brief",
        author="HELM",
        subject="Client-facing product overview with interface screenshots and agent-fleet architecture",
        creator="HELM",
    )
    frame = Frame(
        MARGIN_X, MARGIN_BOTTOM,
        CONTENT_W, PAGE_H - MARGIN_TOP - MARGIN_BOTTOM,
        leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0,
    )
    doc.addPageTemplates(PageTemplate(id="Report", frames=[frame], onPageEnd=header_footer))
    doc.build(build_story())
    print(OUT)


if __name__ == "__main__":
    main()
