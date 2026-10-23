"""
Middleware for:
1. AuditMiddleware  — captures request context for audit logging
2. SecurityHeadersMiddleware — adds OWASP-recommended HTTP headers
"""
from django.utils import timezone
from django.utils.deprecation import MiddlewareMixin


class AuditMiddleware(MiddlewareMixin):
    """Attaches request context so views can log to AuditLog."""
    def process_request(self, request):
        request.audit_ip = self._get_client_ip(request)
        request.audit_user_agent = request.META.get('HTTP_USER_AGENT', '')

    def _get_client_ip(self, request):
        x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded:
            return x_forwarded.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR')


class SecurityHeadersMiddleware(MiddlewareMixin):
    """Adds OWASP-recommended security headers to every response."""
    def process_response(self, request, response):
        response['X-Content-Type-Options'] = 'nosniff'
        response['X-XSS-Protection'] = '1; mode=block'
        response['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        response['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=()'

        # Allow Razorpay checkout, scripts, stylesheets, and iframes on payment routes
        if request.path.startswith('/api/payments/checkout-page'):
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

        response['X-Frame-Options'] = 'DENY'
        response['Content-Security-Policy'] = (
            "default-src 'self'; "
            "script-src 'self'; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data: blob:; "
            "connect-src 'self' ws://localhost:8000 wss://localhost:8000;"
        )
        return response
