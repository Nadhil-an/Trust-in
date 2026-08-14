from django.contrib import admin
from core.models import User, AuditLog, SystemNotification

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ['username', 'full_name', 'role', 'email', 'is_active']
    list_filter = ['role', 'is_active']
    search_fields = ['username', 'full_name', 'email']

@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ['timestamp', 'user', 'action', 'module', 'record_type', 'reference_number']
    list_filter = ['module', 'action']
    search_fields = ['reference_number', 'record_id']
    readonly_fields = [f.name for f in AuditLog._meta.get_fields()]

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
