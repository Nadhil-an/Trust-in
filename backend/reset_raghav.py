import os
import django
from datetime import date
from django.utils import timezone

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sreelakshmi_trust.settings')
django.setup()

from hr_module.models import Attendance, ExecutiveOfficer
from core.models import User

# Find user
users = User.objects.filter(full_name__icontains='raghav', role='STAFF')
if not users.exists():
    print("User Raghav not found")
else:
    for user in users:
        officer = ExecutiveOfficer.objects.filter(full_name__iexact=user.full_name).first()
        if not officer:
            print(f"Officer not found for user {user.full_name}")
            continue
        
        # We also need to check the effective date logic from views.py
        now_local = timezone.localtime(timezone.now())
        if now_local.hour < 8:
            effective_date = (now_local - timezone.timedelta(days=1)).date()
        else:
            effective_date = now_local.date()

        records = Attendance.objects.filter(employee=officer, date=effective_date)
        count = records.count()
        records.delete()
        print(f"Deleted {count} attendance records for {officer.full_name} for date {effective_date}")
