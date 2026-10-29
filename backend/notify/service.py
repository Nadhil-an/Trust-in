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
    tokens = list(user.expo_devices.values_list('push_token', flat=True))
    if not tokens:
        return

    broadcast_expo_push(tokens, title, message, data)


def broadcast_expo_push(tokens, title, message, data=None):
    """Send push notifications to a list of Expo tokens in batches of 100."""
    if not tokens:
        return

    # Deduplicate tokens and filter invalid ones
    unique_tokens = list(set([t for t in tokens if t and (t.startswith('ExponentPushToken') or t.startswith('ExpoPushToken'))]))
    if not unique_tokens:
        return

    # Split into batches of 100 as required by Expo
    batch_size = 100
    for i in range(0, len(unique_tokens), batch_size):
        batch = unique_tokens[i:i + batch_size]
        payloads = [
            {
                'to': token,
                'title': title,
                'body': message,
                'data': data or {},
                'sound': 'default',
                'priority': 'high',
                'channelId': 'default',
                'badge': 1,
            }
            for token in batch
        ]

        try:
            resp = requests.post(
                'https://exp.host/--/api/v2/push/send',
                json=payloads,
                headers={
                    'Accept': 'application/json',
                    'Accept-encoding': 'gzip, deflate',
                    'Content-Type': 'application/json',
                },
                timeout=8
            )
            import logging
            logging.getLogger(__name__).info(f"[Expo Push] Sent batch of {len(batch)} push tickets, status={resp.status_code}")
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"[Expo Push] Error sending Expo push batch: {e}")

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
                 reference_id: str = '', exclude_user_id=None, priority: str = 'NORMAL',
                 reference_type: str = ''):
    """Push a notification to all users of a given role."""
    users = User.objects.filter(role=role, is_active=True)
    if exclude_user_id:
        users = users.exclude(id=exclude_user_id)
    for user in users:
        push_notification(user, title, message, notification_type, reference_id, reference_type=reference_type, priority=priority)


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


def push_dashboard_refresh(roles: list = None, module: str = 'ALL', user_id=None):
    """Tell dashboard and app consumers to re-fetch stats."""
    channel_layer = get_channel_layer()
    if roles:
        for role in roles:
            try:
                async_to_sync(channel_layer.group_send)(
                    f"notify_role_{role}",
                    {'type': 'dashboard_refresh', 'module': module}
                )
            except Exception:
                pass
    if user_id:
        try:
            async_to_sync(channel_layer.group_send)(
                f"notify_{user_id}",
                {'type': 'dashboard_refresh', 'module': module}
            )
        except Exception:
            pass


def notify_post_approved_and_published(post):
    """
    Sends real-time push notification outside the mobile application when a user's
    post is approved and published.
    1. Notifies the post author directly.
    2. Broadcasts push notification outside the mobile app to all registered members.
    3. Pushes real-time WebSocket refresh so active apps update instantly.
    """
    from core.models import ExpoDevice
    author = getattr(post, 'author', None)
    if not author:
        return

    author_name = author.full_name or author.username or 'A member'
    snippet = (post.description or '').strip()
    if len(snippet) > 60:
        snippet = snippet[:60] + '...'
    elif not snippet:
        snippet = 'Check it out now on the community feed!'

    # 1. Direct notification to Post Author
    author_title = "Post Approved & Published! 🎉"
    author_msg = f"Your post \"{snippet}\" has been approved and published to the mobile application feed."
    try:
        push_notification(
            recipient=author,
            title=author_title,
            message=author_msg,
            notification_type='POST_APPROVED',
            reference_id=str(post.id),
            reference_type='MemberPost',
            priority='HIGH'
        )
    except Exception as e:
        print(f"Error sending author post approval notification: {e}")

    # 2. Push notification to all other community members (outside the mobile app)
    member_title = "New Community Post 📢"
    member_msg = f"{author_name} posted: \"{snippet}\""
    member_data = {
        'type': 'NEW_POST',
        'postId': str(post.id),
        'reference_id': str(post.id),
    }

    try:
        other_tokens = list(
            ExpoDevice.objects.exclude(user=author)
            .values_list('push_token', flat=True)
            .distinct()
        )
        if other_tokens:
            broadcast_expo_push(other_tokens, member_title, member_msg, member_data)
    except Exception as e:
        print(f"Error broadcasting new post push notification: {e}")

    # 3. Real-time WebSocket broadcast to refresh feed in all open sessions
    try:
        channel_layer = get_channel_layer()
        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                "notify_all",
                {
                    'type': 'send_notification',
                    'notification': {
                        'type': 'FEED_REFRESH',
                        'post_id': str(post.id),
                        'author_id': str(author.id),
                        'title': member_title,
                        'message': member_msg,
                    }
                }
            )
    except Exception:
        pass



def notify_post_created(post):
    """
    Sends push notifications outside the mobile application when a new post is created:
    - If already approved (Admin/Manager/Social Media): Broadcasts to all members immediately.
    - If pending approval: Notifies author of submission, and alerts moderators/managers/admins outside the app.
    """
    from core.models import MemberPostStatus
    if post.status == MemberPostStatus.APPROVED:
        notify_post_approved_and_published(post)
        return

    author = getattr(post, 'author', None)
    if not author:
        return

    author_name = author.full_name or author.username or 'A member'
    snippet = (post.description or '').strip()
    if len(snippet) > 60:
        snippet = snippet[:60] + '...'
    elif not snippet:
        snippet = 'Check it out now on the review dashboard!'

    # 1. Confirmation push notification outside app to author
    try:
        push_notification(
            recipient=author,
            title="Post Submitted for Review 📤",
            message=f"Your post \"{snippet}\" has been submitted and is under review by moderators.",
            notification_type='POST_PENDING',
            reference_id=str(post.id),
            reference_type='MemberPost',
            priority='NORMAL'
        )
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Error sending author post submission push: {e}")

    # 2. Push notification outside the mobile app to Social Media, Manager, and Admin roles
    post_type_label = 'Charity' if getattr(post, 'post_type', 'AWARENESS') == 'CHARITY' else 'Public Issue'
    mod_title = f"New {post_type_label} Post for Review 📝"
    mod_msg = f"{author_name} submitted a new post: \"{snippet}\""
    for role in ['SOCIAL_MEDIA', 'MANAGER', 'ADMIN']:
        try:
            push_to_role(
                role,
                mod_title,
                mod_msg,
                'NEW_POST_PENDING',
                reference_id=str(post.id),
                reference_type='MemberPost',
                priority='HIGH'
            )
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Error notifying {role} of new post: {e}")

    # 3. Real-time refresh of Social Media moderation dashboard
    try:
        push_dashboard_refresh(['SOCIAL_MEDIA', 'MANAGER', 'ADMIN'])
    except Exception:
        pass
