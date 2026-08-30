import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sreelakshmi_trust.settings')
django.setup()

from rest_framework.test import APIRequestFactory, force_authenticate
from hr_module.views import StaffLeaderboardView
from core.models import User
import traceback

try:
    user = User.objects.filter(role='HR').first()
    if not user:
        user = User.objects.first()

    factory = APIRequestFactory()
    request = factory.get('/api/hr/leaderboard/?date=2026-08-30')
    force_authenticate(request, user=user)

    view = StaffLeaderboardView.as_view()
    response = view(request)
    print("Response data:", response.data)
except Exception as e:
    traceback.print_exc()
