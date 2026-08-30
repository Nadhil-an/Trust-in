"""HR Module Models — Members, Volunteers, Executive Members/Officers, Attendance, Leave, Payroll"""
import uuid
from datetime import date
from django.db import models
from django.utils import timezone
from encrypted_model_fields.fields import EncryptedCharField, EncryptedTextField
from core.models import User
from core.validators import validate_image_file, validate_document_file


def hr_doc_path(instance, filename):
    return f'hr/documents/{instance.__class__.__name__}/{filename}'


class Gender(models.TextChoices):
    MALE = 'MALE', 'Male'
    FEMALE = 'FEMALE', 'Female'
    OTHER = 'OTHER', 'Other'


# ── Members ───────────────────────────────────────────────────────

class MemberStatus(models.TextChoices):
    ACTIVE = 'ACTIVE', 'Active'
    INACTIVE = 'INACTIVE', 'Inactive'
    SUSPENDED = 'SUSPENDED', 'Suspended'
    EXPIRED = 'EXPIRED', 'Expired'
    RESIGNED = 'RESIGNED', 'Resigned'


class MembershipType(models.TextChoices):
    GENERAL = 'GENERAL', 'General'
    LIFE = 'LIFE', 'Life Member'
    HONORARY = 'HONORARY', 'Honorary'
    PATRON = 'PATRON', 'Patron'


class Member(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    member_id = models.CharField(max_length=20, unique=True, db_index=True)
    full_name = models.CharField(max_length=255)
    photo = models.ImageField(upload_to='hr/members/', null=True, blank=True, validators=[validate_image_file])
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=10, choices=Gender.choices, blank=True)
    phone = EncryptedCharField(max_length=20, blank=True)           # Encrypted PII
    email = models.EmailField(blank=True)
    address = EncryptedTextField(blank=True)                         # Encrypted PII
    joining_date = models.DateField(default=date.today)
    membership_type = models.CharField(max_length=20, choices=MembershipType.choices, default=MembershipType.GENERAL)
    status = models.CharField(max_length=20, choices=MemberStatus.choices, default=MemberStatus.ACTIVE)
    blood_group = models.CharField(max_length=5, blank=True)
    occupation = models.CharField(max_length=255, blank=True)
    monthly_fee = models.DecimalField(max_digits=10, decimal_places=2, default=100.00)
    emergency_contact_name = models.CharField(max_length=255, blank=True)
    emergency_contact_phone = EncryptedCharField(max_length=20, blank=True)  # Encrypted PII
    remarks = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'hr_members'
        ordering = ['full_name']

    def save(self, *args, **kwargs):
        if not self.member_id:
            count = Member.objects.count() + 1
            candidate = f"{count:04d}"
            while Member.objects.filter(member_id=candidate).exists():
                count += 1
                candidate = f"{count:04d}"
            self.member_id = candidate
        super().save(*args, **kwargs)


class MemberDocument(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    member = models.ForeignKey(Member, on_delete=models.CASCADE, related_name='documents')
    doc_type = models.CharField(max_length=50)
    file = models.FileField(upload_to='hr/member_docs/', validators=[validate_document_file])
    expiry_date = models.DateField(null=True, blank=True)
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    uploaded_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'hr_member_documents'


class MembershipReceipt(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    receipt_number = models.CharField(max_length=50, unique=True, db_index=True)
    member = models.ForeignKey(Member, on_delete=models.CASCADE, related_name='receipts')
    amount = models.DecimalField(max_digits=10, decimal_places=2, default=100.00)
    pdf_file = models.FileField(upload_to='membership_receipts/', validators=[validate_document_file])
    whatsapp_status = models.CharField(max_length=20, default='PENDING', choices=[
        ('PENDING', 'Pending'), ('SENT', 'Sent'), ('FAILED', 'Failed')
    ])
    generated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'hr_membership_receipts'
        ordering = ['-generated_at']

    def save(self, *args, **kwargs):
        if not self.receipt_number:
            count = MembershipReceipt.objects.count() + 1
            candidate = f"{count:06d}"
            while MembershipReceipt.objects.filter(receipt_number=candidate).exists():
                count += 1
                candidate = f"{count:06d}"
            self.receipt_number = candidate
        super().save(*args, **kwargs)


# ── Volunteers ────────────────────────────────────────────────────

class VolunteerStatus(models.TextChoices):
    ACTIVE = 'ACTIVE', 'Active'
    INACTIVE = 'INACTIVE', 'Inactive'
    SUSPENDED = 'SUSPENDED', 'Suspended'


class Volunteer(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    volunteer_id = models.CharField(max_length=20, unique=True, db_index=True)
    full_name = models.CharField(max_length=255)
    photo = models.ImageField(upload_to='hr/volunteers/', null=True, blank=True, validators=[validate_image_file])
    phone = EncryptedCharField(max_length=20, blank=True)           # Encrypted PII
    email = models.EmailField(blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    address = EncryptedTextField(blank=True)                         # Encrypted PII
    joining_date = models.DateField(default=date.today)
    skills = models.TextField(blank=True)
    availability = models.CharField(max_length=100, blank=True)
    emergency_contact_name = models.CharField(max_length=255, blank=True)
    emergency_contact_phone = EncryptedCharField(max_length=20, blank=True)  # Encrypted PII
    assigned_programs = models.JSONField(default=list)
    total_hours = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=VolunteerStatus.choices, default=VolunteerStatus.ACTIVE)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'hr_volunteers'
        ordering = ['full_name']

    def save(self, *args, **kwargs):
        if not self.volunteer_id:
            count = Volunteer.objects.count() + 1
            candidate = f"VOL-{count:05d}"
            while Volunteer.objects.filter(volunteer_id=candidate).exists():
                count += 1
                candidate = f"VOL-{count:05d}"
            self.volunteer_id = candidate
        super().save(*args, **kwargs)


# ── Executive Members ─────────────────────────────────────────────

class ExecutiveMember(models.Model):
    class Position(models.TextChoices):
        PRESIDENT = 'PRESIDENT', 'President'
        VICE_PRESIDENT = 'VICE_PRESIDENT', 'Vice President'
        SECRETARY = 'SECRETARY', 'Secretary'
        JOINT_SECRETARY = 'JOINT_SECRETARY', 'Joint Secretary'
        TREASURER = 'TREASURER', 'Treasurer'
        COMMITTEE_MEMBER = 'COMMITTEE_MEMBER', 'Committee Member'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    exec_id = models.CharField(max_length=20, unique=True, db_index=True)
    full_name = models.CharField(max_length=255)
    photo = models.ImageField(upload_to='hr/exec_members/', null=True, blank=True, validators=[validate_image_file])
    designation = models.CharField(max_length=30, choices=Position.choices)
    phone = EncryptedCharField(max_length=20, blank=True)           # Encrypted PII
    email = models.EmailField(blank=True)
    address = EncryptedTextField(blank=True)                         # Encrypted PII
    appointment_date = models.DateField()
    term_start = models.DateField()
    term_end = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, default='ACTIVE', choices=[
        ('ACTIVE', 'Active'), ('INACTIVE', 'Inactive'), ('COMPLETED', 'Term Completed')
    ])
    previous_positions = models.JSONField(default=list)
    documents = models.JSONField(default=list)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'hr_executive_members'
        ordering = ['designation', 'full_name']

    def save(self, *args, **kwargs):
        if not self.exec_id:
            count = ExecutiveMember.objects.count() + 1
            candidate = f"EXEC-{count:04d}"
            while ExecutiveMember.objects.filter(exec_id=candidate).exists():
                count += 1
                candidate = f"EXEC-{count:04d}"
            self.exec_id = candidate
        super().save(*args, **kwargs)


# ── Executive Officers (Salaried Employees) ───────────────────────

class EmploymentType(models.TextChoices):
    FULL_TIME = 'FULL_TIME', 'Full Time'
    PART_TIME = 'PART_TIME', 'Part Time'
    CONTRACT = 'CONTRACT', 'Contract'
    VOLUNTEER_STAFF = 'VOLUNTEER_STAFF', 'Volunteer Staff'


class EmployeeStatus(models.TextChoices):
    ACTIVE = 'ACTIVE', 'Active'
    PROBATION = 'PROBATION', 'Probation'
    ON_LEAVE = 'ON_LEAVE', 'On Leave'
    SUSPENDED = 'SUSPENDED', 'Suspended'
    RESIGNED = 'RESIGNED', 'Resigned'
    TERMINATED = 'TERMINATED', 'Terminated'
    RETIRED = 'RETIRED', 'Retired'


class ExecutiveOfficer(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee_id = models.CharField(max_length=20, unique=True, db_index=True)
    full_name = models.CharField(max_length=255)
    photo = models.ImageField(upload_to='hr/officers/', null=True, blank=True, validators=[validate_image_file])
    designation = models.CharField(max_length=255)
    department = models.CharField(max_length=100, blank=True)
    phone = EncryptedCharField(max_length=20, blank=True)                  # Encrypted PII
    email = models.EmailField(blank=True)
    address = EncryptedTextField(blank=True)                                # Encrypted PII
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=10, choices=Gender.choices, blank=True)
    joining_date = models.DateField(default=date.today)
    employment_type = models.CharField(max_length=20, choices=EmploymentType.choices, default=EmploymentType.FULL_TIME)
    status = models.CharField(max_length=20, choices=EmployeeStatus.choices, default=EmployeeStatus.ACTIVE)
    bank_name = models.CharField(max_length=100, blank=True)
    bank_account_number = EncryptedCharField(max_length=50, blank=True)     # Encrypted FINANCIAL
    ifsc_code = EncryptedCharField(max_length=20, blank=True)               # Encrypted FINANCIAL
    pan_number = EncryptedCharField(max_length=20, blank=True)              # Encrypted GOVT ID
    emergency_contact_name = models.CharField(max_length=255, blank=True)
    emergency_contact_phone = EncryptedCharField(max_length=20, blank=True) # Encrypted PII
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'hr_executive_officers'
        ordering = ['full_name']

    def save(self, *args, **kwargs):
        if not self.employee_id:
            count = ExecutiveOfficer.objects.count() + 1
            candidate = f"EMP-{count:05d}"
            while ExecutiveOfficer.objects.filter(employee_id=candidate).exists():
                count += 1
                candidate = f"EMP-{count:05d}"
            self.employee_id = candidate
        super().save(*args, **kwargs)


class SalaryStructure(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(ExecutiveOfficer, on_delete=models.CASCADE, related_name='salary_structures')
    effective_from = models.DateField()
    basic_salary = models.DecimalField(max_digits=10, decimal_places=2)
    hra = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    ta = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    other_allowances = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    pf_deduction = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    other_deductions = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'hr_salary_structures'

    @property
    def gross_salary(self):
        return self.basic_salary + self.hra + self.ta + self.other_allowances

    @property
    def net_salary(self):
        return self.gross_salary - self.pf_deduction - self.other_deductions


# ── Attendance ────────────────────────────────────────────────────

class AttendanceStatus(models.TextChoices):
    PRESENT = 'PRESENT', 'Present'
    ABSENT = 'ABSENT', 'Absent'
    LATE = 'LATE', 'Late'
    HALF_DAY = 'HALF_DAY', 'Half Day'
    WFH = 'WFH', 'Work From Home'
    LEAVE = 'LEAVE', 'On Leave'
    HOLIDAY = 'HOLIDAY', 'Holiday'


class Attendance(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(ExecutiveOfficer, on_delete=models.CASCADE, related_name='attendance_records')
    date = models.DateField(db_index=True)
    check_in = models.TimeField(null=True, blank=True)
    check_out = models.TimeField(null=True, blank=True)
    working_hours = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=20, choices=AttendanceStatus.choices)
    remarks = models.CharField(max_length=255, blank=True)
    marked_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'hr_attendance'
        unique_together = ['employee', 'date']
        ordering = ['-date']


# ── Leave ─────────────────────────────────────────────────────────

class LeaveType(models.TextChoices):
    CASUAL = 'CASUAL', 'Casual Leave'
    SICK = 'SICK', 'Sick Leave'
    EARNED = 'EARNED', 'Earned Leave'
    MATERNITY = 'MATERNITY', 'Maternity Leave'
    PATERNITY = 'PATERNITY', 'Paternity Leave'
    COMP_OFF = 'COMP_OFF', 'Comp Off'
    UNPAID = 'UNPAID', 'Unpaid Leave'


class LeaveRequest(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(ExecutiveOfficer, on_delete=models.CASCADE, related_name='leave_requests')
    leave_type = models.CharField(max_length=20, choices=LeaveType.choices)
    from_date = models.DateField()
    to_date = models.DateField()
    number_of_days = models.PositiveSmallIntegerField()
    reason = models.TextField()
    attachment = models.FileField(upload_to='hr/leaves/', null=True, blank=True, validators=[validate_document_file])
    status = models.CharField(max_length=20, default='PENDING', choices=[
        ('PENDING', 'Pending'), ('APPROVED', 'Approved'), ('REJECTED', 'Rejected'), ('CANCELLED', 'Cancelled')
    ])
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_leaves')
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'hr_leave_requests'
        ordering = ['-created_at']


# ── Payroll ───────────────────────────────────────────────────────

class PayrollStatus(models.TextChoices):
    DRAFT = 'DRAFT', 'Draft'
    GENERATED = 'GENERATED', 'Generated'
    APPROVED = 'APPROVED', 'Approved'
    PAID = 'PAID', 'Paid'
    CANCELLED = 'CANCELLED', 'Cancelled'


class MonthlyPayroll(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    payroll_id = models.CharField(max_length=20, unique=True, db_index=True)
    employee = models.ForeignKey(ExecutiveOfficer, on_delete=models.CASCADE, related_name='payrolls')
    month = models.PositiveSmallIntegerField()
    year = models.PositiveSmallIntegerField()
    salary_structure = models.ForeignKey(SalaryStructure, on_delete=models.PROTECT)
    # Computed
    working_days = models.PositiveSmallIntegerField(default=0)
    present_days = models.PositiveSmallIntegerField(default=0)
    absent_days = models.PositiveSmallIntegerField(default=0)
    leave_days = models.PositiveSmallIntegerField(default=0)
    # Amounts
    basic_salary = models.DecimalField(max_digits=10, decimal_places=2)
    hra = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    ta = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    other_allowances = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    gross_salary = models.DecimalField(max_digits=10, decimal_places=2)
    pf_deduction = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    other_deductions = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    net_salary = models.DecimalField(max_digits=10, decimal_places=2)
    # Status
    status = models.CharField(max_length=20, choices=PayrollStatus.choices, default=PayrollStatus.DRAFT)
    payment_method = models.CharField(max_length=20, blank=True)
    payment_date = models.DateField(null=True, blank=True)
    payment_reference = models.CharField(max_length=100, blank=True)
    remarks = models.TextField(blank=True)
    generated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='generated_payrolls')
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_payrolls')
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'hr_monthly_payroll'
        unique_together = ['employee', 'month', 'year']
        ordering = ['-year', '-month']

    def save(self, *args, **kwargs):
        if not self.payroll_id:
            self.payroll_id = f"PAY-{self.year}-{self.month:02d}-{self.employee.employee_id}"
        super().save(*args, **kwargs)


class EmployeeDocument(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(ExecutiveOfficer, on_delete=models.CASCADE, related_name='documents')
    doc_type = models.CharField(max_length=100)
    file = models.FileField(upload_to='hr/employee_docs/', validators=[validate_document_file])
    expiry_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, default='VALID', choices=[
        ('VALID', 'Valid'), ('EXPIRED', 'Expired'), ('REPLACED', 'Replaced')
    ])
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    uploaded_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'hr_employee_documents'


class ComplaintStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending'
    IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
    RESOLVED = 'RESOLVED', 'Resolved'
    REJECTED = 'REJECTED', 'Rejected'


class Complaint(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    complaint_id = models.CharField(max_length=20, unique=True, db_index=True)
    employee = models.ForeignKey(ExecutiveOfficer, on_delete=models.CASCADE, related_name='complaints')
    title = models.CharField(max_length=255)
    description = models.TextField()
    status = models.CharField(max_length=20, choices=ComplaintStatus.choices, default=ComplaintStatus.PENDING)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'hr_complaints'
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.complaint_id:
            # Generate a unique ID like CMP-XXXXXX
            last_complaint = Complaint.objects.order_by('-created_at').first()
            if last_complaint and last_complaint.complaint_id.startswith('CMP-'):
                try:
                    last_num = int(last_complaint.complaint_id.split('-')[1])
                    self.complaint_id = f"CMP-{last_num + 1:06d}"
                except ValueError:
                    self.complaint_id = f"CMP-{uuid.uuid4().hex[:6].upper()}"
            else:
                self.complaint_id = "CMP-000001"
        super().save(*args, **kwargs)


# ── Staff Reports ──────────────────────────────────────────────────

class StaffReportStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending'
    UNDER_REVIEW = 'UNDER_REVIEW', 'Under Review'
    APPROVED = 'APPROVED', 'Approved'
    REJECTED = 'REJECTED', 'Rejected'


class StaffReport(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    report_id = models.CharField(max_length=20, unique=True, db_index=True)
    employee = models.ForeignKey(ExecutiveOfficer, on_delete=models.SET_NULL, null=True, blank=True, related_name='reports')
    submitted_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='submitted_reports')
    title = models.CharField(max_length=255)
    description = models.TextField()
    file = models.FileField(upload_to='hr/reports/', null=True, blank=True, validators=[validate_document_file])
    report_date = models.DateField(default=date.today)
    status = models.CharField(max_length=20, choices=StaffReportStatus.choices, default=StaffReportStatus.PENDING)
    admin_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'hr_staff_reports'
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.report_id:
            last = StaffReport.objects.order_by('-created_at').first()
            if last and last.report_id.startswith('REP-'):
                try:
                    last_num = int(last.report_id.split('-')[1])
                    self.report_id = f"REP-{last_num + 1:06d}"
                except ValueError:
                    self.report_id = f"REP-{uuid.uuid4().hex[:6].upper()}"
            else:
                self.report_id = "REP-000001"
        super().save(*args, **kwargs)


# ── Payment Advance Requests ──────────────────────────────────────

class PaymentAdvanceStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending'
    APPROVED = 'APPROVED', 'Approved'
    REJECTED = 'REJECTED', 'Rejected'
    DISBURSED = 'DISBURSED', 'Disbursed'


class PaymentAdvanceRequest(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    request_id = models.CharField(max_length=20, unique=True, db_index=True)
    employee = models.ForeignKey(ExecutiveOfficer, on_delete=models.SET_NULL, null=True, blank=True, related_name='advance_requests')
    requested_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='payment_advances')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    reason = models.TextField(blank=True, null=True)
    needed_by_date = models.DateField()  # Date staff requests to receive the payment
    payout_date = models.DateField(null=True, blank=True)  # Date HR agrees/schedules to disburse it
    status = models.CharField(max_length=20, choices=PaymentAdvanceStatus.choices, default=PaymentAdvanceStatus.PENDING)
    hr_remarks = models.TextField(blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'hr_payment_advance_requests'
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.request_id:
            last = PaymentAdvanceRequest.objects.order_by('-created_at').first()
            if last and last.request_id.startswith('ADV-'):
                try:
                    last_num = int(last.request_id.split('-')[1])
                    self.request_id = f"ADV-{last_num + 1:06d}"
                except ValueError:
                    self.request_id = f"ADV-{uuid.uuid4().hex[:6].upper()}"
            else:
                self.request_id = "ADV-000001"
        super().save(*args, **kwargs)


# ── Performance Points (Achieved Points) ──────────────────────────

class PerformancePoint(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(ExecutiveOfficer, on_delete=models.CASCADE, related_name='performance_points')
    points = models.PositiveIntegerField(default=0)
    month = models.PositiveSmallIntegerField()  # 1-12
    year = models.PositiveSmallIntegerField()   # e.g. 2026
    reason = models.TextField(blank=True)
    awarded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='awarded_points')
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'hr_performance_points'
        ordering = ['-year', '-month', '-created_at']


class StaffVoucherBook(models.Model):
    """
    Tracks the voucher book assigned to each STAFF user.
    HR assigns the book; the current_voucher auto-increments after
    every Add Member or Donation Collection receipt.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    staff = models.OneToOneField(
        User, on_delete=models.CASCADE,
        related_name='voucher_book',
        limit_choices_to={'role': 'STAFF'},
    )
    book_number = models.PositiveIntegerField(default=1, help_text="Voucher book number (e.g. 1, 2, 3)")
    voucher_start = models.PositiveIntegerField(default=1, help_text="First voucher number in the book")
    voucher_end = models.PositiveIntegerField(default=100, help_text="Last voucher number in the book")
    current_voucher = models.PositiveIntegerField(default=1, help_text="Next voucher to be issued")

    # Queued Next Book Fields
    next_book_number = models.PositiveIntegerField(null=True, blank=True, help_text="Queued next book number")
    next_voucher_start = models.PositiveIntegerField(null=True, blank=True, help_text="First voucher number of next book")
    next_voucher_end = models.PositiveIntegerField(null=True, blank=True, help_text="Last voucher number of next book")

    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='voucher_updates')

    class Meta:
        db_table = 'hr_staff_voucher_books'

    def __str__(self):
        return f"Book {self.book_number} — {self.staff.full_name} (Current: {self.current_voucher})"

    def increment(self):
        """Advance the current voucher by 1. Rolls over to queued book if available. Raises Exception if exhausted."""
        if self.current_voucher >= self.voucher_end:
            if self.next_book_number is not None:
                self.book_number = self.next_book_number
                self.voucher_start = self.next_voucher_start
                self.voucher_end = self.next_voucher_end
                self.current_voucher = self.next_voucher_start
                self.next_book_number = None
                self.next_voucher_start = None
                self.next_voucher_end = None
            else:
                raise ValueError("Voucher book exhausted. Please contact HR to assign a new voucher book.")
        else:
            self.current_voucher += 1
        
        self.save(update_fields=[
            'book_number', 'voucher_start', 'voucher_end', 'current_voucher',
            'next_book_number', 'next_voucher_start', 'next_voucher_end', 'updated_at'
        ])


class PromoterRegistryEntry(models.Model):
    """
    Daily end-of-day reconciliation record for each promoter/staff member.
    - cash_collected / online_collected: auto-computed from Income records (mobile collections)
    - cash_submitted: physical cash the staff member hands over at office in the evening
    - is_closed: when True, the staff member cannot make new collections for that date
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    date = models.DateField(default=timezone.now)
    promoter = models.ForeignKey(User, on_delete=models.CASCADE, related_name='promoter_registry_entries')
    entry_code = models.CharField(max_length=50, blank=True, default='', help_text="e.g. VR250528001")
    starting_reading = models.PositiveIntegerField(default=0)
    ending_reading = models.PositiveIntegerField(default=0)

    # Auto-populated from Income records (mobile app collections) — HR can override
    cash_collected = models.DecimalField(max_digits=12, decimal_places=2, default=0.00,
        help_text='Auto-sum from CASH transactions via mobile. HR can override.')
    online_collected = models.DecimalField(max_digits=12, decimal_places=2, default=0.00,
        help_text='Auto-sum from UPI/online transactions via mobile. HR can override.')

    # Physical cash the staff member submits at the office in the evening
    cash_submitted = models.DecimalField(max_digits=12, decimal_places=2, default=0.00,
        help_text='Physical cash submitted by the promoter at the office.')

    # Day closing
    is_closed = models.BooleanField(default=False,
        help_text='When True, the promoter cannot make new collections for this date.')
    closed_at = models.DateTimeField(null=True, blank=True)
    closed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='promoter_closings')

    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='promoter_registry_creations')

    class Meta:
        db_table = 'hr_promoter_registry'
        ordering = ['-date', '-created_at']
        unique_together = [('promoter', 'date')]  # One entry per staff per day

    def __str__(self):
        return f"{self.promoter.full_name} ({self.date}) - {'CLOSED' if self.is_closed else 'OPEN'}"

    @property
    def total_collected(self):
        return self.cash_collected + self.online_collected

    @property
    def has_discrepancy(self):
        """True if cash submitted doesn't match cash collected from mobile."""
        return abs(self.cash_submitted - self.cash_collected) > 0.01

