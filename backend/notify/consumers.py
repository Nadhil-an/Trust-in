"""WebSocket consumer for real-time notifications"""
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from core.models import SystemNotification


class NotificationConsumer(AsyncWebsocketConsumer):
    """
    Each user connects to their personal group: notify_<user_id>
    Role groups: notify_role_MANAGER, notify_role_ACCOUNTANT, etc.
    """

    async def connect(self):
        user = self.scope.get('user')
        if not user or not user.is_authenticated:
            await self.close(code=4001)
            return

        self.user_id = str(user.id)
        self.user_group = f"notify_{self.user_id}"
        self.role_group = f"notify_role_{user.role}"

        # Join personal group
        await self.channel_layer.group_add(self.user_group, self.channel_name)
        # Join role group
        await self.channel_layer.group_add(self.role_group, self.channel_name)

        await self.accept()

        # Send unread count on connect
        count = await self.get_unread_count(user)
        await self.send(text_data=json.dumps({
            'type': 'INIT',
            'unread_count': count
        }))

    async def disconnect(self, close_code):
        if hasattr(self, 'user_group'):
            await self.channel_layer.group_discard(self.user_group, self.channel_name)
            await self.channel_layer.group_discard(self.role_group, self.channel_name)

    async def receive(self, text_data):
        """Handle client messages (e.g., mark as read)"""
        try:
            data = json.loads(text_data)
            if data.get('type') == 'MARK_READ':
                notif_id = data.get('id')
                if notif_id:
                    await self.mark_notification_read(notif_id)
        except (json.JSONDecodeError, KeyError):
            pass

    # ── Channel layer event handlers ───────────────────────────

    async def send_notification(self, event):
        """Handles 'send_notification' event from channel layer."""
        await self.send(text_data=json.dumps({
            'type': 'NOTIFICATION',
            'notification': event['notification']
        }))

    async def request_update(self, event):
        """Handles 'request_update' event — real-time status push."""
        await self.send(text_data=json.dumps({
            'type': 'REQUEST_UPDATE',
            'data': event['data']
        }))

    async def dashboard_refresh(self, event):
        """Triggers a dashboard stats refresh."""
        await self.send(text_data=json.dumps({
            'type': 'DASHBOARD_REFRESH',
            'module': event.get('module', 'ALL')
        }))

    # ── DB helpers ─────────────────────────────────────────────

    @database_sync_to_async
    def get_unread_count(self, user):
        return SystemNotification.objects.filter(recipient=user, is_read=False).count()

    @database_sync_to_async
    def mark_notification_read(self, notif_id):
        try:
            notif = SystemNotification.objects.get(id=notif_id)
            notif.mark_read()
        except SystemNotification.DoesNotExist:
            pass
