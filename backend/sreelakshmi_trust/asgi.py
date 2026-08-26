"""
ASGI config for Sree Lakshmi Trust — supports HTTP + WebSocket via Django Channels
"""
import os
from django.core.asgi import get_asgi_application

# 1. Set settings module FIRST
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sreelakshmi_trust.settings')

# 2. Initialize Django ASGI application NEXT (this loads the settings and apps)
django_asgi_app = get_asgi_application()

# 3. NOW it is safe to import local modules that depend on Django settings
from channels.routing import ProtocolTypeRouter, URLRouter
from core.jwt_auth_middleware import JwtAuthMiddlewareStack
import notify.routing

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": JwtAuthMiddlewareStack(
        URLRouter(notify.routing.websocket_urlpatterns)
    ),
})
