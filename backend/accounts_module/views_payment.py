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
        payment_id = request.data.get('payment_id') or request.data.get('internal_payment_id') or ''
        razorpay_order_id = request.data.get('razorpay_order_id') or request.data.get('order_id') or ''
        razorpay_payment_id = request.data.get('razorpay_payment_id') or request.data.get('payment_id') or ''
        razorpay_signature = request.data.get('razorpay_signature') or request.data.get('signature') or ''

        if not payment_id and not razorpay_order_id:
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
        subscription_id = request.data.get('subscription_id') or request.data.get('razorpay_subscription_id', '')
        razorpay_payment_id = request.data.get('razorpay_payment_id') or request.data.get('payment_id', '')
        razorpay_signature = request.data.get('razorpay_signature') or request.data.get('signature', '')

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
    Renders an in-app checkout HTML page that immediately launches the standard
    official Razorpay UI modal (UPI, Cards, Netbanking, Wallets).
    """
    permission_classes = [AllowAny]

    def get(self, request):
        order_id = request.query_params.get('order_id', '').strip()
        subscription_id = request.query_params.get('subscription_id', '').strip()
        payment_id = request.query_params.get('payment_id', '').strip()
        amount = request.query_params.get('amount', '100').strip()

        donor_name = (
            request.query_params.get('prefill_name') or
            request.query_params.get('name') or
            'Supporter'
        ).strip()
        donor_phone = (
            request.query_params.get('prefill_contact') or
            request.query_params.get('phone') or
            ''
        ).strip()
        donor_email = (
            request.query_params.get('prefill_email') or
            request.query_params.get('email') or
            ''
        ).strip()
        purpose = (
            request.query_params.get('description') or
            request.query_params.get('purpose') or
            'Charitable Donation'
        ).strip()
        is_sub = bool(subscription_id)

        # Auto-resolve from database if order_id is present
        if order_id:
            try:
                dp = DonationPayment.objects.filter(razorpay_order_id=order_id).first()
                if dp:
                    if not payment_id:
                        payment_id = str(dp.id)
                    if dp.donor_name and (donor_name in ['Supporter', 'Sree Lakshmi Charitable Trust', ''] or not donor_name):
                        donor_name = dp.donor_name
                    if dp.donor_phone and not donor_phone:
                        donor_phone = dp.donor_phone
                    if dp.donor_email and not donor_email:
                        donor_email = dp.donor_email
                    if dp.purpose:
                        purpose = dp.purpose
                    amount = str(int(dp.amount))
            except Exception as ex:
                logger.warning(f"[Checkout Page] Could not lookup order {order_id}: {ex}")

        # Resolve Key ID (query param > settings > fallback)
        key_id = (
            request.query_params.get('key_id') or
            getattr(settings, 'RAZORPAY_KEY_ID', '') or
            'rzp_test_TrMc9sKWwMP1pH'
        ).strip()

        is_mock = is_test_environment() or 'test' in key_id.lower() or key_id.startswith('rzp_test_')

        try:
            amount_in_paise = int(float(amount) * 100)
        except Exception:
            amount_in_paise = 10000

        html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Sree Lakshmi Charitable Trust - Payment</title>
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    html, body {{
      width: 100%;
      height: 100%;
      background: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #fff;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }}
    .backdrop {{
      text-align: center;
      padding: 24px;
      max-width: 380px;
      width: 90%;
      background: rgba(30, 41, 59, 0.7);
      backdrop-filter: blur(10px);
      border-radius: 20px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }}
    .spinner {{
      width: 48px;
      height: 48px;
      border: 4px solid rgba(255, 255, 255, 0.15);
      border-top-color: #0284c7;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 16px;
    }}
    @keyframes spin {{ to {{ transform: rotate(360deg); }} }}
    .title {{ font-size: 18px; font-weight: 800; color: #f8fafc; margin-bottom: 4px; }}
    .desc {{ font-size: 13px; color: #94a3b8; margin-bottom: 16px; line-height: 1.4; }}
    .amount-badge {{
      display: inline-block;
      background: #0284c7;
      color: #fff;
      font-size: 20px;
      font-weight: 900;
      padding: 6px 16px;
      border-radius: 30px;
      margin-bottom: 20px;
      letter-spacing: 0.5px;
    }}
    .btn {{
      display: block;
      width: 100%;
      background: #0284c7;
      color: #fff;
      font-size: 15px;
      font-weight: 700;
      padding: 13px;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      margin-top: 10px;
      box-shadow: 0 4px 12px rgba(2, 132, 199, 0.35);
    }}
    .btn-test {{
      background: #10b981;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35);
    }}
    .btn-cancel {{
      background: transparent;
      border: none;
      color: #94a3b8;
      font-size: 13px;
      font-weight: 600;
      margin-top: 14px;
      cursor: pointer;
      padding: 6px;
    }}
  </style>
</head>
<body>
  <div class="backdrop">
    <div id="loader-spinner" class="spinner"></div>
    <div class="title">Opening Razorpay Standard Checkout</div>
    <div class="desc">Please select your payment method (UPI, Cards, Netbanking) in the Razorpay window.</div>
    <div class="amount-badge">₹{amount}</div>

    <button id="open-btn" class="btn" onclick="openRazorpay()" style="display:none;">
      Re-open Razorpay UI
    </button>

    {'<button id="test-btn" class="btn btn-test" onclick="simulateSandboxSuccess()" style="display:none;">⚡ Instant Sandbox Test Pay (Success)</button>' if is_mock else ''}

    <br/>
    <button class="btn-cancel" onclick="sendCancel()">Cancel Payment</button>
  </div>

  <script>
    var paymentInProgress = false;

    function notifyMobile(payloadObj) {{
      try {{
        var msg = typeof payloadObj === 'string' ? payloadObj : JSON.stringify(payloadObj);
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {{
          window.ReactNativeWebView.postMessage(msg);
        }} else {{
          console.log('Mobile postMessage:', msg);
        }}
      }} catch(err) {{
        console.error('notifyMobile error:', err);
      }}
    }}

    function sendSuccess(paymentId, orderId, signature) {{
      if (paymentInProgress) return;
      paymentInProgress = true;

      paymentId = paymentId || ('pay_test_' + Math.random().toString(36).substring(2, 12));
      orderId = orderId || '{order_id}';
      signature = signature || 'test_signature_mock';

      var payload = {{
        status: 'SUCCESS',
        event: 'SUCCESS',
        order_id: orderId,
        payment_id: paymentId,
        razorpay_payment_id: paymentId,
        razorpay_order_id: orderId,
        signature: signature,
        razorpay_signature: signature,
        subscription_id: '{subscription_id}',
        amount: '{amount}',
        data: {{
          status: 'SUCCESS',
          payment_id: '{payment_id}',
          internal_payment_id: '{payment_id}',
          order_id: orderId,
          subscription_id: '{subscription_id}',
          razorpay_payment_id: paymentId,
          razorpay_order_id: orderId,
          razorpay_signature: signature,
          signature: signature,
          amount: '{amount}'
        }}
      }};

      notifyMobile(payload);
    }}

    function sendCancel() {{
      var payload = {{
        status: 'CANCELLED',
        event: 'CANCEL',
        data: {{
          status: 'CANCELLED'
        }}
      }};
      notifyMobile(payload);
    }}

    function simulateSandboxSuccess() {{
      var mockPayId = 'pay_test_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
      sendSuccess(mockPayId, '{order_id}', 'test_signature_mock');
    }}

    function openRazorpay() {{
      var isSubscription = {'true' if is_sub else 'false'};
      var keyId = '{key_id}';
      var orderId = '{order_id}';
      var subId = '{subscription_id}';

      if (typeof Razorpay === 'undefined') {{
        setTimeout(openRazorpay, 300);
        return;
      }}

      var options = {{
        key: keyId,
        name: 'Sree Lakshmi Charitable Trust',
        description: '{purpose}',
        prefill: {{
          name: '{donor_name}',
          email: '{donor_email}',
          contact: '{donor_phone}'
        }},
        theme: {{ color: '#0284c7' }},
        handler: function(response) {{
          sendSuccess(
            response.razorpay_payment_id,
            response.razorpay_order_id || orderId,
            response.razorpay_signature
          );
        }},
        modal: {{
          confirm_close: true,
          escape: true,
          ondismiss: function() {{
            sendCancel();
          }}
        }}
      }};

      if (isSubscription && subId) {{
        options.subscription_id = subId;
      }} else if (orderId) {{
        options.order_id = orderId;
      }} else {{
        options.amount = {amount_in_paise};
        options.currency = 'INR';
      }}

      try {{
        var rzp = new Razorpay(options);
        rzp.on('payment.failed', function(resp) {{
          alert('Payment Failed: ' + (resp.error ? resp.error.description : 'Transaction was not completed.'));
        }});
        rzp.open();

        // Reveal buttons if modal is closed or user returns
        setTimeout(function() {{
          var ob = document.getElementById('open-btn');
          if (ob) ob.style.display = 'block';
          var tb = document.getElementById('test-btn');
          if (tb) tb.style.display = 'block';
        }}, 2000);
      }} catch(err) {{
        console.error('Razorpay open error:', err);
        var ob = document.getElementById('open-btn');
        if (ob) ob.style.display = 'block';
        var tb = document.getElementById('test-btn');
        if (tb) tb.style.display = 'block';
      }}
    }}

    // Auto-launch checkout once script is loaded
    if (document.readyState === 'complete') {{
      openRazorpay();
    }} else {{
      window.addEventListener('load', function() {{
        setTimeout(openRazorpay, 100);
      }});
    }}
  </script>
</body>
</html>"""
        response = HttpResponse(html_content, content_type='text/html; charset=utf-8')
        response['X-Frame-Options'] = 'ALLOWALL'
        response['Content-Security-Policy'] = (
            "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; "
            "script-src * 'unsafe-inline' 'unsafe-eval' https://*.razorpay.com https://checkout.razorpay.com; "
            "style-src * 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src * data: https://fonts.gstatic.com; "
            "img-src * data: blob: https://*.razorpay.com; "
            "frame-src * https://*.razorpay.com https://api.razorpay.com; "
            "connect-src * https://*.razorpay.com https://api.razorpay.com https://lumberjack.razorpay.com;"
        )
        return response
