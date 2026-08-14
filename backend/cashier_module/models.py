"""Cashier Module Models — Disbursements, Cash Closing, Cash Handover"""
import uuid
from django.db import models
from django.utils import timezone
from core.models import User
from manager_module.models import AssessmentRequest


class Disbursement(models.Model):
    """Links an approved AssessmentRequest to a physical cash payment by the cashier."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    disbursement_id = models.CharField(max_length=20, unique=True, db_index=True)
    request = models.OneToOneField(AssessmentRequest, on_delete=models.PROTECT, related_name='disbursement')
    amount_disbursed = models.DecimalField(max_digits=12, decimal_places=2)
    payment_method = models.CharField(max_length=20, choices=[
        ('CASH', 'Cash'), ('CHEQUE', 'Cheque'), ('UPI', 'UPI'), ('NEFT', 'NEFT'), ('OTHER', 'Other')
    ], default='CASH')
    voucher_number = models.CharField(max_length=50, blank=True)
    receiver_name = models.CharField(max_length=255)
    receiver_signature = models.ImageField(upload_to='disbursements/signatures/', null=True, blank=True)
    reference = models.CharField(max_length=100, blank=True)
    date = models.DateField(default=timezone.now)
    remarks = models.TextField(blank=True)
    document = models.FileField(upload_to='disbursements/', null=True, blank=True)
    disbursed_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name='disbursements')
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'cashier_disbursements'
        ordering = ['-date']

    def save(self, *args, **kwargs):
        if not self.disbursement_id:
            year = timezone.now().year
            count = Disbursement.objects.filter(date__year=year).count() + 1
            self.disbursement_id = f"DSB-{year}-{count:05d}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.disbursement_id} — {self.request.request_number}"


class CashClosing(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    date = models.DateField(unique=True)
    system_balance = models.DecimalField(max_digits=12, decimal_places=2)
    physical_cash = models.DecimalField(max_digits=12, decimal_places=2)
    difference = models.DecimalField(max_digits=12, decimal_places=2)
    difference_reason = models.TextField(blank=True)
    closed_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name='cash_closings')
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_closings')
    status = models.CharField(max_length=20, default='SUBMITTED', choices=[
        ('SUBMITTED', 'Submitted'), ('APPROVED', 'Approved'), ('DISPUTED', 'Disputed')
    ])
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'cashier_cash_closing'
        ordering = ['-date']


class CashHandover(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    handover_id = models.CharField(max_length=20, unique=True, db_index=True)
    date = models.DateField(default=timezone.now)
    from_cashier = models.ForeignKey(User, on_delete=models.PROTECT, related_name='handovers_given')
    to_person = models.ForeignKey(User, on_delete=models.PROTECT, related_name='handovers_received')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    reason = models.TextField()
    from_confirmed = models.BooleanField(default=True)
    to_confirmed = models.BooleanField(default=False)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'cashier_handovers'
        ordering = ['-date']

    def save(self, *args, **kwargs):
        if not self.handover_id:
            count = CashHandover.objects.count() + 1
            self.handover_id = f"HND-{count:04d}"
        super().save(*args, **kwargs)
