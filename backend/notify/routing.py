from django.urls import re_path
from notify.consumers import NotificationConsumer

websocket_urlpatterns = [
    re_path(r'^/?ws/notify/?$', NotificationConsumer.as_asgi()),
]
