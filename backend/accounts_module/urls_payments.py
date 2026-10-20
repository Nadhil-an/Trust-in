from django.urls import path
from accounts_module import views_payment

urlpatterns = [
    # One-Time Donation
    path('create-order/', views_payment.CreateDonationOrderView.as_view(), name='payment-create-order'),
    path('verify-payment/', views_payment.VerifyDonationPaymentView.as_view(), name='payment-verify'),

    # Monthly Autopay Subscription
    path('create-subscription/', views_payment.CreateSubscriptionView.as_view(), name='payment-create-subscription'),
    path('verify-subscription/', views_payment.VerifySubscriptionView.as_view(), name='payment-verify-subscription'),
    path('my-subscription/', views_payment.MySubscriptionView.as_view(), name='payment-my-subscription'),

    # Webhook
    path('webhook/', views_payment.RazorpayWebhookView.as_view(), name='payment-webhook'),

    # In-App Responsive Hosted Checkout Page
    path('checkout-page/', views_payment.RazorpayCheckoutPageView.as_view(), name='payment-checkout-page'),
]
