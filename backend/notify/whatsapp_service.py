"""
WhatsApp Gateway Integration Service
Handles sending automated messages & e-receipt PDFs via WhatsApp Web Gateway (UltraMsg, Whapi, etc.)
Saves staff privacy by sending all messages from the Trust's central phone number.
"""
import logging
import requests
from django.conf import settings

logger = logging.getLogger(__name__)


def sanitize_phone_number(phone_str: str) -> str:
    """
    Cleans phone number and ensures standard international country code format without leading '+'.
    Default country code is 91 (India) if 10 digits provided.
    """
    if not phone_str:
        return ""
    
    clean = "".join(filter(str.isdigit, str(phone_str)))
    if len(clean) == 10:
        clean = f"91{clean}"
    
    return clean


def is_whatsapp_enabled() -> bool:
    """Check if WhatsApp dispatch is enabled in settings."""
    return getattr(settings, 'WHATSAPP_ENABLED', False)


def send_whatsapp_message(to_phone: str, message_body: str, document_url: str = None, image_url: str = None, file_name: str = "Document.pdf") -> dict:
    """
    Send text message, image card banner, or PDF document attachment via WhatsApp Gateway API.
    """
    if not is_whatsapp_enabled():
        logger.info("WhatsApp dispatch is disabled in settings. Skipping sending.")
        return {'success': False, 'reason': 'disabled'}
    
    phone = sanitize_phone_number(to_phone)
    if not phone:
        return {'success': False, 'reason': 'invalid_phone'}
    
    gateway_url = getattr(settings, 'WHATSAPP_GATEWAY_URL', '')
    token = getattr(settings, 'WHATSAPP_GATEWAY_TOKEN', '') or 'trust_secret_token_123'
    
    if not gateway_url:
        logger.warning("WHATSAPP_GATEWAY_URL is not set in settings.")
        return {'success': False, 'reason': 'config_missing'}
    
    payload = {
        'to': phone,
        'body': message_body,
        'priority': 10
    }

    if image_url:
        payload['image_url'] = image_url

    if document_url:
        payload['document_url'] = document_url
        payload['file_name'] = file_name
        payload['mimetype'] = 'application/pdf'

    # Send the token as Authorization Bearer header (as the gateway expects)
    headers = {}
    if token:
        headers['Authorization'] = f'Bearer {token}'

    from urllib.parse import urlparse
    def is_safe_url(url: str) -> bool:
        parsed = urlparse(url)
        return parsed.scheme in ('http', 'https') and bool(parsed.hostname)

    if not is_safe_url(gateway_url):
        logger.error("Blocked SSRF attempt to: %s", gateway_url)
        return {'success': False, 'reason': 'invalid_gateway'}

    try:
        last_error = None
        for attempt in range(1, 4):  # Retry up to 3 times
            try:
                response = requests.post(gateway_url, json=payload, headers=headers, timeout=15)
                res_json = response.json()
                if response.status_code == 401:
                    logger.error(f"WhatsApp gateway rejected token — check WHATSAPP_GATEWAY_TOKEN in .env")
                    return {'success': False, 'reason': 'auth_failed', 'response': res_json}
                if response.status_code == 503:
                    logger.warning(f"WhatsApp gateway not connected (attempt {attempt}/3). Is 'node server.js' running?")
                    if attempt < 3:
                        import time
                        time.sleep(2)
                    continue
                logger.info(f"WhatsApp message/document dispatched to {phone}: {res_json}")
                return {'success': True, 'response': res_json}
            except requests.exceptions.ConnectionError:
                logger.warning(f"Cannot reach WhatsApp gateway at {gateway_url} (attempt {attempt}/3). Is 'node server.js' running?")
                last_error = f"Connection refused — WhatsApp Gateway (node server.js) is not running on port 3001"
                if attempt < 3:
                    import time
                    time.sleep(2)
            except requests.exceptions.Timeout:
                logger.warning(f"WhatsApp gateway timed out (attempt {attempt}/3).")
                last_error = "Request timed out"
                if attempt < 3:
                    import time
                    time.sleep(2)
        return {'success': False, 'error': last_error or 'All 3 attempts failed'}
    except Exception as e:
        logger.error(f"Failed to send WhatsApp message to {phone}: {e}")
        return {'success': False, 'error': str(e)}


def send_whatsapp_receipt(to_phone: str, donor_name: str, receipt_number: str,
                          amount: float, source: str, date_str: str, pdf_url: str = None, image_url: str = None) -> dict:
    """
    Constructs formatted WhatsApp message and triggers Gateway API.
    """
    donor_display = donor_name if donor_name else "Valued Supporter"
    
    text = (
        f"Dear *{donor_display}*,\n\n"
        f"Thank you for your generous contribution!\n\n"
        f"📄 *Voucher ID:* `{receipt_number}`\n"
        f"📅 *Date:* {date_str}\n"
        f"🏷️ *Category:* {source.title()}\n"
        f"💰 *Amount Received:* *₹{amount:,.2f}*\n"
        f"Your support helps us serve our community better.\n"
        f"May divine blessings be with you and your family! 🙏\n\n"
        f"📱 Instagram: https://www.instagram.com/sreelakshmicharity?igsh=MWFna2dnYnFsdDRmbQ==\n"
        f"📘 Facebook: https://www.facebook.com/share/1BZ1MR7HzA/?mibextid=wwXIfr\n"
        f"🌐 Website: https://sreelakshmicharity.org\n"
        f"━━━━━━━━━━━━━━━━━━━━━━\n"
        f"This is an automated e-receipt sent from Sree Lakshmi Trust Official Number."
    )
    
    return send_whatsapp_message(to_phone=to_phone, message_body=text, image_url=image_url)
