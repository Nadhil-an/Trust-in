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
    Renders an in-app checkout HTML page that immediately launches the official
    Razorpay Standard UI modal. Works in both test/sandbox and live production.

    Test mode (rzp_test_...):
      - Cards:      4111 1111 1111 1111, any expiry, CVV 111
      - UPI:        success@razorpay
      - Netbanking: Pick any bank -> click 'Success'
    """
    permission_classes = [AllowAny]

    def get(self, request):
        order_id        = request.query_params.get('order_id', '').strip()
        subscription_id = request.query_params.get('subscription_id', '').strip()
        payment_id      = request.query_params.get('payment_id', '').strip()
        amount          = request.query_params.get('amount', '100').strip()
        key_id          = request.query_params.get('key_id', '').strip() or getattr(settings, 'RAZORPAY_KEY_ID', '')
        purpose         = request.query_params.get('description', 'Charitable Donation').strip()

        donor_name  = (request.query_params.get('prefill_name')    or request.query_params.get('name')    or 'Supporter').strip()
        donor_phone = (request.query_params.get('prefill_contact') or request.query_params.get('phone')   or '').strip()
        donor_email = (request.query_params.get('prefill_email')   or request.query_params.get('email')   or '').strip()

        is_mock    = is_test_environment() or key_id.startswith('rzp_test_')
        is_sub     = bool(subscription_id)
        amount_num = float(amount) if amount else 100
        amount_in_paise = int(amount_num * 100)

        # Try to enrich donor details from DB if we have an order_id
        if order_id and not donor_phone:
            try:
                payment_obj = DonationPayment.objects.filter(razorpay_order_id=order_id).first()
                if payment_obj:
                    donor_name  = donor_name  or payment_obj.donor_name  or donor_name
                    donor_phone = donor_phone or payment_obj.donor_phone  or donor_phone
                    donor_email = donor_email or payment_obj.donor_email  or donor_email
                    if not payment_id:
                        payment_id = str(payment_obj.id)
            except Exception:
                pass

        def js_str(s):
            return str(s).replace('\\', '\\\\').replace("'", "\\'").replace('"', '\\"').replace('\n', ' ').replace('\r', '')

        _AMOUNT_DISPLAY = f"{amount_num:.0f}"
        _ORDER_ID       = js_str(order_id)
        _SUB_ID         = js_str(subscription_id)
        _PAY_ID         = js_str(payment_id)
        _KEY_ID         = js_str(key_id)
        _PURPOSE        = js_str(purpose)
        _DONOR_NAME     = js_str(donor_name)
        _DONOR_PHONE    = js_str(donor_phone)
        _DONOR_EMAIL    = js_str(donor_email)
        _IS_SUB_JS      = 'true' if is_sub else 'false'
        _AMOUNT_PAISE   = str(amount_in_paise)

        test_badge_html = ''
        test_guide_html = ''
        test_btn_html   = ''
        if is_mock:
            test_badge_html = '<div class="test-badge">&#9889; TEST MODE (SANDBOX)</div>'
            test_guide_html = (
                '<div class="sandbox-guide">'
                '  <div class="guide-title">&#129514; Indian Domestic Sandbox Test Credentials</div>'
                '  <div class="guide-item">&#128179; <strong>Indian Visa Card:</strong> <code>4100 2800 0000 1007</code> (exp: 12/28, CVV: 111)</div>'
                '  <div class="guide-item">&#128179; <strong>Indian RuPay Card:</strong> <code>6527 6589 0000 1005</code> (exp: 12/28, CVV: 111)</div>'
                '  <div class="guide-item">&#128241; <strong>UPI:</strong> Enter <code>success@razorpay</code></div>'
                '  <div class="guide-item">&#127974; <strong>Netbanking:</strong> Pick SBI / HDFC &rarr; click Success</div>'
                '</div>'
            )
            test_btn_html = (
                '<button type="button" id="test-btn" class="btn btn-test" onclick="simulateSandboxSuccess()">'
                '  &#9889; Instant 1-Tap Test Pay (Skip Modal)'
                '</button>'
            )

        html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
  <title>Razorpay Checkout - Sree Lakshmi Charitable Trust</title>
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }}
    body {{
      min-height: 100vh;
      background: linear-gradient(145deg, #0f172a 0%, #1e293b 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      color: #f8fafc;
    }}
    .checkout-card {{
      background: rgba(30, 41, 59, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 20px;
      padding: 24px 20px;
      width: 100%;
      max-width: 400px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
      text-align: center;
    }}
    .test-badge {{
      display: inline-block;
      background: #f59e0b;
      color: #78350f;
      font-size: 11px;
      font-weight: 800;
      padding: 3px 10px;
      border-radius: 12px;
      margin-bottom: 12px;
      letter-spacing: 0.5px;
    }}
    .org-title {{
      font-size: 12px;
      font-weight: 800;
      color: #38bdf8;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin-bottom: 4px;
    }}
    .payment-title {{
      font-size: 19px;
      font-weight: 800;
      color: #ffffff;
      margin-bottom: 6px;
    }}
    .purpose-text {{
      font-size: 13px;
      color: #94a3b8;
      margin-bottom: 16px;
      line-height: 1.4;
    }}
    .amount-box {{
      background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
      border-radius: 16px;
      padding: 14px;
      margin-bottom: 16px;
      box-shadow: 0 6px 20px rgba(2, 132, 199, 0.35);
    }}
    .amount-label {{
      font-size: 11px;
      color: rgba(255, 255, 255, 0.85);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }}
    .amount-val {{
      font-size: 28px;
      font-weight: 900;
      color: #ffffff;
      margin-top: 2px;
    }}
    .status-box {{
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      margin-bottom: 18px;
      font-size: 13px;
      color: #cbd5e1;
      min-height: 28px;
    }}
    .spinner {{
      width: 18px;
      height: 18px;
      border: 2px solid rgba(255, 255, 255, 0.2);
      border-top-color: #38bdf8;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }}
    @keyframes spin {{ to {{ transform: rotate(360deg); }} }}
    .sandbox-guide {{
      background: rgba(245, 158, 11, 0.1);
      border: 1px solid rgba(245, 158, 11, 0.3);
      border-radius: 12px;
      padding: 12px;
      text-align: left;
      font-size: 11.5px;
      color: #fcd34d;
      margin-bottom: 16px;
      line-height: 1.5;
    }}
    .guide-title {{
      font-weight: 800;
      color: #fbbf24;
      margin-bottom: 6px;
      font-size: 12px;
    }}
    .guide-item {{ margin-bottom: 4px; }}
    .guide-item code {{
      background: rgba(0, 0, 0, 0.35);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: monospace;
      color: #ffffff;
    }}
    .btn {{
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      padding: 14px;
      border: none;
      border-radius: 14px;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s ease;
      margin-bottom: 10px;
    }}
    .btn-primary {{
      background: linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%);
      color: #ffffff;
      box-shadow: 0 4px 14px rgba(2, 132, 199, 0.4);
    }}
    .btn-primary:active {{ transform: scale(0.98); opacity: 0.9; }}
    .btn-test {{
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: #ffffff;
      box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35);
    }}
    .btn-test:active {{ transform: scale(0.98); opacity: 0.9; }}
    .btn-cancel {{
      background: transparent;
      color: #94a3b8;
      font-size: 13px;
      font-weight: 600;
      padding: 10px;
      margin-top: 4px;
    }}
    .footer-secure {{
      margin-top: 14px;
      font-size: 11px;
      color: #64748b;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }}
  </style>
</head>
<body>
  <div class="checkout-card">
    {test_badge_html}
    <div class="org-title">Sree Lakshmi Charitable Trust</div>
    <div class="payment-title">Secure Payment Gateway</div>
    <div class="purpose-text">{_PURPOSE}</div>

    <div class="amount-box">
      <div class="amount-label">Amount Payable</div>
      <div class="amount-val">&#8377;{_AMOUNT_DISPLAY}</div>
    </div>

    <div class="status-box" id="status-box">
      <div class="spinner" id="spinner"></div>
      <span id="status-text">Opening Razorpay Standard UI...</span>
    </div>

    {test_guide_html}

    <button type="button" id="open-btn" class="btn btn-primary" onclick="openRazorpay()">
      &#128274; Open Razorpay Payment
    </button>

    {test_btn_html}

    <button type="button" class="btn btn-cancel" onclick="sendCancel()">
      Cancel and Return
    </button>

    <div class="footer-secure">
      &#128274; 256-Bit SSL Encrypted &bull; Razorpay Certified
    </div>
  </div>

  <script>
    var paymentInProgress = false;
    var rzpInstance = null;

    function notifyMobile(payloadObj) {{
      try {{
        var msg = (typeof payloadObj === 'string') ? payloadObj : JSON.stringify(payloadObj);
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {{
          window.ReactNativeWebView.postMessage(msg);
        }} else {{
          console.log('[RazorpayCheckout] postMessage:', msg);
        }}
      }} catch (err) {{
        console.error('[RazorpayCheckout] notify error:', err);
      }}
    }}

    function sendSuccess(paymentId, orderId, signature) {{
      if (paymentInProgress) return;
      paymentInProgress = true;

      paymentId = paymentId || ('pay_test_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6));
      orderId   = orderId   || '{_ORDER_ID}';
      signature = signature || 'test_signature_mock';

      setStatus('Payment confirmed! Finalizing receipt...', false);

      var payload = {{
        status: 'SUCCESS',
        event: 'SUCCESS',
        order_id: orderId,
        payment_id: paymentId,
        razorpay_payment_id: paymentId,
        razorpay_order_id: orderId,
        signature: signature,
        razorpay_signature: signature,
        subscription_id: '{_SUB_ID}',
        amount: '{_AMOUNT_DISPLAY}',
        data: {{
          status: 'SUCCESS',
          payment_id: paymentId,
          internal_payment_id: '{_PAY_ID}',
          order_id: orderId,
          subscription_id: '{_SUB_ID}',
          razorpay_payment_id: paymentId,
          razorpay_order_id: orderId,
          razorpay_signature: signature,
          signature: signature,
          amount: '{_AMOUNT_DISPLAY}'
        }}
      }};

      notifyMobile(payload);
    }}

    function sendCancel() {{
      var payload = {{
        status: 'CANCELLED',
        event: 'CANCEL',
        data: {{ status: 'CANCELLED' }}
      }};
      notifyMobile(payload);
    }}

    function simulateSandboxSuccess() {{
      var mockPayId = 'pay_test_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
      sendSuccess(mockPayId, '{_ORDER_ID}', 'test_signature_mock');
    }}

    function setStatus(msg, showSpin) {{
      var textEl = document.getElementById('status-text');
      var spinEl = document.getElementById('spinner');
      if (textEl) textEl.textContent = msg;
      if (spinEl) spinEl.style.display = (showSpin === false) ? 'none' : 'block';
    }}

    function openRazorpay() {{
      if (typeof Razorpay === 'undefined') {{
        setStatus('Loading Razorpay SDK...', true);
        setTimeout(openRazorpay, 350);
        return;
      }}

      var isSubscription = {_IS_SUB_JS};
      var keyId   = '{_KEY_ID}';
      var orderId = '{_ORDER_ID}';
      var subId   = '{_SUB_ID}';

      // Always supply amount and currency for SDK validation
      var options = {{
        key: keyId,
        amount: {_AMOUNT_PAISE},
        currency: 'INR',
        name: 'Sree Lakshmi Charitable Trust',
        description: '{_PURPOSE}',
        prefill: {{
          name: '{_DONOR_NAME}',
          email: '{_DONOR_EMAIL}',
          contact: '{_DONOR_PHONE}'
        }},
        theme: {{ color: '#0284c7' }},
        retry: {{ enabled: true, max_count: 4 }},
        handler: function(response) {{
          sendSuccess(
            response.razorpay_payment_id,
            response.razorpay_order_id || orderId,
            response.razorpay_signature
          );
        }},
        modal: {{
          confirm_close: true,
          escape: false,
          ondismiss: function() {{
            setStatus('Payment cancelled or closed. Tap below to retry.', false);
            var ob = document.getElementById('open-btn');
            if (ob) ob.style.display = 'flex';
          }}
        }}
      }};

      if (isSubscription && subId) {{
        options.subscription_id = subId;
      }} else if (orderId) {{
        options.order_id = orderId;
      }}

      try {{
        rzpInstance = new Razorpay(options);
        rzpInstance.on('payment.failed', function(resp) {{
          console.warn('[Razorpay] payment.failed:', resp.error);
          var desc = (resp && resp.error && resp.error.description) ? resp.error.description : 'Payment failed. Please retry.';
          setStatus(desc, false);
          var ob = document.getElementById('open-btn');
          if (ob) ob.style.display = 'flex';
        }});

        rzpInstance.open();
        setStatus('Please complete payment in the Razorpay window above.', false);
      }} catch(err) {{
        console.error('[Razorpay] open error:', err);
        setStatus('Could not auto-launch Razorpay. Tap button below.', false);
        var ob = document.getElementById('open-btn');
        if (ob) ob.style.display = 'flex';
      }}
    }}

    // Auto-launch Razorpay after DOM is ready
    if (document.readyState === 'complete') {{
      setTimeout(openRazorpay, 200);
    }} else {{
      window.addEventListener('load', function() {{
        setTimeout(openRazorpay, 250);
      }});
    }}
  </script>
</body>
</html>"""

        response = HttpResponse(html_content, content_type='text/html; charset=utf-8')
        response['X-Frame-Options'] = 'ALLOWALL'
        return response
