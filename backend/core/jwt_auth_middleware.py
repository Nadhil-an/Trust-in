"""
WebSocket JWT Authentication Middleware for Django Channels.
Reads the JWT from cookie during WebSocket handshake.
"""
from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async
from rest_framework_simplejwt.tokens import UntypedToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from django.contrib.auth.models import AnonymousUser
from urllib.parse import parse_qs
from core.models import User


@database_sync_to_async
def get_user(token_key):
    try:
        UntypedToken(token_key)
        from rest_framework_simplejwt.backends import TokenBackend
        from django.conf import settings
        data = TokenBackend(
            algorithm=settings.SIMPLE_JWT['ALGORITHM']
        ).decode(token_key, verify=True)
        return User.objects.get(id=data['user_id'])
    except Exception:
        return AnonymousUser()


class JwtAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        # Try cookie first
        headers = dict(scope.get('headers', []))
        cookie_str = headers.get(b'cookie', b'').decode()
        token = None
        for part in cookie_str.split(';'):
            part = part.strip()
            if part.startswith('access_token='):
                token = part[len('access_token='):]
                break

        # Fall back to query string ?token=...
        if not token:
            qs = parse_qs(scope.get('query_string', b'').decode())
            token = qs.get('token', [None])[0]

        scope['user'] = await get_user(token) if token else AnonymousUser()
        return await super().__call__(scope, receive, send)


def JwtAuthMiddlewareStack(inner):
    return JwtAuthMiddleware(inner)
