"""Manager Module Models — Assessment Requests, Minutes, Partners, FAO/ACO/GEO Reports, Inventory"""
import uuid
from django.db import models
from django.utils import timezone
from core.models import User
from hr_module.models import Member
from core.validators import validate_image_file, validate_document_file


class RequestStatus(models.TextChoices):
    DRAFT = 'DRAFT', 'Draft'
    SUBMITTED = 'SUBMITTED', 'Submitted'
    UNDER_REVIEW = 'UNDER_REVIEW', 'Under Review'
    WITH_FAO = 'WITH_FAO', 'With Field Assessment Officer'
    WITH_ACO = 'WITH_ACO', 'With Assessment Calculation Officer'
    WITH_GEO = 'WITH_GEO', 'With General Enquiry Officer'
    FAO_REJECTED = 'FAO_REJECTED', 'Rejected by FAO'
    ON_HOLD = 'ON_HOLD', 'On Hold'
    APPROVED = 'APPROVED', 'Approved'
    REJECTED = 'REJECTED', 'Rejected'
    PENDING_DISBURSEMENT = 'PENDING_DISBURSEMENT', 'Pending Disbursement'
    DISBURSED = 'DISBURSED', 'Disbursed'
    COMPLETED = 'COMPLETED', 'Completed'
    CANCELLED = 'CANCELLED', 'Cancelled'


class RequestCategory(models.TextChoices):
    MEDICAL = 'MEDICAL', 'Medical Assistance'
    EDUCATION = 'EDUCATION', 'Education Assistance'
    FOOD = 'FOOD', 'Food Assistance'
    HOUSING = 'HOUSING', 'Housing / Construction'
    LIVELIHOOD = 'LIVELIHOOD', 'Livelihood Support'
    DISABILITY = 'DISABILITY', 'Disability Support'
    ELDERLY = 'ELDERLY', 'Elderly Care'
    CHILD_WELFARE = 'CHILD_WELFARE', 'Child Welfare'
    WOMEN_WELFARE = 'WOMEN_WELFARE', 'Women Welfare'
    CHARITY = 'CHARITY', 'Charity Program'
    TRANSPORT = 'TRANSPORT', 'Transportation'
    OFFICE = 'OFFICE', 'Office Expenses'
    UTILITIES = 'UTILITIES', 'Utilities'
    MAINTENANCE = 'MAINTENANCE', 'Maintenance'
    PURCHASE = 'PURCHASE', 'Purchase'
    OTHER = 'OTHER', 'Other'


class RequestPriority(models.TextChoices):
    LOW = 'LOW', 'Low'
    NORMAL = 'NORMAL', 'Normal'
    HIGH = 'HIGH', 'High'
    URGENT = 'URGENT', 'Urgent'
    CRITICAL = 'CRITICAL', 'Critical'


class EligibilityStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending'
    ELIGIBLE = 'ELIGIBLE', 'Eligible'
    NOT_ELIGIBLE = 'NOT_ELIGIBLE', 'Not Eligible'


def request_doc_path(instance, filename):
    return f'requests/{instance.request_number}/{filename}'


def fao_photo_path(instance, filename):
    return f'fao_reports/{instance.assessment.request_number}/{filename}'


def geo_photo_path(instance, filename):
    return f'geo_reports/{instance.assessment.request_number}/{filename}'


class AssessmentRequest(models.Model):
    """Core money/assessment request — flows Manager → FAO → ACO → Manager → GEO → Manager → Cashier"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    request_number = models.CharField(max_length=20, unique=True, db_index=True)
    request_type = models.CharField(max_length=100, blank=True)
    category = models.CharField(max_length=20, choices=RequestCategory.choices, default=RequestCategory.OTHER)
    priority = models.CharField(max_length=10, choices=RequestPriority.choices, default=RequestPriority.NORMAL)
    status = models.CharField(max_length=20, choices=RequestStatus.choices, default=RequestStatus.SUBMITTED)

    # Source of request
    source = models.CharField(max_length=20, default='STAFF',
                              choices=[('STAFF', 'Staff'), ('MEMBER', 'Member'), ('WALK_IN', 'Walk-In')])

    # Who
    requested_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name='created_requests')
    assigned_fao = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                      related_name='fao_assignments')
    assigned_aco = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                      related_name='aco_assignments')
    assigned_geo = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                      related_name='geo_assignments')
    reviewed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                     related_name='reviewed_requests')
    disbursed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                      related_name='disbursed_requests')

    # What & When
    purpose = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True)
    amount_requested = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    amount_approved = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    amount_disbursed = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    required_date = models.DateField(null=True, blank=True)
    scheduled_payout_date = models.DateField(null=True, blank=True)

    # Beneficiary (filled by STAFF/MEMBER initially)
    beneficiary_name = models.CharField(max_length=255, blank=True)
    beneficiary_age = models.PositiveSmallIntegerField(null=True, blank=True)
    beneficiary_phone = models.CharField(max_length=20, blank=True)
    beneficiary_address = models.TextField(blank=True)
    beneficiary_latitude = models.FloatField(null=True, blank=True)
    beneficiary_longitude = models.FloatField(null=True, blank=True)
    member = models.ForeignKey('hr_module.Member', on_delete=models.SET_NULL, null=True, blank=True,
                                related_name='assessments')

    # Eligibility (set by FAO)
    eligibility = models.CharField(max_length=15, choices=EligibilityStatus.choices,
                                   default=EligibilityStatus.PENDING)

    # Remarks at each stage
    manager_remarks = models.TextField(blank=True)
    accountant_remarks = models.TextField(blank=True)
    cashier_remarks = models.TextField(blank=True)
    rejection_reason = models.TextField(blank=True)
    hold_reason = models.TextField(blank=True)

    # Timestamps
    created_at = models.DateTimeField(default=timezone.now)
    submitted_at = models.DateTimeField(null=True, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    disbursed_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Supporting document
    document = models.FileField(upload_to=request_doc_path, null=True, blank=True, validators=[validate_document_file])

    class Meta:
        db_table = 'manager_requests'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.request_number} — {self.beneficiary_name or self.purpose} ({self.status})"

    def save(self, *args, **kwargs):
        if not self.request_number:
            year = timezone.now().year
            count = AssessmentRequest.objects.filter(
                created_at__year=year).count() + 1
            self.request_number = f"ASM-{year}-{count:05d}"
        super().save(*args, **kwargs)


class RequestStatusHistory(models.Model):
    """Full status history for every request."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    request = models.ForeignKey(AssessmentRequest, on_delete=models.CASCADE, related_name='status_history')
    from_status = models.CharField(max_length=20, blank=True)
    to_status = models.CharField(max_length=20)
    changed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    remarks = models.TextField(blank=True)
    timestamp = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'manager_request_status_history'
        ordering = ['timestamp']


# ── FAO Field Report ──────────────────────────────────────────────

class FAOPhoto(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    report = models.ForeignKey('FAOReport', on_delete=models.CASCADE, related_name='photos')
    image = models.ImageField(upload_to=fao_photo_path, validators=[validate_image_file])
    caption = models.CharField(max_length=255, blank=True)
    uploaded_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'manager_fao_photos'


class FAOReport(models.Model):
    """Field Assessment Officer's complete field report."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    assessment = models.OneToOneField(AssessmentRequest, on_delete=models.CASCADE, related_name='fao_report')

    # ── Beneficiary Verification ──────────────────────────
    beneficiary_verified_name = models.CharField(max_length=255, blank=True)
    beneficiary_verified_address = models.TextField(blank=True)
    beneficiary_verified_phone = models.CharField(max_length=20, blank=True)
    address_corrections = models.TextField(blank=True)

    # ── Ex-Ward Member Report ─────────────────────────────
    ex_ward_member_name = models.CharField(max_length=255, blank=True)
    ex_ward_member_position = models.CharField(max_length=255, blank=True)
    ex_ward_member_report = models.TextField(blank=True)
    ex_ward_member_signature_photo = models.ImageField(upload_to='fao_signatures/', null=True, blank=True, validators=[validate_image_file])

    # ── Current Ward Member Report ────────────────────────
    current_ward_member_name = models.CharField(max_length=255, blank=True)
    current_ward_member_position = models.CharField(max_length=255, blank=True)
    current_ward_member_report = models.TextField(blank=True)
    current_ward_member_signature_photo = models.ImageField(upload_to='fao_signatures/', null=True, blank=True, validators=[validate_image_file])

    # ── Neighbour Statements ──────────────────────────────
    neighbour_1_name = models.CharField(max_length=255, blank=True)
    neighbour_1_relationship = models.CharField(max_length=100, blank=True)
    neighbour_1_statement = models.TextField(blank=True)
    neighbour_2_name = models.CharField(max_length=255, blank=True)
    neighbour_2_relationship = models.CharField(max_length=100, blank=True)
    neighbour_2_statement = models.TextField(blank=True)

    # ── Officer Findings ──────────────────────────────────
    officer_findings = models.TextField(blank=True)
    visit_location_lat = models.FloatField(null=True, blank=True)
    visit_location_lng = models.FloatField(null=True, blank=True)
    visit_location_text = models.CharField(max_length=500, blank=True)
    visited_at = models.DateTimeField(null=True, blank=True)

    # ── Assessment Decision ───────────────────────────────
    category_confirmed = models.CharField(max_length=20, choices=RequestCategory.choices, blank=True)
    urgency_assessment = models.CharField(max_length=10, choices=RequestPriority.choices, default=RequestPriority.NORMAL)
    eligibility = models.CharField(max_length=15, choices=EligibilityStatus.choices, default=EligibilityStatus.PENDING)
    eligibility_reason = models.TextField(blank=True)

    # ── Meta ─────────────────────────────────────────────
    submitted_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='fao_reports')
    submitted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'manager_fao_reports'

    def __str__(self):
        return f"FAO Report — {self.assessment.request_number} ({self.eligibility})"


# ── ACO Cost Calculation ──────────────────────────────────────────

class ACOCalculation(models.Model):
    """Assessment Calculation Officer's cost estimation."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    assessment = models.OneToOneField(AssessmentRequest, on_delete=models.CASCADE, related_name='aco_calculation')

    # Line items as JSON:
    # [{ "item": str, "category": str, "qty": float, "unit": str,
    #    "unit_cost": float, "total": float, "source": "PURCHASE"|"INVENTORY" }]
    line_items = models.JSONField(default=list)

    # Recurring support
    has_recurring_cost = models.BooleanField(default=False)
    recurring_monthly_cost = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    recurring_duration_months = models.PositiveSmallIntegerField(null=True, blank=True)
    recurring_total = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    # Totals
    total_one_time_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_estimated_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    recommended_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    justification = models.TextField(blank=True)
    notes = models.TextField(blank=True)

    submitted_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='aco_calculations')
    submitted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'manager_aco_calculations'

    def __str__(self):
        return f"ACO Calculation — {self.assessment.request_number} (₹{self.recommended_amount})"


# ── GEO Verification Report ───────────────────────────────────────

class GEORecommendation(models.TextChoices):
    APPROVE_AS_IS = 'APPROVE_AS_IS', 'Approve As-Is'
    APPROVE_WITH_CHANGES = 'APPROVE_WITH_CHANGES', 'Approve with Changes'
    REJECT = 'REJECT', 'Reject'
    FURTHER_REVIEW = 'FURTHER_REVIEW', 'Needs Further Review'


class GEOPhoto(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    report = models.ForeignKey('GEOReport', on_delete=models.CASCADE, related_name='photos')
    image = models.ImageField(upload_to=geo_photo_path, validators=[validate_image_file])
    caption = models.CharField(max_length=255, blank=True)
    uploaded_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'manager_geo_photos'


class GEOReport(models.Model):
    """General Enquiry Officer's advanced verification report."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    assessment = models.OneToOneField(AssessmentRequest, on_delete=models.CASCADE, related_name='geo_report')

    verification_findings = models.TextField(blank=True)
    discrepancies_found = models.TextField(blank=True)
    field_notes = models.TextField(blank=True)

    visit_location_lat = models.FloatField(null=True, blank=True)
    visit_location_lng = models.FloatField(null=True, blank=True)
    visit_location_text = models.CharField(max_length=500, blank=True)
    visited_at = models.DateTimeField(null=True, blank=True)

    recommendation = models.CharField(max_length=25, choices=GEORecommendation.choices,
                                       default=GEORecommendation.APPROVE_AS_IS)
    recommended_amount_override = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    recommendation_justification = models.TextField(blank=True)

    submitted_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='geo_reports')
    submitted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'manager_geo_reports'

    def __str__(self):
        return f"GEO Report — {self.assessment.request_number} ({self.recommendation})"


# ── Charity Inventory ─────────────────────────────────────────────

class InventoryCategory(models.TextChoices):
    MEDICINE = 'MEDICINE', 'Medicine'
    EQUIPMENT = 'EQUIPMENT', 'Equipment / Mobility Aids'
    FOOD = 'FOOD', 'Food Supplies'
    CLOTHING = 'CLOTHING', 'Clothing'
    EDUCATION = 'EDUCATION', 'Educational Materials'
    CONSTRUCTION = 'CONSTRUCTION', 'Construction Materials'
    OTHER = 'OTHER', 'Other'


class CharityInventory(models.Model):
    """Items available in the charity's stock that ACO can allocate."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    item_code = models.CharField(max_length=20, unique=True, db_index=True)
    item_name = models.CharField(max_length=255)
    category = models.CharField(max_length=20, choices=InventoryCategory.choices)
    description = models.TextField(blank=True)
    unit = models.CharField(max_length=50, default='unit')  # e.g. kg, pcs, box
    quantity_available = models.PositiveIntegerField(default=0)
    unit_value = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)
    last_updated = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'manager_charity_inventory'
        ordering = ['category', 'item_name']
        verbose_name_plural = 'Charity Inventory'

    def __str__(self):
        return f"{self.item_code} — {self.item_name} ({self.quantity_available} {self.unit})"

    def save(self, *args, **kwargs):
        if not self.item_code:
            count = CharityInventory.objects.count() + 1
            self.item_code = f"INV-{count:04d}"
        super().save(*args, **kwargs)


class InventoryTransaction(models.Model):
    """Log of material movements (Inward/Outward)."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    transaction_id = models.CharField(max_length=20, unique=True, db_index=True)
    item = models.ForeignKey(CharityInventory, on_delete=models.CASCADE, related_name='transactions')
    transaction_type = models.CharField(max_length=10, choices=[('INWARD', 'Inward'), ('OUTWARD', 'Outward')])
    quantity = models.PositiveIntegerField()
    reference_number = models.CharField(max_length=100, blank=True)
    remarks = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'manager_inventory_transactions'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.transaction_id} — {self.transaction_type} {self.quantity} {self.item.unit} of {self.item.item_name}"

    def save(self, *args, **kwargs):
        if not self.transaction_id:
            year = timezone.now().year
            count = InventoryTransaction.objects.filter(created_at__year=year).count() + 1
            self.transaction_id = f"ITX-{year}-{count:05d}"
            
            # Update inventory quantity
            if self.transaction_type == 'INWARD':
                self.item.quantity_available += self.quantity
            elif self.transaction_type == 'OUTWARD':
                self.item.quantity_available -= self.quantity
            self.item.save(update_fields=['quantity_available'])
            
        super().save(*args, **kwargs)


# ── Minutes Registry ─────────────────────────────────────────────

class MeetingType(models.TextChoices):
    BOARD = 'BOARD', 'Board Meeting'
    GENERAL = 'GENERAL', 'General Meeting'
    COMMITTEE = 'COMMITTEE', 'Committee Meeting'
    EMERGENCY = 'EMERGENCY', 'Emergency Meeting'
    ANNUAL = 'ANNUAL', 'Annual General Meeting'
    OTHER = 'OTHER', 'Other'


class MinutesStatus(models.TextChoices):
    DRAFT = 'DRAFT', 'Draft'
    SUBMITTED = 'SUBMITTED', 'Submitted'
    APPROVED = 'APPROVED', 'Approved'
    ARCHIVED = 'ARCHIVED', 'Archived'


class MinutesRegistry(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    meeting_id = models.CharField(max_length=20, unique=True, db_index=True)
    title = models.CharField(max_length=255)
    meeting_date = models.DateField()
    meeting_type = models.CharField(max_length=20, choices=MeetingType.choices)
    location = models.CharField(max_length=255, blank=True)
    chairperson = models.CharField(max_length=255)
    participants = models.JSONField(default=list)
    agenda = models.TextField()
    discussions = models.TextField(blank=True)
    decisions = models.TextField(blank=True)
    action_items = models.JSONField(default=list)
    status = models.CharField(max_length=20, choices=MinutesStatus.choices, default=MinutesStatus.DRAFT)
    created_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name='created_minutes')
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_minutes')
    attachment = models.FileField(upload_to='minutes/', null=True, blank=True, validators=[validate_document_file])
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'manager_minutes'
        ordering = ['-meeting_date']

    def save(self, *args, **kwargs):
        if not self.meeting_id:
            year = timezone.now().year
            count = MinutesRegistry.objects.filter(meeting_date__year=year).count() + 1
            self.meeting_id = f"MTG-{year}-{count:04d}"
        super().save(*args, **kwargs)


# ── Partners ──────────────────────────────────────────────────────

class PartnerType(models.TextChoices):
    CLUB = 'CLUB', 'Club'
    GROUP = 'GROUP', 'Group'
    ASSOCIATION = 'ASSOCIATION', 'Association'
    LOCAL_TEAM = 'LOCAL_TEAM', 'Local Team'
    NGO = 'NGO', 'NGO'
    GOVERNMENT = 'GOVERNMENT', 'Government Body'
    OTHER = 'OTHER', 'Other'


class Partner(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    partner_id = models.CharField(max_length=20, unique=True, db_index=True)
    organization_name = models.CharField(max_length=255)
    partner_type = models.CharField(max_length=20, choices=PartnerType.choices)
    contact_person = models.CharField(max_length=255)
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    registration_number = models.CharField(max_length=100, blank=True)
    registration_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, default='ACTIVE', choices=[
        ('ACTIVE', 'Active'), ('INACTIVE', 'Inactive'), ('SUSPENDED', 'Suspended')
    ])
    notes = models.TextField(blank=True)
    document = models.FileField(upload_to='partners/', null=True, blank=True, validators=[validate_document_file])
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'manager_partners'
        ordering = ['organization_name']

    def save(self, *args, **kwargs):
        if not self.partner_id:
            count = Partner.objects.count() + 1
            self.partner_id = f"PTR-{count:04d}"
        super().save(*args, **kwargs)


# ── Scheduled Payouts ──────────────────────────────────────────────

class PayoutStatus(models.TextChoices):
    PLANNED = 'PLANNED', 'Planned'
    ACTIVE = 'ACTIVE', 'Active'
    COMPLETED = 'COMPLETED', 'Completed'
    CANCELLED = 'CANCELLED', 'Cancelled'


class ScheduledPayout(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    payout_id = models.CharField(max_length=20, unique=True, db_index=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    allocated_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    issue_date = models.DateField()
    payment_date = models.DateField()
    status = models.CharField(max_length=20, choices=PayoutStatus.choices, default=PayoutStatus.PLANNED)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_payouts')
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'manager_scheduled_payouts'
        ordering = ['payment_date']

    def __str__(self):
        return f"{self.payout_id} - {self.name} (₹{self.allocated_amount})"

    def save(self, *args, **kwargs):
        if not self.payout_id:
            year = timezone.now().year
            count = ScheduledPayout.objects.filter(created_at__year=year).count() + 1
            self.payout_id = f"PAY-{year}-{count:04d}"
        super().save(*args, **kwargs)

