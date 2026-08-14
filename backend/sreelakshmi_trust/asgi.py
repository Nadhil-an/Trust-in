"""
ASGI config for Sree Lakshmi Trust — supports HTTP + WebSocket via Django Channels
"""
import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from core.jwt_auth_middleware import JwtAuthMiddlewareStack
import notify.routing

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sreelakshmi_trust.settings')

django_asgi_app = get_asgi_application()

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AllowedHostsOriginValidator(
        JwtAuthMiddlewareStack(
            URLRouter(notify.routing.websocket_urlpatterns)
        )
    ),
})
