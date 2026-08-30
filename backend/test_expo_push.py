import os
import django
import sys

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sreelakshmi_trust.settings')
django.setup()

from notify.service import push_notification
from core.models import User, ExpoDevice

def test_greeting():
    print("Finding users with Expo Push Tokens...")
    devices = ExpoDevice.objects.all()
    
    if not devices.exists():
        print("--------------------------------------------------")
        print("⚠️ No devices registered for Push Notifications yet!")
        print("Please OPEN THE MOBILE APP first and allow notifications.")
        print("The app will automatically send the token to the server.")
        print("--------------------------------------------------")
        return

    users = User.objects.filter(id__in=devices.values('user_id'))
    print(f"Found {users.count()} users with registered devices.")

    for user in users:
        print(f"Sending greeting to {user.full_name} ({user.username})...")
        push_notification(
            recipient=user,
            title="Good Morning! ☀️",
            message=f"Hello {user.full_name}, wishing you a great day ahead! - Sree Lakshmi Trust",
            notification_type="GREETING"
        )
    print("Done! Check your mobile phone for notifications.")

if __name__ == '__main__':
    test_greeting()
