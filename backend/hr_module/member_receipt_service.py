"""
Member Certificate & E-Receipt Generator Service
Pixel-perfect implementation of the Sree Lakshmi Charitable Trust Membership Receipt.
"""
from hr_module.models import Member
from datetime import datetime


def generate_member_certificate_html(member: Member) -> str:
    """Generate HTML printable e-receipt matching exact design specification."""
    date_str = member.joining_date.strftime('%d %b %Y') if member.joining_date else datetime.now().strftime('%d %b %Y')
    year_str = member.joining_date.strftime('%Y') if member.joining_date else datetime.now().strftime('%Y')
    
    # Generate receipt number if not present
    receipt_no = f"SLCT/{year_str}/{str(member.id)[:6].upper()}"
    membership_id = f"SLCT/MEM/{member.member_id.replace('MEM-', '')}" if member.member_id else "SLCT/MEM/000123"

    fee_amount = getattr(member, 'monthly_fee', 100.00) or 100.00
    fee_type = member.membership_type.replace('_', ' ').upper() if member.membership_type else "PER MONTH"
    if fee_type == "GENERAL":
        fee_type = "PER MONTH"

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Membership Receipt - {member.full_name}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

        * {{
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }}

        body {{
            font-family: 'Plus Jakarta Sans', sans-serif;
            background-color: #f1f5f9;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 30px 15px;
            color: #1e293b;
        }}

        .receipt-card {{
            width: 100%;
            max-width: 720px;
            background: #ffffff;
            border-radius: 20px;
            position: relative;
            overflow: hidden;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
            border: 1px solid #e2e8f0;
            padding: 36px 36px 20px 36px;
        }}

        /* Top Right Ribbon Accent */
        .top-accent {{
            position: absolute;
            top: 0;
            right: 0;
            width: 140px;
            height: 45px;
            background: #0256c2;
            border-bottom-left-radius: 40px;
        }}

        /* Header Section */
        .header {{
            display: flex;
            align-items: center;
            margin-bottom: 30px;
        }}

        .logo-section {{
            display: flex;
            flex-direction: column;
            align-items: center;
            padding-right: 24px;
            border-right: 2px solid #e2e8f0;
            min-width: 180px;
        }}

        .logo-icon {{
            width: 70px;
            height: 70px;
            margin-bottom: 8px;
        }}

        .trust-title {{
            font-size: 20px;
            font-weight: 800;
            color: #0b3c86;
            text-align: center;
            line-height: 1.1;
        }}

        .trust-subtitle {{
            font-size: 10px;
            font-weight: 800;
            color: #0256c2;
            letter-spacing: 1.5px;
            margin-top: 3px;
        }}

        .title-section {{
            padding-left: 24px;
            flex: 1;
        }}

        .doc-title {{
            font-size: 32px;
            font-weight: 800;
            color: #0256c2;
            letter-spacing: 0.5px;
            margin-bottom: 10px;
            text-transform: uppercase;
        }}

        .doc-desc {{
            font-size: 13px;
            color: #475569;
            line-height: 1.5;
            font-weight: 500;
        }}

        /* Key Metrics Row */
        .metrics-row {{
            display: flex;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 28px;
        }}

        .metric-pill {{
            flex: 1;
            display: flex;
            align-items: center;
            gap: 12px;
        }}

        .metric-icon {{
            width: 44px;
            height: 44px;
            border-radius: 50%;
            background: #eef5ff;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #0256c2;
            flex-shrink: 0;
        }}

        .metric-label {{
            font-size: 11px;
            color: #64748b;
            font-weight: 600;
            margin-bottom: 2px;
        }}

        .metric-value {{
            font-size: 13px;
            font-weight: 800;
            color: #0f172a;
        }}

        /* Member Details Section */
        .member-box {{
            border: 1px solid #cbd5e1;
            border-radius: 16px;
            position: relative;
            padding: 24px;
            margin-bottom: 28px;
            display: flex;
            background: #ffffff;
        }}

        .member-badge {{
            position: absolute;
            top: -14px;
            left: 20px;
            background: #0256c2;
            color: #ffffff;
            font-size: 11px;
            font-weight: 800;
            padding: 4px 16px;
            border-radius: 6px;
            letter-spacing: 1px;
        }}

        .details-list {{
            flex: 1;
            padding-right: 20px;
        }}

        .detail-row {{
            display: flex;
            margin-bottom: 10px;
            font-size: 13px;
        }}

        .detail-row:last-child {{
            margin-bottom: 0;
        }}

        .detail-key {{
            width: 120px;
            font-weight: 700;
            color: #1e293b;
        }}

        .detail-colon {{
            margin-right: 12px;
            font-weight: 700;
            color: #64748b;
        }}

        .detail-val {{
            flex: 1;
            color: #334155;
            font-weight: 600;
            line-height: 1.4;
        }}

        .member-right-badge {{
            width: 160px;
            border-left: 1px solid #e2e8f0;
            padding-left: 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
        }}

        .avatar-circle {{
            width: 54px;
            height: 54px;
            border-radius: 50%;
            border: 2px solid #0256c2;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #0256c2;
            margin-bottom: 6px;
            position: relative;
        }}

        .member-text {{
            font-size: 13px;
            font-weight: 800;
            color: #0256c2;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
        }}

        .script-thanks {{
            font-family: 'Caveat', cursive;
            font-size: 24px;
            color: #0256c2;
            font-weight: 700;
            line-height: 1;
            margin-bottom: 2px;
        }}

        .sub-thanks {{
            font-size: 10px;
            color: #64748b;
            font-weight: 600;
        }}

        /* Center Amount Card */
        .amount-card {{
            border: 2px solid #0256c2;
            border-radius: 16px;
            padding: 20px;
            text-align: center;
            max-width: 320px;
            margin: 0 auto 28px auto;
            background: #ffffff;
        }}

        .amount-num {{
            font-size: 38px;
            font-weight: 800;
            color: #0256c2;
            line-height: 1;
            margin-bottom: 8px;
        }}

        .type-pill {{
            display: inline-block;
            background: #0256c2;
            color: #ffffff;
            font-size: 11px;
            font-weight: 800;
            padding: 4px 18px;
            border-radius: 6px;
            letter-spacing: 1px;
            margin-bottom: 10px;
        }}

        /* Bottom Section */
        .divider-dotted {{
            border-bottom: 1.5px dotted #94a3b8;
            margin-bottom: 20px;
        }}

        .bottom-flex {{
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-bottom: 24px;
        }}

        .bottom-left {{
            display: flex;
            align-items: center;
            gap: 12px;
            max-width: 400px;
        }}

        .heart-icon {{
            color: #0256c2;
            flex-shrink: 0;
        }}

        .bottom-notice {{
            font-size: 11px;
            color: #475569;
            line-weight: 1.4;
            font-weight: 500;
        }}

        .sign-block {{
            text-align: center;
        }}

        .sign-img {{
            font-family: 'Caveat', cursive;
            font-size: 28px;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 4px;
        }}

        .sign-line {{
            width: 140px;
            border-bottom: 1.5px solid #1e293b;
            margin: 0 auto 6px auto;
        }}

        .sign-title {{
            font-size: 11px;
            font-weight: 800;
            color: #0f172a;
        }}

        .sign-sub {{
            font-size: 9px;
            color: #64748b;
            font-weight: 600;
        }}

        /* Footer Info Banner */
        .footer-banner {{
            background: #edf4ff;
            border-radius: 12px;
            padding: 14px 18px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }}

        .contact-col {{
            display: flex;
            flex-direction: column;
            gap: 6px;
            font-size: 11px;
            color: #334155;
            font-weight: 600;
        }}

        .contact-item {{
            display: flex;
            align-items: center;
            gap: 8px;
        }}

        .qr-box {{
            width: 65px;
            height: 65px;
            background: #ffffff;
            border-radius: 8px;
            padding: 4px;
            border: 1px solid #cbd5e1;
            display: flex;
            align-items: center;
            justify-content: center;
        }}

        .qr-box img {{
            width: 100%;
            height: 100%;
        }}

        .print-btn {{
            display: block;
            width: 100%;
            max-width: 220px;
            margin: 20px auto 0 auto;
            padding: 12px 20px;
            background: #0256c2;
            color: #ffffff;
            border: none;
            border-radius: 10px;
            font-size: 14px;
            font-weight: 700;
            cursor: pointer;
            text-align: center;
            box-shadow: 0 4px 12px rgba(2, 86, 194, 0.25);
        }}

        @media print {{
            body {{
                background: none;
                padding: 0;
            }}
            .receipt-card {{
                box-shadow: none;
                border: none;
            }}
            .print-btn {{
                display: none;
            }}
        }}
    </style>
</head>
<body>

    <div style="width: 100%; max-width: 720px;">
        <div class="receipt-card">
            <!-- Top Blue Curved Ribbon -->
            <div class="top-accent"></div>

            <!-- Header -->
            <div class="header">
                <div class="logo-section">
                    <!-- Dove Logo SVG -->
                    <svg class="logo-icon" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M32 12C26 12 18 18 18 26C18 36 32 50 32 50C32 50 46 36 46 26C46 18 38 12 32 12Z" stroke="#0256c2" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M32 30C34.2091 30 36 28.2091 36 26C36 23.7909 34.2091 22 32 22C29.7909 22 28 23.7909 28 26C28 28.2091 29.7909 30 32 30Z" fill="#0256c2"/>
                    </svg>
                    <div class="trust-title">Sree Lakshmi</div>
                    <div class="trust-subtitle">CHARITABLE TRUST</div>
                </div>

                <div class="title-section">
                    <div class="doc-title">MEMBERSHIP RECEIPT</div>
                    <div class="doc-desc">
                        Thank you for supporting our mission. Your membership helps us create a better tomorrow for those in need.
                    </div>
                </div>
            </div>

            <!-- Key Metrics Row -->
            <div class="metrics-row">
                <div class="metric-pill">
                    <div class="metric-icon">
                        <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                    </div>
                    <div>
                        <div class="metric-label">Receipt No.</div>
                        <div class="metric-value">{receipt_no}</div>
                    </div>
                </div>

                <div class="metric-pill">
                    <div class="metric-icon">
                        <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z"/></svg>
                    </div>
                    <div>
                        <div class="metric-label">Receipt Date</div>
                        <div class="metric-value">{date_str}</div>
                    </div>
                </div>

                <div class="metric-pill">
                    <div class="metric-icon">
                        <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                    </div>
                    <div>
                        <div class="metric-label">Membership ID</div>
                        <div class="metric-value">{membership_id}</div>
                    </div>
                </div>
            </div>

            <!-- Member Details Card -->
            <div class="member-box">
                <div class="member-badge">MEMBER DETAILS</div>
                
                <div class="details-list">
                    <div class="detail-row">
                        <div class="detail-key">Member Name</div>
                        <div class="detail-colon">:</div>
                        <div class="detail-val">{member.full_name}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-key">Email</div>
                        <div class="detail-colon">:</div>
                        <div class="detail-val">{member.email or 'N/A'}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-key">Mobile</div>
                        <div class="detail-colon">:</div>
                        <div class="detail-val">+91 {member.phone or 'N/A'}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-key">Address</div>
                        <div class="detail-colon">:</div>
                        <div class="detail-val">{member.address or 'Kozhikode, Kerala'}</div>
                    </div>
                </div>

                <div class="member-right-badge">
                    <div style="font-size: 10px; color: #0256c2; margin-bottom: 2px;">★ ★ ★</div>
                    <div class="avatar-circle">
                        <svg width="28" height="28" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                    </div>
                    <div class="member-text">MEMBER</div>
                    <div class="script-thanks">Thank You!</div>
                    <div class="sub-thanks">Your support makes<br/>a real difference.</div>
                </div>
            </div>

            <!-- Center Amount Card -->
            <div class="amount-card">
                <div class="amount-num">₹{fee_amount:,.2f}</div>
                <div class="type-pill">{fee_type}</div>
                <div class="script-thanks">Thank You!</div>
                <div class="sub-thanks">Your support makes a real difference.</div>
            </div>

            <!-- Dotted Divider -->
            <div class="divider-dotted"></div>

            <!-- Bottom Section -->
            <div class="bottom-flex">
                <div class="bottom-left">
                    <svg class="heart-icon" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.684a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
                    </svg>
                    <div class="bottom-notice">
                        Your membership contribution is important in allowing us to continue our charitable activities and serve the community better.
                    </div>
                </div>

                <div class="sign-block">
                    <div class="sign-img">Sree Lakshmi</div>
                    <div class="sign-line"></div>
                    <div class="sign-title">Authorised Signatory</div>
                    <div class="sign-sub">Sree Lakshmi Charitable Trust</div>
                </div>
            </div>

            <!-- Footer Info Banner -->
            <div class="footer-banner">
                <div class="contact-col">
                    <div class="contact-item">
                        <span>📍</span>
                        <span>KMCT Medical College Campus, Koolimad - Manassery Rd, Mukkam, Manassery, Kerala 673602, India</span>
                    </div>
                    <div class="contact-item">
                        <span>📞</span>
                        <span>+91 62389 59787</span>
                        <span style="margin: 0 6px;">|</span>
                        <span>✉️</span>
                        <span>sreelakshmicharity@gmail.com</span>
                    </div>
                    <div class="contact-item">
                        <span>🌐</span>
                        <span>www.sreelakshmicharity.org</span>
                    </div>
                </div>

                <div class="qr-box">
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://sreelakshmicharity.org/verify/{member.member_id}" alt="QR Code"/>
                </div>
            </div>

        </div>

        <button class="print-btn" onclick="window.print()">📥 Save PDF / Print</button>
    </div>

</body>
</html>"""
    return html_content
