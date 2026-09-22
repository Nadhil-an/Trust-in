import os
import sys
import django
from datetime import date

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sreelakshmi_trust.settings')
django.setup()

from accounts_module.models import Expense
from core.models import User

user = User.objects.first()

try:
    exp = Expense.objects.create(
        date=date.today(),
        payee="nous",
        purpose="nous",
        category="DayBook Entry",
        amount=10.0,
        account_type="CASH",
        payment_method="CASH",
        created_by=user,
        status="COMPLETED"
    )
    print(f"Success! Expense created with id {exp.id}")
except Exception as e:
    import traceback
    traceback.print_exc()
