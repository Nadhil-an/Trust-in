import os
import django
import sys

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "sreelakshmi_trust.settings")
django.setup()

from hr_module.models import PaymentAdvanceRequest, ExecutiveOfficer
from core.models import User

def reset():
    users = User.objects.filter(full_name__icontains="manu")
    if not users.exists():
        print("User manu not found in User model.")
    else:
        for user in users:
            advances = PaymentAdvanceRequest.objects.filter(requested_by=user)
            count = advances.count()
            advances.delete()
            print(f"Deleted {count} advances requested by User: {user.full_name}")

    officers = ExecutiveOfficer.objects.filter(full_name__icontains="manu")
    if not officers.exists():
        print("Officer manu not found in ExecutiveOfficer model.")
    else:
        for off in officers:
            advances = PaymentAdvanceRequest.objects.filter(employee=off)
            count = advances.count()
            advances.delete()
            print(f"Deleted {count} advances associated with Officer: {off.full_name}")

if __name__ == "__main__":
    reset()
