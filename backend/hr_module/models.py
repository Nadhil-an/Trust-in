"""HR Module Models — Members, Volunteers, Executive Members/Officers, Attendance, Leave, Payroll"""
import uuid
from datetime import date
from django.db import models
from django.utils import timezone
from core.models import User



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
    photo = models.ImageField(upload_to='hr/members/', null=True, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=10, choices=Gender.choices, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    joining_date = models.DateField(default=date.today)
    membership_type = models.CharField(max_length=20, choices=MembershipType.choices, default=MembershipType.GENERAL)
    status = models.CharField(max_length=20, choices=MemberStatus.choices, default=MemberStatus.ACTIVE)
    emergency_contact_name = models.CharField(max_length=255, blank=True)
    emergency_contact_phone = models.CharField(max_length=20, blank=True)
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
            self.member_id = f"MEM-{count:05d}"
        super().save(*args, **kwargs)


class MemberDocument(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    member = models.ForeignKey(Member, on_delete=models.CASCADE, related_name='documents')
    doc_type = models.CharField(max_length=50)
    file = models.FileField(upload_to='hr/member_docs/')
    expiry_date = models.DateField(null=True, blank=True)
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    uploaded_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'hr_member_documents'


# ── Volunteers ────────────────────────────────────────────────────

class VolunteerStatus(models.TextChoices):
    ACTIVE = 'ACTIVE', 'Active'
    INACTIVE = 'INACTIVE', 'Inactive'
    SUSPENDED = 'SUSPENDED', 'Suspended'


class Volunteer(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    volunteer_id = models.CharField(max_length=20, unique=True, db_index=True)
    full_name = models.CharField(max_length=255)
    photo = models.ImageField(upload_to='hr/volunteers/', null=True, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    address = models.TextField(blank=True)
    joining_date = models.DateField(default=date.today)
    skills = models.TextField(blank=True)
    availability = models.CharField(max_length=100, blank=True)
    emergency_contact_name = models.CharField(max_length=255, blank=True)
    emergency_contact_phone = models.CharField(max_length=20, blank=True)
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
            self.volunteer_id = f"VOL-{count:05d}"
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
    photo = models.ImageField(upload_to='hr/exec_members/', null=True, blank=True)
    designation = models.CharField(max_length=30, choices=Position.choices)
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
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
            self.exec_id = f"EXEC-{count:04d}"
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
    photo = models.ImageField(upload_to='hr/officers/', null=True, blank=True)
    designation = models.CharField(max_length=255)
    department = models.CharField(max_length=100, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=10, choices=Gender.choices, blank=True)
    joining_date = models.DateField(default=date.today)
    employment_type = models.CharField(max_length=20, choices=EmploymentType.choices, default=EmploymentType.FULL_TIME)
    status = models.CharField(max_length=20, choices=EmployeeStatus.choices, default=EmployeeStatus.ACTIVE)
    bank_name = models.CharField(max_length=100, blank=True)
    bank_account_number = models.CharField(max_length=50, blank=True)
    ifsc_code = models.CharField(max_length=20, blank=True)
    pan_number = models.CharField(max_length=20, blank=True)
    emergency_contact_name = models.CharField(max_length=255, blank=True)
    emergency_contact_phone = models.CharField(max_length=20, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'hr_executive_officers'
        ordering = ['full_name']

    def save(self, *args, **kwargs):
        if not self.employee_id:
            count = ExecutiveOfficer.objects.count() + 1
            self.employee_id = f"EMP-{count:05d}"
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
    attachment = models.FileField(upload_to='hr/leaves/', null=True, blank=True)
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
    file = models.FileField(upload_to='hr/employee_docs/')
    expiry_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, default='VALID', choices=[
        ('VALID', 'Valid'), ('EXPIRED', 'Expired'), ('REPLACED', 'Replaced')
    ])
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    uploaded_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'hr_employee_documents'
