"""
ReportLab PDF Generator for Sree Lakshmi Charitable Trust — Membership Receipt.
Generates a downloadable, high-resolution PDF document attachment.
"""
import io
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import inch, mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from hr_module.models import Member


def generate_member_receipt_pdf_bytes(member: Member, receipt_number: str = None, membership_id: str = None, amount: float = None) -> bytes:
    """Generate binary PDF content for a member receipt formatted for A4 (210mm x 297mm)."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=15 * mm,
        leftMargin=15 * mm,
        topMargin=15 * mm,
        bottomMargin=15 * mm
    )

    story = []
    styles = getSampleStyleSheet()

    # Color Palette
    PRIMARY_BLUE = colors.HexColor('#0256c2')
    DARK_TEXT = colors.HexColor('#0f172a')
    MUTED_TEXT = colors.HexColor('#64748b')
    LIGHT_BG = colors.HexColor('#edf4ff')
    BORDER_COLOR = colors.HexColor('#cbd5e1')

    # Custom Paragraph Styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=22,
        leading=26,
        textColor=PRIMARY_BLUE,
        alignment=TA_LEFT
    )

    trust_header_style = ParagraphStyle(
        'TrustHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=16,
        leading=18,
        textColor=colors.HexColor('#0b3c86'),
        alignment=TA_CENTER
    )

    trust_sub_style = ParagraphStyle(
        'TrustSub',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=PRIMARY_BLUE,
        alignment=TA_CENTER
    )

    desc_style = ParagraphStyle(
        'DocDesc',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=DARK_TEXT,
        alignment=TA_LEFT
    )

    label_style = ParagraphStyle(
        'LabelStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=11,
        textColor=MUTED_TEXT
    )

    value_style = ParagraphStyle(
        'ValueStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=13,
        textColor=DARK_TEXT
    )

    key_style = ParagraphStyle(
        'KeyStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=14,
        textColor=DARK_TEXT
    )

    val_style = ParagraphStyle(
        'ValStyle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=DARK_TEXT
    )

    # 1. Header Section Table (Logo + Title)
    logo_p = Paragraph("<font color='#0256c2'><b>Sree Lakshmi</b></font><br/><font color='#0256c2' size=7>CHARITABLE TRUST</font>", trust_header_style)
    title_p = Paragraph("<b>MEMBERSHIP RECEIPT</b>", title_style)
    desc_p = Paragraph("Thank you for supporting our mission. Your membership helps us create a better tomorrow for those in need.", desc_style)

    header_table_data = [
        [logo_p, [title_p, Spacer(1, 4), desc_p]]
    ]
    header_table = Table(
        header_table_data,
        colWidths=[2.2 * inch, 4.8 * inch]
    )
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LINERIGHT', (0, 0), (0, 0), 1.5, BORDER_COLOR),
        ('RIGHTPADDING', (0, 0), (0, 0), 12),
        ('LEFTPADDING', (1, 0), (1, 0), 16),
    ]))

    story.append(header_table)
    story.append(Spacer(1, 16))

    # 2. Key Metrics Row Table
    joining_date_str = member.joining_date.strftime('%d %B %Y') if member.joining_date else datetime.now().strftime('%d %B %Y')
    year_str = member.joining_date.strftime('%Y') if member.joining_date else datetime.now().strftime('%Y')
    
    # Format receipt_no with 6 digits (e.g. 000004)
    if receipt_number:
        try:
            rcp_val = int(str(receipt_number).split('/')[-1])
            receipt_no = f"{rcp_val:06d}"
        except Exception:
            receipt_no = str(receipt_number)
    else:
        receipt_no = f"000001"

    # Format mem_id_val with 4 digits (e.g. 0009)
    if membership_id:
        try:
            mem_val = int(str(membership_id).split('/')[-1])
            mem_id_val = f"{mem_val:04d}"
        except Exception:
            mem_id_val = str(membership_id)
    else:
        try:
            raw_num = int(str(member.member_id).replace('MEM-', ''))
            mem_id_val = f"{raw_num:04d}"
        except Exception:
            mem_id_val = f"{member.member_id}" if member.member_id else "0001"

    m1 = [Paragraph("Receipt No.", label_style), Paragraph(receipt_no, value_style)]
    m2 = [Paragraph("Receipt Date", label_style), Paragraph(joining_date_str, value_style)]
    m3 = [Paragraph("Membership ID", label_style), Paragraph(mem_id_val, value_style)]

    metrics_table = Table(
        [[m1, m2, m3]],
        colWidths=[2.3 * inch, 2.3 * inch, 2.4 * inch]
    )
    metrics_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), LIGHT_BG),
        ('PADDING', (0, 0), (-1, -1), 8),
        ('ROUNDEDCORNERS', [6, 6, 6, 6]),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(metrics_table)
    story.append(Spacer(1, 16))

    # 3. Member Details Box
    details_data = [
        [Paragraph("Member Name", key_style), Paragraph(":", key_style), Paragraph(member.full_name, val_style)],
        [Paragraph("Email", key_style), Paragraph(":", key_style), Paragraph(member.email or 'N/A', val_style)],
        [Paragraph("Mobile", key_style), Paragraph(":", key_style), Paragraph(f"+91 {member.phone}" if member.phone else 'N/A', val_style)],
        [Paragraph("Address", key_style), Paragraph(":", key_style), Paragraph(member.address or 'Kozhikode, Kerala', val_style)],
    ]
    
    details_inner_table = Table(details_data, colWidths=[1.3 * inch, 0.2 * inch, 3.2 * inch])
    details_inner_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
    ]))

    badge_p = Paragraph("<font color='#0256c2' size=12>★ ★ ★</font><br/><b>MEMBER</b><br/><font color='#0256c2' size=14><i>Thank You!</i></font><br/><font size=7 color='#64748b'>Your support makes<br/>a real difference.</font>", ParagraphStyle('Badge', alignment=TA_CENTER, leading=12))

    member_box_table = Table([[details_inner_table, badge_p]], colWidths=[4.8 * inch, 2.2 * inch])
    member_box_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 1, BORDER_COLOR),
        ('LINEBEFORE', (1, 0), (1, 0), 1, BORDER_COLOR),
        ('PADDING', (0, 0), (-1, -1), 12),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(member_box_table)
    story.append(Spacer(1, 16))

    # 4. Amount Box
    fee_amount = amount if amount is not None else (getattr(member, 'monthly_fee', 100.00) or 100.00)
    fee_type = member.membership_type.replace('_', ' ').upper() if member.membership_type else "PER MONTH"
    if fee_type == "GENERAL":
        fee_type = "PER MONTH"

    amount_p = Paragraph(f"<font color='#0256c2' size=24><b>₹{fee_amount:,.2f}</b></font><br/><font color='#ffffff' size=9><b>  {fee_type}  </b></font><br/><br/><font color='#0256c2' size=14><i>Thank You!</i></font><br/><font size=8 color='#64748b'>Your support makes a real difference.</font>", ParagraphStyle('AmtP', alignment=TA_CENTER, leading=16))

    amount_table = Table([[amount_p]], colWidths=[3.2 * inch])
    amount_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 2, PRIMARY_BLUE),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('PADDING', (0, 0), (-1, -1), 12),
    ]))
    story.append(amount_table)
    story.append(Spacer(1, 16))

    # 5. Dotted Line & Bottom Section
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER_COLOR, spaceBefore=4, spaceAfter=12))

    notice_p = Paragraph("Your membership contribution is important in allowing us to continue our charitable activities and serve the community better.", desc_style)
    sign_p = Paragraph("<font size=14><i>Sree Lakshmi</i></font><br/>━━━━━━━━━━━━━<br/><b>Authorised Signatory</b><br/><font size=7 color='#64748b'>Sree Lakshmi Charitable Trust</font>", ParagraphStyle('SignP', alignment=TA_CENTER, leading=12))

    bottom_table = Table([[notice_p, sign_p]], colWidths=[4.6 * inch, 2.4 * inch])
    bottom_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'BOTTOM'),
    ]))
    story.append(bottom_table)
    story.append(Spacer(1, 14))

    # 6. Footer Banner
    footer_text = Paragraph(
        "<font size=8 color='#334155'><b>📍 Location:</b> KMCT Medical College Campus, Koolimad - Manassery Rd, Mukkam, Manassery, Kerala 673602, India<br/>"
        "<b>📞 Phone:</b> +91 62389 59787 | <b>✉️ Email:</b> sreelakshmicharity@gmail.com | <b>🌐 Web:</b> www.sreelakshmicharity.org</font>",
        ParagraphStyle('FooterP', leading=11)
    )
    footer_table = Table([[footer_text]], colWidths=[7.0 * inch])
    footer_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), LIGHT_BG),
        ('PADDING', (0, 0), (-1, -1), 10),
    ]))
    story.append(footer_table)

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
