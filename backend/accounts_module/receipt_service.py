"""
Receipt Generator Service
Renders formatted HTML / Printable PDF e-receipt for Income / Donation transactions.
"""
from django.http import HttpResponse
from django.template.loader import render_to_string
from accounts_module.models import Income


def generate_receipt_html(income: Income) -> str:
    """Generate HTML printable receipt for an Income record."""
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Receipt {income.receipt_number}</title>
        <style>
            body {{ font-family: 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 20px; color: #1e293b; background: #f8fafc; }}
            .receipt-card {{ max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }}
            .header {{ text-align: center; border-bottom: 2px solid #0284c7; padding-bottom: 16px; margin-bottom: 24px; }}
            .header h1 {{ color: #0f172a; margin: 0 0 6px 0; font-size: 24px; letter-spacing: 0.5px; }}
            .header p {{ color: #64748b; margin: 0; font-size: 14px; }}
            .badge {{ display: inline-block; background: #e0f2fe; color: #0369a1; padding: 4px 12px; border-radius: 9999px; font-size: 13px; font-weight: 600; margin-top: 8px; }}
            .info-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; background: #f8fafc; padding: 16px; border-radius: 8px; }}
            .info-item label {{ display: block; font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase; }}
            .info-item span {{ font-size: 15px; color: #0f172a; font-weight: 500; }}
            .amount-box {{ text-align: center; background: #f0fdf4; border: 1px dashed #22c55e; border-radius: 8px; padding: 20px; margin-bottom: 24px; }}
            .amount-box label {{ font-size: 13px; color: #15803d; font-weight: 600; text-transform: uppercase; }}
            .amount-box .value {{ font-size: 32px; font-weight: 700; color: #166534; margin-top: 4px; }}
            .footer {{ text-align: center; color: #94a3b8; font-size: 12px; margin-top: 32px; border-top: 1px solid #f1f5f9; padding-top: 16px; }}
        </style>
    </head>
    <body>
        <div class="receipt-card">
            <div class="header">
                <h1>SREE LAKSHMI TRUST</h1>
                <p>Official Donation & Membership e-Receipt</p>
                <div class="badge">{income.source}</div>
            </div>
            
            <div class="info-grid">
                <div class="info-item">
                    <label>Receipt Number</label>
                    <span>{income.receipt_number}</span>
                </div>
                <div class="info-item">
                    <label>Date</label>
                    <span>{income.date.strftime('%d %B %Y')}</span>
                </div>
                <div class="info-item">
                    <label>Donor / Member Name</label>
                    <span>{income.donor_name or 'Valued Supporter'}</span>
                </div>
                <div class="info-item">
                    <label>Payment Method</label>
                    <span>{income.payment_method}</span>
                </div>
                {"<div class='info-item'><label>Phone Number</label><span>" + income.donor_phone + "</span></div>" if income.donor_phone else ""}
                {"<div class='info-item'><label>Purpose</label><span>" + income.purpose + "</span></div>" if income.purpose else ""}
            </div>
            
            <div class="amount-box">
                <label>Amount Received</label>
                <div class="value">₹{income.amount:,.2f}</div>
            </div>
            
            <div class="footer">
                <p>Thank you for your generous support! May divine blessings be with you.</p>
                <p>Generated automatically on {income.created_at.strftime('%Y-%m-%d %H:%M:%S')}</p>
            </div>
        </div>
    </body>
    </html>
    """
    return html_content
