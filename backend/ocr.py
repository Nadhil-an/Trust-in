import os
import pytesseract
from PIL import Image
from django.conf import settings
p = os.path.join(settings.BASE_DIR, 'media', 'donation_receipt_template.png')
img = Image.open(p)
data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)
for i in range(len(data['text'])):
    word = data['text'][i].strip()
    if word in ['Date', 'Receipt', 'No.', 'SLCT/REC/2026-26/0001', '18', 'Aug', '2026', 'RCP-2026-00014']:
        print(f"{word}: X={data['left'][i]}, Y={data['top'][i]}, W={data['width'][i]}, H={data['height'][i]}")
