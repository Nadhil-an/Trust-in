"""
Payment Views for Razorpay One-Time Donations, Monthly Autopay,
and In-App Mobile Checkout.
"""
import json
import logging
from django.http import HttpResponse, JsonResponse
from django.utils import timezone
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated

from accounts_module.models import (
    DonationPayment, DonationSubscription, SubscriptionStatus, PaymentGatewayStatus
)
from accounts_module.payment_service import (
    create_donation_order, verify_donation_payment,
    create_monthly_autopay_subscription, verify_subscription_payment,
    cancel_user_subscription, get_razorpay_client, is_test_environment,
    record_successful_donation
)

logger = logging.getLogger(__name__)


class CreateDonationOrderView(APIView):
    """
    Creates an online payment order for a one-time donation.
    Accessible to members and public supporters.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        amount = request.data.get('amount')
        if not amount or float(amount) < 1:
            return Response({'error': 'Please enter a valid donation amount (minimum ₹1).'}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user if request.user.is_authenticated else None
        donor_name = request.data.get('donor_name') or (user.full_name if user else 'Anonymous Donor')
        donor_phone = request.data.get('donor_phone') or (getattr(user, 'phone', '') if user else '')
        donor_email = request.data.get('donor_email') or (user.email if user else '')
        purpose = request.data.get('purpose', 'General Donation')

        try:
            order_info = create_donation_order(
                amount=amount,
                donor_name=donor_name,
                donor_phone=donor_phone,
                donor_email=donor_email,
                purpose=purpose,
                user=user
            )
            return Response(order_info, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error(f"[Create Donation Order Error]: {e}")
            return Response({'error': f'Failed to initiate payment: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class VerifyDonationPaymentView(APIView):
    """
    Verifies Razorpay payment signature and records the donation in accounts.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        payment_id = request.data.get('payment_id')
        razorpay_order_id = request.data.get('razorpay_order_id', '')
        razorpay_payment_id = request.data.get('razorpay_payment_id', '')
        razorpay_signature = request.data.get('razorpay_signature', '')

        if not payment_id or not razorpay_payment_id:
            return Response({'error': 'Missing payment verification details.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            result = verify_donation_payment(
                payment_id=payment_id,
                razorpay_order_id=razorpay_order_id,
                razorpay_payment_id=razorpay_payment_id,
                razorpay_signature=razorpay_signature
            )
            return Response(result, status=status.HTTP_200_OK)
        except DonationPayment.DoesNotExist:
            return Response({'error': 'Payment record not found.'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"[Verify Payment Error]: {e}")
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class CreateSubscriptionView(APIView):
    """
    Creates a recurring monthly donation plan and subscription for a logged-in member.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        amount = request.data.get('amount')
        if not amount or float(amount) < 10:
            return Response({'error': 'Minimum monthly recurring donation is ₹10.'}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        donor_name = request.data.get('donor_name') or user.full_name
        donor_phone = request.data.get('donor_phone') or getattr(user, 'phone', '')
        donor_email = request.data.get('donor_email') or user.email
        purpose = request.data.get('purpose', 'Monthly Donation Autopay')

        try:
            sub_info = create_monthly_autopay_subscription(
                amount=amount,
                donor_name=donor_name,
                donor_phone=donor_phone,
                donor_email=donor_email,
                purpose=purpose,
                user=user
            )
            return Response(sub_info, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error(f"[Create Subscription Error]: {e}")
            return Response({'error': f'Failed to initiate recurring autopay: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class VerifySubscriptionView(APIView):
    """
    Verifies subscription authentication and activates monthly autopay.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        subscription_id = request.data.get('subscription_id')
        razorpay_payment_id = request.data.get('razorpay_payment_id', '')
        razorpay_signature = request.data.get('razorpay_signature', '')

        if not subscription_id:
            return Response({'error': 'Missing subscription ID.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            result = verify_subscription_payment(
                subscription_id=subscription_id,
                razorpay_payment_id=razorpay_payment_id,
                razorpay_signature=razorpay_signature
            )
            return Response(result, status=status.HTTP_200_OK)
        except DonationSubscription.DoesNotExist:
            return Response({'error': 'Subscription record not found.'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"[Verify Subscription Error]: {e}")
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class MySubscriptionView(APIView):
    """
    Returns active monthly autopay subscription details for the logged-in member,
    or allows cancelling an active subscription.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        subs = DonationSubscription.objects.filter(user=request.user).order_by('-created_at')
        active_sub = subs.filter(status=SubscriptionStatus.ACTIVE).first()
        history = [{
            'id': str(s.id),
            'subscription_id': s.razorpay_subscription_id,
            'amount': float(s.amount),
            'purpose': s.purpose,
            'status': s.status,
            'cycles_paid': s.total_cycles_paid,
            'next_charge_date': str(s.next_charge_date) if s.next_charge_date else None,
            'created_at': s.created_at.strftime('%Y-%m-%d')
        } for s in subs[:10]]

        return Response({
            'has_active_autopay': active_sub is not None,
            'active_subscription': {
                'id': str(active_sub.id),
                'subscription_id': active_sub.razorpay_subscription_id,
                'amount': float(active_sub.amount),
                'purpose': active_sub.purpose,
                'status': active_sub.status,
                'cycles_paid': active_sub.total_cycles_paid,
                'next_charge_date': str(active_sub.next_charge_date) if active_sub.next_charge_date else None,
                'created_at': active_sub.created_at.strftime('%Y-%m-%d')
            } if active_sub else None,
            'history': history
        })

    def delete(self, request):
        subscription_id = request.data.get('subscription_id')
        if not subscription_id:
            active_sub = DonationSubscription.objects.filter(user=request.user, status=SubscriptionStatus.ACTIVE).first()
            if active_sub:
                subscription_id = active_sub.razorpay_subscription_id

        if not subscription_id:
            return Response({'error': 'No active autopay subscription to cancel.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            res = cancel_user_subscription(subscription_id, request.user)
            return Response(res, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class RazorpayWebhookView(APIView):
    """
    Receives and processes asynchronous Razorpay Webhooks (e.g. subscription renewals).
    """
    permission_classes = [AllowAny]

    def post(self, request):
        webhook_secret = getattr(settings, 'RAZORPAY_WEBHOOK_SECRET', '')
        webhook_signature = request.headers.get('X-Razorpay-Signature', '')
        payload_body = request.body.decode('utf-8')

        client = get_razorpay_client()
        if webhook_secret and webhook_signature:
            try:
                client.utility.verify_webhook_signature(payload_body, webhook_signature, webhook_secret)
            except Exception as e:
                logger.warning(f"[Razorpay Webhook Signature Failure]: {e}")
                return Response({'error': 'Invalid signature'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            event_data = json.loads(payload_body)
            event_type = event_data.get('event')
            payload = event_data.get('payload', {})

            logger.info(f"[Razorpay Webhook Received]: {event_type}")

            # 1. Monthly Recurring Subscription Charge Success
            if event_type == 'subscription.charged':
                sub_entity = payload.get('subscription', {}).get('entity', {})
                payment_entity = payload.get('payment', {}).get('entity', {})
                sub_id = sub_entity.get('id')
                payment_id = payment_entity.get('id')
                amount = float(payment_entity.get('amount', 0)) / 100.0

                subscription = DonationSubscription.objects.filter(razorpay_subscription_id=sub_id).first()
                if subscription:
                    subscription.total_cycles_paid += 1
                    subscription.last_charged_at = timezone.now()
                    subscription.next_charge_date = date.today() + timedelta(days=30)
                    subscription.save()

                    # Record donation Income
                    payment = DonationPayment.objects.create(
                        donor_user=subscription.user,
                        donor_name=subscription.donor_name,
                        donor_phone=subscription.donor_phone,
                        donor_email=subscription.donor_email,
                        amount=amount or subscription.amount,
                        payment_type='MONTHLY_AUTOPAY',
                        purpose=subscription.purpose,
                        razorpay_payment_id=payment_id,
                        razorpay_subscription_id=sub_id
                    )
                    record_successful_donation(payment, payment_id)

            # 2. Subscription Cancelled
            elif event_type in ['subscription.cancelled', 'subscription.halted']:
                sub_entity = payload.get('subscription', {}).get('entity', {})
                sub_id = sub_entity.get('id')
                DonationSubscription.objects.filter(razorpay_subscription_id=sub_id).update(
                    status=SubscriptionStatus.CANCELLED,
                    updated_at=timezone.now()
                )

            return Response({'status': 'ok'}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"[Razorpay Webhook Processing Error]: {e}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class RazorpayCheckoutPageView(APIView):
    """
    Renders an in-app responsive Checkout HTML page that launches the Razorpay modal.
    Works seamlessly in WebView / Mobile browser.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        order_id = request.query_params.get('order_id', '')
        subscription_id = request.query_params.get('subscription_id', '')
        payment_id = request.query_params.get('payment_id', '')
        amount = request.query_params.get('amount', '100')
        donor_name = request.query_params.get('name', 'Supporter')
        donor_phone = request.query_params.get('phone', '')
        donor_email = request.query_params.get('email', '')
        purpose = request.query_params.get('purpose', 'Charitable Donation')
        is_sub = bool(subscription_id)

        key_id = getattr(settings, 'RAZORPAY_KEY_ID', 'rzp_test_51Abcdefghijk')
        is_mock = is_test_environment() or 'test' in key_id.lower()

        html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Sree Lakshmi Charitable Trust - Payment</title>
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
      color: #fff;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }}
    .card {{
      background: rgba(255, 255, 255, 0.98);
      color: #1e293b;
      border-radius: 20px;
      padding: 30px 24px;
      width: 100%;
      max-width: 420px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
      text-align: center;
    }}
    .logo-badge {{
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: #e0f2fe;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
      font-size: 32px;
    }}
    h1 {{ font-size: 20px; font-weight: 800; color: #0f172a; margin-bottom: 4px; }}
    .sub {{ font-size: 13px; color: #64748b; margin-bottom: 24px; }}
    .amount-box {{
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 18px;
      margin-bottom: 24px;
    }}
    .amount-label {{ font-size: 12px; text-transform: uppercase; font-weight: 700; color: #64748b; letter-spacing: 0.5px; }}
    .amount-value {{ font-size: 32px; font-weight: 900; color: #0284c7; margin-top: 4px; }}
    .recurring-tag {{
      display: inline-block;
      margin-top: 6px;
      background: #dbeafe;
      color: #1d4ed8;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 10px;
      border-radius: 20px;
    }}
    .info-row {{
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      padding: 8px 0;
      border-bottom: 1px dashed #e2e8f0;
    }}
    .info-row:last-child {{ border-bottom: none; }}
    .info-label {{ color: #64748b; }}
    .info-val {{ font-weight: 600; color: #1e293b; }}
    .btn {{
      display: block;
      width: 100%;
      background: #0284c7;
      color: #fff;
      font-size: 16px;
      font-weight: 700;
      padding: 16px;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      margin-top: 24px;
      box-shadow: 0 4px 12px rgba(2, 132, 199, 0.4);
      transition: all 0.2s;
    }}
    .btn:active {{ transform: scale(0.98); }}
    .cancel-btn {{
      background: none;
      border: none;
      color: #94a3b8;
      font-size: 13px;
      font-weight: 600;
      margin-top: 14px;
      cursor: pointer;
      padding: 6px;
    }}
    .security-note {{
      margin-top: 20px;
      font-size: 11px;
      color: rgba(255, 255, 255, 0.85);
      text-align: center;
      display: flex;
      align-items: center;
      gap: 6px;
    }}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo-badge">💙</div>
    <h1>Sree Lakshmi Trust</h1>
    <p class="sub">Secure Payment Gateway</p>

    <div class="amount-box">
      <div class="amount-label">{'Monthly Autopay' if is_sub else 'Donation Amount'}</div>
      <div class="amount-value">₹{amount}</div>
      {'<div class="recurring-tag">🔄 Renews Monthly</div>' if is_sub else ''}
    </div>

    <div class="info-row">
      <span class="info-label">Donor Name</span>
      <span class="info-val">{donor_name}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Purpose</span>
      <span class="info-val">{purpose}</span>
    </div>

    <button id="pay-btn" class="btn" onclick="openRazorpay()">
      Proceed to Pay ₹{amount}
    </button>
    <button class="cancel-btn" onclick="notifyMobile('CANCEL', {{}})">Cancel Payment</button>
  </div>

  <div class="security-note">
    🔒 256-Bit SSL Encrypted &bull; Razorpay Certified
  </div>

  <script>
    function notifyMobile(event, data) {{
      const msg = JSON.stringify({{ event: event, data: data }});
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {{
        window.ReactNativeWebView.postMessage(msg);
      }} else {{
        console.log('Mobile message:', msg);
      }}
    }}

    function openRazorpay() {{
      const isSubscription = {'true' if is_sub else 'false'};
      const isMockMode = {'true' if is_mock else 'false'};

      const options = {{
        key: '{key_id}',
        amount: {int(float(amount) * 100)},
        currency: 'INR',
        name: 'Sree Lakshmi Charitable Trust',
        description: '{purpose}',
        image: 'https://sreelakshmicharity.org/logo.png',
        prefill: {{
          name: '{donor_name}',
          email: '{donor_email}',
          contact: '{donor_phone}'
        }},
        theme: {{ color: '#0284c7' }},
        handler: function(response) {{
          notifyMobile('SUCCESS', {{
            payment_id: '{payment_id}',
            order_id: '{order_id}',
            subscription_id: '{subscription_id}',
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_order_id: response.razorpay_order_id || '{order_id}',
            razorpay_signature: response.razorpay_signature,
            amount: '{amount}'
          }});
        }},
        modal: {{
          ondismiss: function() {{
            notifyMobile('DISMISSED', {{}});
          }}
        }}
      }};

      if (isSubscription && '{subscription_id}') {{
        options.subscription_id = '{subscription_id}';
      }} else if ('{order_id}') {{
        options.order_id = '{order_id}';
      }}

      // Fallback for mock test mode sandbox
      if (isMockMode && !options.key.startsWith('rzp_live_')) {{
        // Auto-simulate or launch Razorpay
        try {{
          const rzp = new Razorpay(options);
          rzp.open();
        }} catch(e) {{
          console.log('Fallback mock checkout:', e);
          setTimeout(() => {{
            const mockTxn = 'pay_sim_' + Math.random().toString(36).substring(2, 12);
            notifyMobile('SUCCESS', {{
              payment_id: '{payment_id}',
              order_id: '{order_id}',
              subscription_id: '{subscription_id}',
              razorpay_payment_id: mockTxn,
              razorpay_order_id: '{order_id}',
              razorpay_signature: 'test_signature_mock',
              amount: '{amount}'
            }});
          }}, 1200);
        }}
        return;
      }}

      try {{
        const rzp = new Razorpay(options);
        rzp.open();
      }} catch (err) {{
        alert('Could not initialize gateway: ' + err.message);
      }}
    }}

    // Auto-launch checkout on page load
    window.onload = function() {{
      setTimeout(openRazorpay, 400);
    }};
  </script>
</body>
</html>"""
        return HttpResponse(html_content, content_type='text/html')
