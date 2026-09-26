from django.core.management.base import BaseCommand
from django.utils import timezone
from core.models import User, ExpoDevice, Role
from hr_module.models import Attendance
from notify.service import push_notification
from django.db.models import Q

class Command(BaseCommand):
    help = 'Sends checkout reminders to staff who have not checked out yet (runs after 5 PM)'

    def handle(self, *args, **options):
        # Verify time is 5 PM or later
        now = timezone.localtime(timezone.now())
        if now.hour < 17:
            self.stdout.write(self.style.WARNING("It is before 5 PM. No reminders will be sent."))
            return

        today = now.date()

        # Find attendance records for today where check_in exists, check_out is null, and status is PRESENT, LATE, or HALF_DAY
        pending_checkouts = Attendance.objects.filter(
            date=today,
            check_in__isnull=False,
            check_out__isnull=True,
            status__in=['PRESENT', 'LATE', 'HALF_DAY']
        )
        
        count = 0

        for att in pending_checkouts:
            officer = att.employee
            # Try to find the corresponding User account
            q = Q()
            if officer.email:
                q |= Q(email__iexact=officer.email.strip())
            if officer.phone:
                q |= Q(phone__iexact=officer.phone.strip())
            if officer.full_name:
                cleaned_name = officer.full_name.strip()
                q |= Q(full_name__iexact=cleaned_name)
                q |= Q(username__iexact=cleaned_name)
            if officer.employee_id:
                q |= Q(username__iexact=officer.employee_id)
                q |= Q(staff_uid=officer.employee_id)

            if q:
                # Find matching STAFF user
                user = User.objects.filter(q, role=Role.STAFF).first()
                if user:
                    # Send push notification if they have registered a mobile device
                    if ExpoDevice.objects.filter(user=user).exists():
                        try:
                            push_notification(
                                recipient=user,
                                title="Checkout Reminder ⏰",
                                message=f"Hi {user.full_name}, it's past 5 PM! Don't forget to punch your checkout in the app before you leave.",
                                notification_type="CHECKOUT_REMINDER"
                            )
                            count += 1
                        except Exception as e:
                            self.stderr.write(f"Failed to send to {user.username}: {e}")

        self.stdout.write(self.style.SUCCESS(f"Successfully sent checkout reminders to {count} users."))
