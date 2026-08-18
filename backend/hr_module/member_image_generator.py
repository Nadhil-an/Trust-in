"""
Dynamic Member Receipt Image Generator
Overlays member's actual details dynamically onto the Membership Receipt Image Card.
"""
import os
from PIL import Image, ImageDraw, ImageFont
from django.conf import settings
from datetime import datetime
from hr_module.models import Member


def generate_member_receipt_image_bytes(member: Member, receipt_number: str = None, membership_id: str = None, amount: float = None) -> bytes:
    """
    Overlays member details dynamically onto the receipt template image
    and returns binary PNG bytes for WhatsApp image card.
    """
    template_path = os.path.join(settings.BASE_DIR, 'media', 'receipt_template.png')
    if not os.path.exists(template_path):
        # Fallback if template missing
        img = Image.new('RGB', (682, 1024), color='#ffffff')
    else:
        img = Image.open(template_path).convert('RGB')

    draw = ImageDraw.Draw(img)

    # Try loading truetype font, fallback to default font
    try:
        font_bold = ImageFont.truetype("arialbd.ttf", 16)
        font_regular = ImageFont.truetype("arial.ttf", 15)
        font_small_bold = ImageFont.truetype("arialbd.ttf", 14)
        font_large_amount = ImageFont.truetype("arialbd.ttf", 36)
    except Exception:
        font_bold = ImageFont.load_default()
        font_regular = ImageFont.load_default()
        font_small_bold = ImageFont.load_default()
        font_large_amount = ImageFont.load_default()

    # Dynamic values
    joining_date_str = member.joining_date.strftime('%d %b %Y') if member.joining_date else datetime.now().strftime('%d %b %Y')
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
            raw_num = int(member.member_id.replace('MEM-', ''))
            mem_id_val = f"SLCT/MEM/{raw_num:04d}"
        except Exception:
            mem_id_val = f"SLCT/MEM/{member.member_id}" if member.member_id else "SLCT/MEM/0001"

    fee_amount = amount if amount is not None else (getattr(member, 'monthly_fee', 100.00) or 100.00)

    # Colors
    TEXT_DARK = (23, 32, 51)
    TEXT_NAVY = (18, 49, 92)
    TEXT_BLUE = (18, 104, 232)
    WHITE_BG = (250, 250, 250)
    METRIC_BG = (246, 246, 245)

    # 1. Clear & Overwrite Receipt No. (Top Left Metric) — Y: 314-335
    draw.rectangle([88, 314, 248, 336], fill=METRIC_BG)
    draw.text((90, 314), receipt_no, font=font_small_bold, fill=TEXT_DARK)

    # 2. Clear & Overwrite Receipt Date (Top Center Metric) — Y: 314-335
    draw.rectangle([310, 314, 458, 336], fill=METRIC_BG)
    draw.text((312, 314), joining_date_str, font=font_small_bold, fill=TEXT_DARK)

    # 3. Clear & Overwrite Membership ID (Top Right Metric) — Y: 314-335
    draw.rectangle([518, 314, 670, 336], fill=METRIC_BG)
    draw.text((520, 314), mem_id_val, font=font_small_bold, fill=TEXT_DARK)

    # 4. Clear & Overwrite Member Name — Y: 428-450
    draw.rectangle([182, 428, 412, 452], fill=WHITE_BG)
    draw.text((185, 428), member.full_name, font=font_bold, fill=TEXT_DARK)

    # 5. Clear & Overwrite Email — Y: 465-488
    draw.rectangle([182, 465, 412, 489], fill=WHITE_BG)
    draw.text((185, 465), member.email or 'N/A', font=font_regular, fill=TEXT_DARK)

    # 6. Clear & Overwrite Mobile — Y: 501-524
    draw.rectangle([182, 501, 412, 525], fill=WHITE_BG)
    draw.text((185, 501), f"+91 {member.phone}" if member.phone else 'N/A', font=font_regular, fill=TEXT_DARK)

    # 7. Clear & Overwrite Address — Y: 538-605
    draw.rectangle([182, 538, 412, 605], fill=WHITE_BG)
    addr_text = member.address or 'Kozhikode, Kerala'
    addr_lines = [line.strip() for line in addr_text.split('\n') if line.strip()]
    if not addr_lines:
        addr_lines = ['Kozhikode, Kerala']
    y_offset = 538
    for line in addr_lines[:2]:
        draw.text((185, y_offset), line, font=font_regular, fill=TEXT_DARK)
        y_offset += 24

    # 8. Clear & Overwrite Amount Box — Y: 652-692
    draw.rectangle([248, 652, 438, 692], fill=WHITE_BG)
    amount_str = f"₹{fee_amount:,.2f}"
    draw.text((258, 652), amount_str, font=font_large_amount, fill=TEXT_BLUE)

    import io
    output = io.BytesIO()
    img.save(output, format='PNG')
    img_bytes = output.getvalue()
    output.close()
    return img_bytes
