from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import NotificationViewSet, WhatsAppCheckView

router = DefaultRouter()
router.register(r'history', NotificationViewSet, basename='notification')

urlpatterns = [
    path('', include(router.urls)),
    path('check-whatsapp/', WhatsAppCheckView.as_view(), name='check-whatsapp'),
]
