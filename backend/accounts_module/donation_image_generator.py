"""
Dynamic Donation Receipt Image Generator
Overlays donor's actual details dynamically onto the Donation Receipt Image Card.
"""
import os
from PIL import Image, ImageDraw, ImageFont
from django.conf import settings
from datetime import datetime


def generate_donation_receipt_image_bytes(income) -> bytes:
    """
    Overlays donation details dynamically onto the donation receipt template image
    and returns binary PNG bytes for WhatsApp image card.
    """
    template_path = os.path.join(settings.BASE_DIR, 'media', 'donation_receipt_template.png')
    if not os.path.exists(template_path):
        img = Image.new('RGB', (682, 1024), color='#ffffff')
    else:
        img = Image.open(template_path).convert('RGB')

    draw = ImageDraw.Draw(img)

    try:
        font_bold = ImageFont.truetype("arialbd.ttf", 16)
        font_regular = ImageFont.truetype("arial.ttf", 15)
        font_amount_bold = ImageFont.truetype("arialbd.ttf", 18)
        font_small_bold = ImageFont.truetype("arialbd.ttf", 14)
    except Exception:
        font_bold = ImageFont.load_default()
        font_regular = ImageFont.load_default()
        font_amount_bold = ImageFont.load_default()
        font_small_bold = ImageFont.load_default()

    # Dynamic values
    donor_name = income.donor_name if hasattr(income, 'donor_name') and income.donor_name else 'Valued Donor'
    phone = getattr(income, 'donor_phone', None)
    phone_str = f"+91 {phone}" if phone else 'N/A'
    amt = getattr(income, 'amount', 1000.00) or 1000.00
    amount_str = f"₹ {amt:,.2f}"
    
    date_val = income.date.strftime('%d %b %Y') if hasattr(income, 'date') and income.date else datetime.now().strftime('%d %b %Y')
    
    # Format 6-digit receipt number (e.g. SLCT/REC/2026/000001 or 000001)
    rcp_raw = getattr(income, 'receipt_number', '000001')
    try:
        rcp_num = int(str(rcp_raw).replace('RCP-', '').split('/')[-1])
        year_str = datetime.now().strftime('%Y')
        receipt_no_str = f"SLCT/REC/{year_str}/{rcp_num:06d}"
    except Exception:
        receipt_no_str = str(rcp_raw)

    # Colors
    TEXT_DARK = (23, 32, 51)
    TEXT_BLUE = (18, 104, 232)
    WHITE_BG = (255, 255, 255)

    # 1. Clear & Overwrite Donor Name — Y: 560-582
    draw.rectangle([360, 560, 560, 582], fill=WHITE_BG)
    draw.text((365, 560), donor_name, font=font_bold, fill=TEXT_DARK)

    # 2. Clear & Overwrite Phone Number — Y: 612-634
    draw.rectangle([360, 612, 560, 634], fill=WHITE_BG)
    draw.text((365, 612), phone_str, font=font_regular, fill=TEXT_DARK)

    # 3. Clear & Overwrite Donation Amount — Y: 661-685
    draw.rectangle([360, 661, 560, 685], fill=WHITE_BG)
    draw.text((365, 661), amount_str, font=font_amount_bold, fill=TEXT_BLUE)

    # 4. Clear & Overwrite Date
    # Values start around X: 175, Y: 838
    draw.rectangle([170, 835, 480, 856], fill=WHITE_BG)
    draw.text((175, 838), date_val, font=font_small_bold, fill=TEXT_DARK)

    # 5. Clear & Overwrite Receipt No.
    # Values start around X: 175, Y: 866
    draw.rectangle([170, 863, 480, 885], fill=WHITE_BG)
    draw.text((175, 866), receipt_no_str, font=font_small_bold, fill=TEXT_DARK)

    import io
    output = io.BytesIO()
    img.save(output, format='PNG')
    img_bytes = output.getvalue()
    output.close()
    return img_bytes
