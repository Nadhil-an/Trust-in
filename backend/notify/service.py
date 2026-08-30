"""
Notification service — pushes real-time events via Django Channels channel layer.
Import and call these functions from any view after a significant action.
"""
import json
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from core.models import SystemNotification, User


import requests

def send_expo_push(user, title, message, data=None):
    from core.models import ExpoDevice
    tokens = user.expo_devices.values_list('push_token', flat=True)
    if not tokens:
        return

    payloads = []
    for token in tokens:
        payload = {
            'to': token,
            'title': title,
            'body': message,
            'data': data or {},
            'sound': 'default',
        }
        payloads.append(payload)

    try:
        requests.post(
            'https://exp.host/--/api/v2/push/send',
            json=payloads,
            headers={
                'Accept': 'application/json',
                'Accept-encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
            },
            timeout=5
        )
    except Exception as e:
        print(f"Error sending Expo push: {e}")

def push_notification(recipient: User, title: str, message: str,
                      notification_type: str, reference_id: str = '',
                      reference_type: str = '', priority: str = 'NORMAL'):
    """Create a DB notification and push via WebSocket."""
    notif = SystemNotification.objects.create(
        recipient=recipient,
        title=title,
        message=message,
        notification_type=notification_type,
        reference_id=reference_id,
        reference_type=reference_type,
        priority=priority,
    )
    
    # Send Expo Push Notification
    send_expo_push(recipient, title, message, data={'type': notification_type, 'reference_id': reference_id})

    channel_layer = get_channel_layer()
    group_name = f"notify_{str(recipient.id)}"
    payload = {
        'id': str(notif.id),
        'title': title,
        'message': message,
        'type': notification_type,
        'reference_id': reference_id,
        'priority': priority,
        'created_at': notif.created_at.isoformat(),
    }
    try:
        async_to_sync(channel_layer.group_send)(
            group_name,
            {'type': 'send_notification', 'notification': payload}
        )
    except Exception:
        pass  # If WebSocket layer is not ready, skip — notification is already in DB
    return notif


def push_to_role(role: str, title: str, message: str, notification_type: str,
                 reference_id: str = '', exclude_user_id=None):
    """Push a notification to all users of a given role."""
    users = User.objects.filter(role=role, is_active=True)
    if exclude_user_id:
        users = users.exclude(id=exclude_user_id)
    for user in users:
        push_notification(user, title, message, notification_type, reference_id)


def push_request_update(request_id: str, request_number: str, new_status: str,
                        actor_role: str, target_roles: list):
    """Push a real-time request status update to target role dashboards."""
    channel_layer = get_channel_layer()
    data = {
        'request_id': request_id,
        'request_number': request_number,
        'new_status': new_status,
    }
    for role in target_roles:
        try:
            async_to_sync(channel_layer.group_send)(
                f"notify_role_{role}",
                {'type': 'request_update', 'data': data}
            )
        except Exception:
            pass


def push_dashboard_refresh(roles: list, module: str = 'ALL'):
    """Tell dashboard consumers to re-fetch stats."""
    channel_layer = get_channel_layer()
    for role in roles:
        try:
            async_to_sync(channel_layer.group_send)(
                f"notify_role_{role}",
                {'type': 'dashboard_refresh', 'module': module}
            )
        except Exception:
            pass
