from django.core.management.base import BaseCommand
from core.models import User, ExpoDevice
from notify.service import push_notification

class Command(BaseCommand):
    help = 'Sends a daily morning greeting push notification to all active staff members'

    def handle(self, *args, **options):
        devices = ExpoDevice.objects.all()
        if not devices.exists():
            self.stdout.write(self.style.WARNING("No devices registered for push notifications."))
            return

        # Get unique users who have at least one registered device
        users = User.objects.filter(id__in=devices.values('user_id'), is_active=True)
        count = 0

        for user in users:
            try:
                push_notification(
                    recipient=user,
                    title="Good Morning! ☀️",
                    message=f"Hello {user.full_name}, wishing you a great day ahead! - Sree Lakshmi Trust",
                    notification_type="GREETING"
                )
                count += 1
            except Exception as e:
                self.stderr.write(f"Failed to send to {user.username}: {e}")

        self.stdout.write(self.style.SUCCESS(f"Successfully sent morning greetings to {count} users."))
