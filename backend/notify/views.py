from rest_framework import viewsets, mixins, permissions
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from core.models import SystemNotification
from rest_framework import serializers
import requests as http_requests
from django.conf import settings

class SystemNotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemNotification
        fields = ['id', 'title', 'message', 'notification_type', 'reference_id', 'reference_type', 'priority', 'is_read', 'created_at']

class NotificationViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = SystemNotificationSerializer

    def get_queryset(self):
        return SystemNotification.objects.filter(recipient=self.request.user)

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.mark_read()
        return Response({'status': 'read'})
    
    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        for notif in self.get_queryset().filter(is_read=False):
            notif.mark_read()
        return Response({'status': 'all_read'})

    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        count = self.get_queryset().filter(is_read=False).count()
        return Response({'count': count})


class WhatsAppCheckView(APIView):
    """Silently check if a phone number has WhatsApp registered. Proxies to local gateway."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        phone = request.query_params.get('phone', '').strip()
        if not phone:
            return Response({'has_whatsapp': None, 'error': 'phone required'}, status=400)

        gateway_url = getattr(settings, 'WHATSAPP_GATEWAY_URL', '')
        token = getattr(settings, 'WHATSAPP_GATEWAY_TOKEN', '')

        if not gateway_url:
            return Response({'has_whatsapp': None, 'reason': 'gateway_not_configured'})

        # Build the check URL from the send-message URL
        check_url = gateway_url.replace('/send-message', '/check-whatsapp')

        try:
            res = http_requests.get(
                check_url,
                params={'phone': phone},
                headers={'Authorization': f'Bearer {token}'},
                timeout=8
            )
            data = res.json()
            return Response({
                'has_whatsapp': data.get('has_whatsapp'),
                'phone': data.get('phone'),
                'reason': data.get('reason'),
            })
        except Exception as e:
            # Gateway offline or error — return null so frontend stays neutral
            return Response({'has_whatsapp': None, 'reason': 'gateway_error'})
