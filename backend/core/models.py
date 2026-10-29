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
from .validators import validate_image_file, validate_document_file


class Role(models.TextChoices):
    # Web dashboard roles
    ADMIN = 'ADMIN', 'Admin'
    MANAGER = 'MANAGER', 'Manager'
    ACCOUNTANT = 'ACCOUNTANT', 'Accountant'
    HR = 'HR', 'HR'
    DATA_ENTRY = 'DATA_ENTRY', 'Data Entry'
    SOCIAL_MEDIA = 'SOCIAL_MEDIA', 'Social Media'
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
    is_verified = models.BooleanField(default=False)
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


class MemberPostStatus(models.TextChoices):
    PENDING_APPROVAL = 'PENDING_APPROVAL', 'Pending Approval'
    APPROVED = 'APPROVED', 'Approved'
    REJECTED = 'REJECTED', 'Rejected'
    FORWARDED_TO_FAO = 'FORWARDED_TO_FAO', 'Forwarded to FAO'
    OPEN = 'OPEN', 'Open'
    RESOLVED = 'RESOLVED', 'Resolved'
    CLOSED = 'CLOSED', 'Closed'


class MemberPostType(models.TextChoices):
    AWARENESS = 'AWARENESS', 'Awareness'
    CHARITY = 'CHARITY', 'Charity'


class MemberPostCategory(models.TextChoices):
    SELF = 'SELF', 'Self Post'
    PUBLIC = 'PUBLIC', 'Public Post'
    OFFICIAL_TRUST = 'OFFICIAL_TRUST', 'Official Trust Post'


class MemberPost(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='member_posts')
    post_type = models.CharField(max_length=20, choices=MemberPostType.choices, default=MemberPostType.AWARENESS)
    post_category = models.CharField(max_length=25, choices=MemberPostCategory.choices, default=MemberPostCategory.PUBLIC)
    description = models.TextField()
    contact_number = models.CharField(max_length=25, blank=True)
    address = models.TextField(blank=True)
    video = models.FileField(upload_to='member_posts/videos/', null=True, blank=True)
    status = models.CharField(max_length=25, choices=MemberPostStatus.choices, default=MemberPostStatus.PENDING_APPROVAL)
    rejection_reason = models.TextField(blank=True, default='')
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_posts')
    approved_at = models.DateTimeField(null=True, blank=True)
    assessment_request = models.ForeignKey('manager_module.AssessmentRequest', on_delete=models.SET_NULL, null=True, blank=True, related_name='member_posts')
    is_pinned = models.BooleanField(default=False)
    scheduled_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True, help_text="Expiry date after which announcement automatically disappears")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'core_member_posts'
        ordering = ['-created_at']

    def __str__(self):
        return f"Post by {self.author.username} ({self.created_at.strftime('%Y-%m-%d')})"


class UserFollow(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    follower = models.ForeignKey(User, on_delete=models.CASCADE, related_name='following_relations')
    following = models.ForeignKey(User, on_delete=models.CASCADE, related_name='follower_relations')
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'core_user_follows'
        unique_together = ('follower', 'following')

    def __str__(self):
        return f"{self.follower.username} follows {self.following.username}"


class MemberPostImage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    post = models.ForeignKey(MemberPost, on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(upload_to='member_posts/', validators=[validate_image_file])
    order = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'core_member_post_images'
        ordering = ['order', 'created_at']

    def __str__(self):
        return f"Image {self.order} for Post {self.post_id}"


class MemberPostLike(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    post = models.ForeignKey(MemberPost, on_delete=models.CASCADE, related_name='likes')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='member_post_likes')
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'core_member_post_likes'
        unique_together = ('post', 'user')

    def __str__(self):
        return f"{self.user.username} liked {self.post_id}"


class MemberPostComment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    post = models.ForeignKey(MemberPost, on_delete=models.CASCADE, related_name='comments')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='member_post_comments')
    text = models.TextField()
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'core_member_post_comments'
        ordering = ['created_at']

    def __str__(self):
        return f"Comment by {self.user.username} on {self.post_id}"



# ==============================================================================
# PHASE 2: MEMBER RELATIONSHIP MANAGEMENT (MRM), TASKS, BADGES & APPRECIATION
# ==============================================================================

class MemberInteractionType(models.TextChoices):
    CALL = 'CALL', 'Phone Call'
    VISIT = 'VISIT', 'In-Person Visit'
    WHATSAPP = 'WHATSAPP', 'WhatsApp Communication'
    MEETING = 'MEETING', 'Meeting'
    NOTE = 'NOTE', 'Administrative Note'
    OTHER = 'OTHER', 'Other Interaction'


class FollowUpStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending Follow-up'
    COMPLETED = 'COMPLETED', 'Completed'
    CANCELLED = 'CANCELLED', 'Cancelled'


class MemberInteraction(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    member = models.ForeignKey('hr_module.Member', on_delete=models.CASCADE, related_name='interactions')
    interaction_type = models.CharField(max_length=50, choices=MemberInteractionType.choices, default=MemberInteractionType.NOTE)
    summary = models.TextField()
    is_confidential = models.BooleanField(default=False, help_text="Restricted to authorized coordinators and admins")
    follow_up_required = models.BooleanField(default=False)
    follow_up_date = models.DateField(null=True, blank=True)
    follow_up_status = models.CharField(max_length=20, choices=FollowUpStatus.choices, default=FollowUpStatus.PENDING)
    assigned_staff = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_interactions')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='recorded_interactions')
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'core_member_interactions'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.interaction_type} with {self.member.full_name} ({self.created_at.strftime('%Y-%m-%d')})"


class TaskCategory(models.TextChoices):
    SERVICE = 'SERVICE', 'Trust Service'
    RECRUITMENT = 'RECRUITMENT', 'Member Referral'
    DONATION = 'DONATION', 'Donation Collection'
    FIELD_WORK = 'FIELD_WORK', 'Field Assessment'
    COMMUNITY = 'COMMUNITY', 'Community Event'
    GENERAL = 'GENERAL', 'General Activity'


class TaskStatus(models.TextChoices):
    DRAFT = 'DRAFT', 'Draft'
    ASSIGNED = 'ASSIGNED', 'Assigned'
    IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
    SUBMITTED = 'SUBMITTED', 'Submitted for Review'
    COMPLETED = 'COMPLETED', 'Completed'
    REJECTED = 'REJECTED', 'Rejected'
    OVERDUE = 'OVERDUE', 'Overdue'
    CANCELLED = 'CANCELLED', 'Cancelled'


class TargetUnit(models.TextChoices):
    COUNT = 'COUNT', 'Count / Persons'
    AMOUNT = 'AMOUNT', 'Amount (INR)'
    HOURS = 'HOURS', 'Hours'
    VISITS = 'VISITS', 'Visits'


class MemberTask(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    task_number = models.CharField(max_length=30, unique=True, db_index=True)
    title = models.CharField(max_length=255)
    description = models.TextField()
    category = models.CharField(max_length=50, choices=TaskCategory.choices, default=TaskCategory.GENERAL)
    member = models.ForeignKey('hr_module.Member', on_delete=models.CASCADE, related_name='assigned_tasks')
    assigned_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='delegated_tasks')
    responsible_staff = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='supervised_tasks')
    start_date = models.DateField(default=timezone.now)
    due_date = models.DateField()
    target_value = models.DecimalField(max_digits=12, decimal_places=2, default=1.00)
    achieved_value = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    target_unit = models.CharField(max_length=30, choices=TargetUnit.choices, default=TargetUnit.COUNT)
    status = models.CharField(max_length=30, choices=TaskStatus.choices, default=TaskStatus.ASSIGNED)
    requires_verification = models.BooleanField(default=True)
    
    # Member Submission Evidence
    evidence_notes = models.TextField(blank=True, default='')
    evidence_file = models.FileField(upload_to='tasks/evidence/', null=True, blank=True, validators=[validate_document_file])
    submitted_at = models.DateTimeField(null=True, blank=True)
    
    # Review
    review_notes = models.TextField(blank=True, default='')
    reviewed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_tasks')
    reviewed_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'core_member_tasks'
        ordering = ['-due_date', '-created_at']

    def __str__(self):
        return f"{self.task_number}: {self.title} ({self.member.full_name})"

    def save(self, *args, **kwargs):
        if not self.task_number:
            count = MemberTask.objects.count() + 1
            candidate = f"TSK-{count:05d}"
            while MemberTask.objects.filter(task_number=candidate).exists():
                count += 1
                candidate = f"TSK-{count:05d}"
            self.task_number = candidate
        super().save(*args, **kwargs)

    @property
    def completion_percentage(self):
        if not self.target_value or float(self.target_value) <= 0:
            return 100.0 if self.status == TaskStatus.COMPLETED else 0.0
        pct = float((self.achieved_value / self.target_value) * 100)
        return min(100.0, max(0.0, round(pct, 1)))

    @property
    def is_overdue(self):
        if self.status in [TaskStatus.COMPLETED, TaskStatus.CANCELLED]:
            return False
        return self.due_date < timezone.localdate()


class BadgeCategory(models.TextChoices):
    TRUST_SERVICE = 'TRUST_SERVICE', 'Trust Service'
    DONATION = 'DONATION', 'Donation / Subscription'
    REFERRAL = 'REFERRAL', 'Member Referrals'
    TASK_COMPLETION = 'TASK_COMPLETION', 'Task Completion'
    VOLUNTEER = 'VOLUNTEER', 'Volunteer Service'
    SPECIAL = 'SPECIAL', 'Special Appreciation'


class BadgeDefinition(models.Model):
    badge_key = models.CharField(max_length=50, primary_key=True)
    name = models.CharField(max_length=100)
    icon = models.CharField(max_length=30, default='🟨')
    color = models.CharField(max_length=30, default='#EAB308')
    category = models.CharField(max_length=50, choices=BadgeCategory.choices, default=BadgeCategory.TRUST_SERVICE)
    description = models.TextField(blank=True)
    
    # Target Rules
    min_referrals_monthly = models.PositiveIntegerField(default=0)
    daily_collection_target = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    min_services_monthly = models.PositiveIntegerField(default=0)
    consecutive_months_required = models.PositiveSmallIntegerField(default=1)
    requires_volunteer_application = models.BooleanField(default=False)
    prerequisite_badge_key = models.CharField(max_length=50, blank=True, null=True)
    
    is_permanent_default = models.BooleanField(default=False)
    allow_repeat_awards = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'core_badge_definitions'
        ordering = ['name']

    def __str__(self):
        return f"{self.icon} {self.name} ({self.badge_key})"


class MemberBadge(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    member = models.ForeignKey('hr_module.Member', on_delete=models.CASCADE, related_name='earned_badges')
    badge = models.ForeignKey(BadgeDefinition, on_delete=models.CASCADE, related_name='member_awards')
    qualifying_period = models.CharField(max_length=20, default='ALL_TIME')  # e.g. '2026-10'
    is_permanent = models.BooleanField(default=False)
    times_earned = models.PositiveIntegerField(default=1)
    award_source = models.CharField(max_length=20, default='AUTOMATIC', choices=[('AUTOMATIC', 'Automatic Calculation'), ('MANUAL', 'Manual Award')])
    reason = models.TextField(blank=True)
    awarded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='awarded_badges')
    awarded_at = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'core_member_badges'
        unique_together = ('member', 'badge', 'qualifying_period')
        ordering = ['-awarded_at']

    def __str__(self):
        return f"{self.member.full_name} - {self.badge.name} ({self.qualifying_period})"


class AchievementCategory(models.TextChoices):
    SERVICE = 'SERVICE', 'Trust Service'
    REFERRAL = 'REFERRAL', 'New Referrals'
    DONATION = 'DONATION', 'Verified Donation'
    TASK = 'TASK', 'Task Completion'
    TARGET = 'TARGET', 'Target Achievement'
    COMMUNITY = 'COMMUNITY', 'Community Participation'
    SPECIAL = 'SPECIAL', 'Special Trust Recognition'


class MemberAchievement(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    member = models.ForeignKey('hr_module.Member', on_delete=models.CASCADE, related_name='achievements')
    category = models.CharField(max_length=50, choices=AchievementCategory.choices, default=AchievementCategory.SERVICE)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    qualifying_period = models.CharField(max_length=20, blank=True)
    award_source = models.CharField(max_length=20, default='AUTOMATIC', choices=[('AUTOMATIC', 'Automatic'), ('MANUAL', 'Manual')])
    awarded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    awarded_at = models.DateTimeField(default=timezone.now)
    evidence = models.TextField(blank=True)

    class Meta:
        db_table = 'core_member_achievements'
        ordering = ['-awarded_at']

    def __str__(self):
        return f"{self.member.full_name} - {self.title}"


class AllowanceStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending Approval'
    APPROVED = 'APPROVED', 'Approved'
    PAID = 'PAID', 'Disbursed / Paid'
    REJECTED = 'REJECTED', 'Rejected'


class VolunteerAllowanceRecord(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    volunteer = models.ForeignKey('hr_module.Volunteer', on_delete=models.CASCADE, related_name='allowance_records')
    month = models.PositiveSmallIntegerField()  # 1-12
    year = models.PositiveSmallIntegerField()   # e.g. 2026
    petrol_allowance = models.DecimalField(max_digits=10, decimal_places=2, default=2000.00)
    recharge_allowance = models.DecimalField(max_digits=10, decimal_places=2, default=399.00)
    trip_allowance = models.DecimalField(max_digits=10, decimal_places=2, default=3000.00)
    total_approved = models.DecimalField(max_digits=10, decimal_places=2, default=5399.00)
    status = models.CharField(max_length=20, choices=AllowanceStatus.choices, default=AllowanceStatus.PENDING)
    notes = models.TextField(blank=True)
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_allowances')
    approved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'core_volunteer_allowances'
        unique_together = ('volunteer', 'month', 'year')
        ordering = ['-year', '-month']

    def __str__(self):
        return f"Allowance: {self.volunteer.full_name} ({self.month}/{self.year}) - INR {self.total_approved}"


class MemberAppreciation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    post = models.OneToOneField(MemberPost, on_delete=models.CASCADE, related_name='appreciation_detail')
    member = models.ForeignKey('hr_module.Member', on_delete=models.CASCADE, related_name='appreciations')
    badge = models.ForeignKey(BadgeDefinition, on_delete=models.SET_NULL, null=True, blank=True)
    achievement = models.ForeignKey(MemberAchievement, on_delete=models.SET_NULL, null=True, blank=True)
    recognition_category = models.CharField(max_length=50, default='SPECIAL_RECOGNITION')
    approval_status = models.CharField(
        max_length=20,
        choices=[('DRAFT', 'Draft'), ('PENDING_APPROVAL', 'Pending Approval'), ('APPROVED', 'Approved & Published'), ('REJECTED', 'Rejected')],
        default='APPROVED'
    )
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'core_member_appreciations'
        ordering = ['-created_at']

    def __str__(self):
        return f"Appreciation for {self.member.full_name} - {self.recognition_category}"


class VerificationStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending Review'
    APPROVED = 'APPROVED', 'Approved'
    REJECTED = 'REJECTED', 'Rejected'


class MemberVerificationRequest(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='verification_requests')
    member = models.ForeignKey('hr_module.Member', on_delete=models.SET_NULL, null=True, blank=True, related_name='verification_requests')
    full_name = models.CharField(max_length=255, blank=True)
    phone = models.CharField(max_length=25, blank=True)
    id_proof_type = models.CharField(max_length=50, default='AADHAAR')
    id_proof_number = models.CharField(max_length=100, blank=True)
    id_proof_document = models.FileField(upload_to='verifications/id_proofs/', null=True, blank=True, validators=[validate_document_file])
    address_proof_document = models.FileField(upload_to='verifications/address_proofs/', null=True, blank=True, validators=[validate_document_file])
    additional_notes = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=VerificationStatus.choices, default=VerificationStatus.PENDING)
    rejection_reason = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_verifications')
    reviewed_at = models.DateTimeField(null=True, blank=True)
    submitted_at = models.DateTimeField(default=timezone.now, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'core_member_verification_requests'
        ordering = ['-submitted_at']

    def __str__(self):
        return f"Verification: {self.user.username} ({self.status})"


class POMCategory(models.TextChoices):
    COMMUNITY_SUPPORT = 'COMMUNITY_SUPPORT', 'Community Support'
    EMERGENCY_BLOOD = 'EMERGENCY_BLOOD', 'Emergency & Blood Support'
    EDUCATION = 'EDUCATION', 'Education Assistance'
    DISASTER_RELIEF = 'DISASTER_RELIEF', 'Disaster & Relief Help'
    CIVIC = 'CIVIC', 'Civic & Infrastructure'
    GENERAL = 'GENERAL', 'General Trust Cooperation'


class POMStatus(models.TextChoices):
    DRAFT = 'DRAFT', 'Draft'
    PUBLISHED = 'PUBLISHED', 'Published'
    ARCHIVED = 'ARCHIVED', 'Archived'


class PublicCooperationMessage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    description = models.TextField()
    category = models.CharField(max_length=50, choices=POMCategory.choices, default=POMCategory.COMMUNITY_SUPPORT)
    status = models.CharField(max_length=20, choices=POMStatus.choices, default=POMStatus.PUBLISHED)
    image = models.ImageField(upload_to='pom/images/', null=True, blank=True, validators=[validate_image_file])
    attachment = models.FileField(upload_to='pom/docs/', null=True, blank=True, validators=[validate_document_file])
    contact_person = models.CharField(max_length=150, blank=True)
    contact_phone = models.CharField(max_length=25, blank=True)
    target_location = models.CharField(max_length=255, blank=True)
    views_count = models.PositiveIntegerField(default=0)
    responses_count = models.PositiveIntegerField(default=0)
    is_pinned = models.BooleanField(default=False)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='pom_messages')
    published_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField(null=True, blank=True, help_text="Expiry date after which appeal is marked expired")
    created_at = models.DateTimeField(default=timezone.now, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'core_pom_messages'
        ordering = ['-is_pinned', '-created_at']

    @property
    def is_expired(self):
        if self.expires_at:
            return timezone.now() > self.expires_at
        return False

    def __str__(self):
        return f"POM: {self.title} ({self.status})"


class PollStatus(models.TextChoices):
    DRAFT = 'DRAFT', 'Draft'
    ACTIVE = 'ACTIVE', 'Active / Live'
    PAUSED = 'PAUSED', 'Paused'
    CLOSED = 'CLOSED', 'Closed'
    CANCELLED = 'CANCELLED', 'Cancelled'


class SocialPoll(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=PollStatus.choices, default=PollStatus.ACTIVE)
    start_time = models.DateTimeField(default=timezone.now)
    end_time = models.DateTimeField(null=True, blank=True)
    is_anonymous = models.BooleanField(default=True)
    show_results_before_close = models.BooleanField(default=False)
    eligible_roles = models.CharField(max_length=255, default='ALL')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_polls')
    created_at = models.DateTimeField(default=timezone.now, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'core_social_polls'
        ordering = ['-created_at']

    def __str__(self):
        return f"Poll: {self.title} ({self.status})"


class SocialPollOption(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    poll = models.ForeignKey(SocialPoll, on_delete=models.CASCADE, related_name='options')
    option_text = models.CharField(max_length=255)
    order = models.PositiveSmallIntegerField(default=0)
    votes_count = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'core_social_poll_options'
        ordering = ['order', 'id']

    def __str__(self):
        return f"{self.poll.title} - Option: {self.option_text}"


class SocialPollVote(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    poll = models.ForeignKey(SocialPoll, on_delete=models.CASCADE, related_name='votes')
    option = models.ForeignKey(SocialPollOption, on_delete=models.CASCADE, related_name='votes')
    voter = models.ForeignKey(User, on_delete=models.CASCADE, related_name='poll_votes')
    voted_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'core_social_poll_votes'
        unique_together = ('poll', 'voter')

    def __str__(self):
        return f"Vote by {self.voter.username} on {self.poll.title}"
