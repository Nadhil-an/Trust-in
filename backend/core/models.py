"""
Core models:
- Custom User with roles
- AuditLog (append-only)
- Notification model
"""
import uuid
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.db import models
from django.utils import timezone
from encrypted_model_fields.fields import EncryptedCharField
from .validators import validate_image_file


class Role(models.TextChoices):
    # Web dashboard roles
    ADMIN = 'ADMIN', 'Admin'
    MANAGER = 'MANAGER', 'Manager'
    ACCOUNTANT = 'ACCOUNTANT', 'Accountant'
    HR = 'HR', 'HR'
    DATA_ENTRY = 'DATA_ENTRY', 'Data Entry'
    # Mobile application roles
    FIELD_ASSESSMENT_OFFICER = 'FIELD_ASSESSMENT_OFFICER', 'Field Assessment Officer'
    ASSESSMENT_CALCULATION_OFFICER = 'ASSESSMENT_CALCULATION_OFFICER', 'Assessment Calculation Officer'
    GENERAL_ENQUIRY_OFFICER = 'GENERAL_ENQUIRY_OFFICER', 'General Enquiry Officer'
    STAFF = 'STAFF', 'Staff'
    MEMBER = 'MEMBER', 'Member'


class UserManager(BaseUserManager):
    def create_user(self, username, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email is required')
        email = self.normalize_email(email)
        user = self.model(username=username, email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, username, email, password=None, **extra_fields):
        extra_fields.setdefault('role', Role.ADMIN)
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(username, email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = models.CharField(max_length=150, unique=True)
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=255)
    role = models.CharField(max_length=35, choices=Role.choices, default=Role.MANAGER)
    phone = EncryptedCharField(max_length=20, blank=True)  # Encrypted PII
    photo = models.ImageField(upload_to='users/', blank=True, null=True, validators=[validate_image_file])
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)
    last_login_ip = models.GenericIPAddressField(blank=True, null=True)
    failed_login_attempts = models.PositiveSmallIntegerField(default=0)
    locked_until = models.DateTimeField(blank=True, null=True)
    staff_uid = models.CharField(max_length=20, unique=True, blank=True, null=True, db_index=True)

    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = ['email', 'full_name']

    objects = UserManager()

    class Meta:
        db_table = 'core_users'
        verbose_name = 'User'

    def __str__(self):
        return f"{self.full_name} ({self.role})"

    def save(self, *args, **kwargs):
        if not self.staff_uid and self.role and self.role != Role.MEMBER:
            # Find the last assigned SLT-XXXX ID
            last_user = User.objects.filter(staff_uid__startswith='SLT-').order_by('staff_uid').last()
            if last_user and last_user.staff_uid:
                try:
                    last_id = int(last_user.staff_uid.split('-')[1])
                    self.staff_uid = f"SLT-{last_id + 1:04d}"
                except (ValueError, IndexError):
                    self.staff_uid = "SLT-0001"
            else:
                self.staff_uid = "SLT-0001"
        super().save(*args, **kwargs)

    def is_account_locked(self):
        if self.locked_until and timezone.now() < self.locked_until:
            return True
        return False


class AuditLog(models.Model):
    """Immutable audit trail — never update or delete records."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='audit_logs')
    action = models.CharField(max_length=100)  # e.g. CREATE_REQUEST, APPROVE_REQUEST
    module = models.CharField(max_length=50)   # e.g. MANAGER, CASHIER
    record_type = models.CharField(max_length=100)  # e.g. AssessmentRequest
    record_id = models.CharField(max_length=100, db_index=True)
    reference_number = models.CharField(max_length=50, blank=True, db_index=True)
    previous_status = models.CharField(max_length=50, blank=True)
    new_status = models.CharField(max_length=50, blank=True)
    description = models.TextField(blank=True)
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    extra_data = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'core_audit_log'
        ordering = ['-timestamp']
        # Prevent updates — only INSERTs via save()

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise PermissionError("AuditLog records are immutable.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise PermissionError("AuditLog records cannot be deleted.")

    def __str__(self):
        return f"[{self.module}] {self.action} by {self.user} at {self.timestamp}"


class SystemNotification(models.Model):
    """In-app notifications pushed via WebSocket."""
    class Priority(models.TextChoices):
        LOW = 'LOW', 'Low'
        NORMAL = 'NORMAL', 'Normal'
        HIGH = 'HIGH', 'High'
        URGENT = 'URGENT', 'Urgent'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    title = models.CharField(max_length=200)
    message = models.TextField()
    notification_type = models.CharField(max_length=50)  # e.g. REQUEST_APPROVED
    reference_id = models.CharField(max_length=50, blank=True)
    reference_type = models.CharField(max_length=50, blank=True)
    priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.NORMAL)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)
    read_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        db_table = 'core_notifications'
        ordering = ['-created_at']

class Event(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    short_description = models.CharField(max_length=255, blank=True)
    content = models.TextField(blank=True)
    date = models.DateField(default=timezone.now)
    location = models.CharField(max_length=255)
    category = models.CharField(max_length=50, default='Upcoming')  # Upcoming or Past
    image = models.ImageField(upload_to='events/', blank=True, null=True, validators=[validate_image_file])
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'core_events'
        ordering = ['-date', '-created_at']

    def __str__(self):
        return self.title

    def mark_read(self):
        self.is_read = True
        self.read_at = timezone.now()
        self.save(update_fields=['is_read', 'read_at'])

class RoleFeaturePermission(models.Model):
    """Stores which features are enabled for which roles."""
    role = models.CharField(max_length=35, choices=Role.choices)
    feature_key = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'core_role_features'
        unique_together = ('role', 'feature_key')

    def __str__(self):
        return f"{self.role} -> {self.feature_key}"


class ExpoDevice(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='expo_devices')
    push_token = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'core_expo_devices'
        ordering = ['-updated_at']

    def __str__(self):
        return f"{self.user.username} - {self.push_token}"
