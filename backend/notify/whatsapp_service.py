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
    token = getattr(settings, 'WHATSAPP_GATEWAY_TOKEN', '')
    
    if not gateway_url:
        logger.warning("WHATSAPP_GATEWAY_URL is not set in settings.")
        return {'success': False, 'reason': 'config_missing'}
    
    payload = {
        'token': token,
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

    try:
        response = requests.post(gateway_url, json=payload, timeout=15)
        res_json = response.json()
        logger.info(f"WhatsApp message/document dispatched to {phone}: {res_json}")
        return {'success': True, 'response': res_json}
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
        f"📄 *Receipt No:* `{receipt_number}`\n"
        f"📅 *Date:* {date_str}\n"
        f"🏷️ *Category:* {source.title()}\n"
        f"💰 *Amount Received:* *₹{amount:,.2f}*\n"
        f"Your support helps us serve our community better.\n"
        f"May divine blessings be with you and your family! 🙏\n"
        f"━━━━━━━━━━━━━━━━━━━━━━\n"
        f"This is an automated e-receipt sent from Sree Lakshmi Trust Official Number."
    )
    
    return send_whatsapp_message(to_phone=to_phone, message_body=text, image_url=image_url)
