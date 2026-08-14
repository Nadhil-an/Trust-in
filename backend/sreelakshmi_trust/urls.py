"""URL Configuration for Sree Lakshmi Charitable Trust Management System"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    # Auth
    path('api/auth/', include('core.urls.auth')),
    # Manager Module
    path('api/manager/', include('manager_module.urls')),
    # Accounts Module
    path('api/accounts/', include('accounts_module.urls')),
    # Cashier Module
    path('api/cashier/', include('cashier_module.urls')),
    # HR Module
    path('api/hr/', include('hr_module.urls')),
    # Reports
    path('api/reports/', include('reports_module.urls')),
    # Notifications
    path('api/notify/', include('notify.urls')),
    # Core / Shared
    path('api/core/', include('core.urls.core')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
