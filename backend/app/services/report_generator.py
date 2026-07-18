"""Report generator — court-ready PDF using ReportLab.

Combines: case summary, risk breakdown, chain, copilot narrative,
freeze recommendation.
"""
from __future__ import annotations
import io
from datetime import datetime
from typing import Dict, Any, List
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak,
)


def build_pdf(ctx: Dict[str, Any]) -> bytes:
    """ctx must contain: case (dict), factors (list), chain (list),
    recommendations (list), narrative (str)."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=18 * mm, rightMargin=18 * mm,
        topMargin=18 * mm, bottomMargin=18 * mm,
        title=f"TraceRoot Report {ctx['case']['case_id']}",
    )
    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=styles["Heading1"], fontSize=20, spaceAfter=6, leading=24)
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], fontSize=11, textColor=colors.HexColor("#555"),
                        spaceBefore=14, spaceAfter=6, fontName="Helvetica-Bold")
    body = ParagraphStyle("body", parent=styles["BodyText"], fontSize=10.5, leading=15)
    small = ParagraphStyle("small", parent=styles["BodyText"], fontSize=8, textColor=colors.HexColor("#888"))

    story = []
    c = ctx["case"]
    story.append(Paragraph("TRACEROOT · INVESTIGATION REPORT", small))
    story.append(Paragraph(_esc(c["subject"]), h1))
    risk_color = {"freeze": "#991b1b", "monitor": "#92400e", "safe": "#065f46"}.get(c["risk"], "#333")
    story.append(Paragraph(
        f"Case <b>{_esc(c['case_id'])}</b> · "
        f"<font color='{risk_color}'><b>{ctx['risk_label']}</b></font> · "
        f"Score <b>{c['risk_score']}/100</b>",
        body,
    ))
    story.append(Spacer(1, 10))

    # Meta grid
    meta_rows = [
        ["Reported", _fmt_when(c["reported_at"]), "Channel", c["channel"]],
        ["Route", c["country"], "Exposure", f"{c['currency']} {c['amount']:,.2f}"],
        ["Transactions", str(c.get("tx_count", 0)), "Generated", datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")],
    ]
    t = Table(meta_rows, colWidths=[30 * mm, 55 * mm, 30 * mm, 55 * mm])
    t.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#888")),
        ("TEXTCOLOR", (2, 0), (2, -1), colors.HexColor("#888")),
        ("LINEBELOW", (0, 0), (-1, -1), 0.25, colors.HexColor("#eee")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(t)

    story.append(Paragraph("EXECUTIVE SUMMARY", h2))
    story.append(Paragraph(_esc(ctx["narrative"]), body))

    story.append(Paragraph("FUND FLOW CHAIN", h2))
    chain_labels = [n["label"] for n in ctx["chain"]]
    story.append(Paragraph(" &rarr; ".join(_esc(x) for x in chain_labels) or "(no chain)", body))

    story.append(Paragraph("RISK BREAKDOWN", h2))
    if ctx["factors"]:
        rows = [["Signal", "Meta", "Points"]]
        for f in ctx["factors"]:
            rows.append([f["label"], f["meta"], f"+{f['points']}"])
        rows.append(["Total", "", f"{c['risk_score']}/100"])
        rt = Table(rows, colWidths=[45 * mm, 100 * mm, 25 * mm])
        rt.setStyle(TableStyle([
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#fafafa")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#666")),
            ("LINEBELOW", (0, 0), (-1, -2), 0.25, colors.HexColor("#eee")),
            ("LINEABOVE", (0, -1), (-1, -1), 1, colors.HexColor("#111")),
            ("ALIGN", (2, 0), (2, -1), "RIGHT"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(rt)
    else:
        story.append(Paragraph("(no signals fired)", body))

    story.append(Paragraph("RECOMMENDATIONS", h2))
    if ctx["recommendations"]:
        rrows = [["Account", "Verdict", "Reason"]]
        for r in ctx["recommendations"]:
            rrows.append([r["label"], r["verdict"].upper(), r["reason"]])
        rt2 = Table(rrows, colWidths=[35 * mm, 25 * mm, 110 * mm])
        rt2.setStyle(TableStyle([
            ("FONTSIZE", (0, 0), (-1, -1), 8.5),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#fafafa")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#666")),
            ("LINEBELOW", (0, 0), (-1, -1), 0.25, colors.HexColor("#eee")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(rt2)

    story.append(Spacer(1, 14))
    story.append(Paragraph(
        "TraceRoot v0.5 · Confidential · DRAFT for human investigator review · Not a legal determination.",
        small,
    ))

    doc.build(story)
    buf.seek(0)
    return buf.getvalue()


def _esc(s: Any) -> str:
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _fmt_when(iso_or_dt: Any) -> str:
    if isinstance(iso_or_dt, datetime):
        return iso_or_dt.strftime("%Y-%m-%d %H:%M")
    try:
        return datetime.fromisoformat(str(iso_or_dt).replace("Z", "+00:00")).strftime("%Y-%m-%d %H:%M")
    except Exception:
        return str(iso_or_dt)
