"""Accounts Module Models — Cash, Bank, Income, Expenses, Cheques, Transfers, Transactions"""
import uuid
from datetime import date
from django.db import models
from django.utils import timezone
from encrypted_model_fields.fields import EncryptedCharField
from core.models import User
from core.validators import validate_document_file


class PaymentMethod(models.TextChoices):
    CASH = 'CASH', 'Cash'
    CHEQUE = 'CHEQUE', 'Cheque'
    NEFT = 'NEFT', 'NEFT'
    RTGS = 'RTGS', 'RTGS'
    IMPS = 'IMPS', 'IMPS'
    UPI = 'UPI', 'UPI'
    DD = 'DD', 'Demand Draft'
    OTHER = 'OTHER', 'Other'


# ── Cash Account ──────────────────────────────────────────────────

class CashAccount(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, default='Main Cash')
    opening_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    current_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'accounts_cash'

    def __str__(self):
        return f"{self.name} — ₹{self.current_balance}"


class CashTransaction(models.Model):
    class TxnType(models.TextChoices):
        RECEIPT = 'RECEIPT', 'Receipt'
        PAYMENT = 'PAYMENT', 'Payment'
        OPENING = 'OPENING', 'Opening Balance'
        TRANSFER_IN = 'TRANSFER_IN', 'Transfer In'
        TRANSFER_OUT = 'TRANSFER_OUT', 'Transfer Out'
        ADJUSTMENT = 'ADJUSTMENT', 'Adjustment'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cash_account = models.ForeignKey(CashAccount, on_delete=models.PROTECT, related_name='transactions')
    transaction_type = models.CharField(max_length=100, default='RECEIPT')
    date = models.DateField(default=date.today)
    description = models.CharField(max_length=255, blank=True)
    reference_id = models.CharField(max_length=50, blank=True, db_index=True)  # e.g. MR-2026-00125
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    balance_after = models.DecimalField(max_digits=12, decimal_places=2)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(default=timezone.now)
    voucher_number = models.CharField(max_length=50, blank=True)

    class Meta:
        db_table = 'accounts_cash_transactions'
        ordering = ['date', 'created_at']


# ── Bank Account ──────────────────────────────────────────────────

class BankAccount(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    bank_name = models.CharField(max_length=100)
    account_name = models.CharField(max_length=255)
    account_number = EncryptedCharField(max_length=50, blank=True)   # Encrypted FINANCIAL (unique enforced at serializer level)
    branch = models.CharField(max_length=255, blank=True)
    ifsc_code = EncryptedCharField(max_length=20, blank=True)        # Encrypted FINANCIAL
    opening_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    current_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'accounts_bank'

    def __str__(self):
        return f"{self.bank_name} — {self.account_number}"


class BankTransaction(models.Model):
    class TxnType(models.TextChoices):
        DEPOSIT = 'DEPOSIT', 'Deposit'
        WITHDRAWAL = 'WITHDRAWAL', 'Withdrawal'
        TRANSFER_IN = 'TRANSFER_IN', 'Transfer In'
        TRANSFER_OUT = 'TRANSFER_OUT', 'Transfer Out'
        CHARGES = 'CHARGES', 'Bank Charges'
        INTEREST = 'INTEREST', 'Interest'
        NEFT = 'NEFT', 'NEFT'
        RTGS = 'RTGS', 'RTGS'
        IMPS = 'IMPS', 'IMPS'
        UPI = 'UPI', 'UPI'
        CHEQUE = 'CHEQUE', 'Cheque'
        ADJUSTMENT = 'ADJUSTMENT', 'Adjustment'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    bank_account = models.ForeignKey(BankAccount, on_delete=models.PROTECT, related_name='transactions')
    transaction_type = models.CharField(max_length=20, choices=TxnType.choices)
    date = models.DateField(default=date.today)
    description = models.CharField(max_length=255, blank=True)
    reference_id = models.CharField(max_length=50, blank=True, db_index=True)
    payment_method = models.CharField(max_length=20, choices=PaymentMethod.choices, default=PaymentMethod.NEFT)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    balance_after = models.DecimalField(max_digits=12, decimal_places=2)
    utr_number = models.CharField(max_length=100, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'accounts_bank_transactions'
        ordering = ['date', 'created_at']


# ── Income / Expenses ─────────────────────────────────────────────

class IncomeSource(models.TextChoices):
    DONATION   = 'DONATION',   'Donation'
    GRANT      = 'GRANT',      'Grant'
    SPONSORSHIP= 'SPONSORSHIP','Sponsorship'
    MEMBERSHIP = 'MEMBERSHIP', 'Membership Fees'
    FUNDRAISING= 'FUNDRAISING','Fundraising'
    INTEREST   = 'INTEREST',   'Interest'
    INWARD     = 'INWARD',     'Inward Receipt'
    OTHER      = 'OTHER',      'Other Income'


class Income(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    receipt_number = models.CharField(max_length=20, unique=True, db_index=True)
    date = models.DateField(default=date.today)
    donor_name = models.CharField(max_length=255, blank=True)
    donor_phone = EncryptedCharField(max_length=20, blank=True, null=True)  # Encrypted PII — donor contact
    source = models.CharField(max_length=100)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_method = models.CharField(max_length=20, choices=PaymentMethod.choices)
    purpose = models.CharField(max_length=255, blank=True)
    place = models.CharField(max_length=255, blank=True)
    reference_number = models.CharField(max_length=100, blank=True)
    bill_book_no = models.CharField(max_length=50, blank=True)
    bill_book_start = models.CharField(max_length=50, blank=True)
    bill_book_end = models.CharField(max_length=50, blank=True)
    account_type = models.CharField(max_length=10, choices=[('CASH', 'Cash'), ('BANK', 'Bank')], default='CASH')
    cash_account = models.ForeignKey(CashAccount, on_delete=models.SET_NULL, null=True, blank=True)
    bank_account = models.ForeignKey(BankAccount, on_delete=models.SET_NULL, null=True, blank=True)
    document = models.FileField(upload_to='income/', null=True, blank=True, validators=[validate_document_file])
    whatsapp_status = models.CharField(max_length=20, default='PENDING', choices=[
        ('PENDING', 'Pending'), ('SENT', 'Sent'), ('FAILED', 'Failed')
    ])
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'accounts_income'
        ordering = ['-date', '-created_at']

    def save(self, *args, **kwargs):
        if not self.receipt_number:
            year = timezone.now().year
            count = Income.objects.filter(date__year=year).count() + 1
            candidate = f"RCP-{year}-{count:05d}"
            while Income.objects.filter(receipt_number=candidate).exists():
                count += 1
                candidate = f"RCP-{year}-{count:05d}"
            self.receipt_number = candidate
        super().save(*args, **kwargs)


class ExpenseCategory(models.TextChoices):
    MEDICAL     = 'MEDICAL',     'Medical Assistance'
    EDUCATION   = 'EDUCATION',   'Education Assistance'
    FOOD        = 'FOOD',        'Food Distribution'
    CHARITY     = 'CHARITY',     'Charity Programs'
    TRANSPORT   = 'TRANSPORT',   'Transportation'
    OFFICE      = 'OFFICE',      'Office Expenses'
    UTILITIES   = 'UTILITIES',   'Utilities'
    MAINTENANCE = 'MAINTENANCE', 'Maintenance'
    PURCHASE    = 'PURCHASE',    'Purchases'
    OUTWARD     = 'OUTWARD',     'Outward Dispatch'
    SALARY      = 'SALARY',      'Salary'
    OTHER       = 'OTHER',       'Other'


class Expense(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    expense_id = models.CharField(max_length=20, unique=True, db_index=True)
    date = models.DateField(default=date.today)
    payee = models.CharField(max_length=255)
    category = models.CharField(max_length=100, blank=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_method = models.CharField(max_length=20, choices=PaymentMethod.choices)
    purpose = models.CharField(max_length=255, blank=True)
    account_type = models.CharField(max_length=10, choices=[('CASH', 'Cash'), ('BANK', 'Bank')], default='CASH')
    cash_account = models.ForeignKey(CashAccount, on_delete=models.SET_NULL, null=True, blank=True)
    bank_account = models.ForeignKey(BankAccount, on_delete=models.SET_NULL, null=True, blank=True)
    reference_request = models.ForeignKey('manager_module.AssessmentRequest', on_delete=models.SET_NULL,
                                           null=True, blank=True, related_name='expenses')
    status = models.CharField(max_length=20, default='COMPLETED', choices=[
        ('PENDING', 'Pending'), ('COMPLETED', 'Completed'), ('CANCELLED', 'Cancelled')
    ])
    reference_number = models.CharField(max_length=100, blank=True)
    remarks = models.TextField(blank=True)
    document = models.FileField(upload_to='expenses/', null=True, blank=True, validators=[validate_document_file])
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_expenses')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_expenses')
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'accounts_expenses'
        ordering = ['-date']

    def save(self, *args, **kwargs):
        if not self.expense_id:
            year = timezone.now().year
            count = Expense.objects.filter(date__year=year).count() + 1
            candidate = f"EXP-{year}-{count:05d}"
            while Expense.objects.filter(expense_id=candidate).exists():
                count += 1
                candidate = f"EXP-{year}-{count:05d}"
            self.expense_id = candidate
        super().save(*args, **kwargs)


# ── Cheques ───────────────────────────────────────────────────────

class Cheque(models.Model):
    class ChequeStatus(models.TextChoices):
        ISSUED = 'ISSUED', 'Issued'
        RECEIVED = 'RECEIVED', 'Received'
        DEPOSITED = 'DEPOSITED', 'Deposited'
        PENDING = 'PENDING', 'Pending Clearance'
        CLEARED = 'CLEARED', 'Cleared'
        BOUNCED = 'BOUNCED', 'Bounced'
        CANCELLED = 'CANCELLED', 'Cancelled'

    class ChequeType(models.TextChoices):
        ISSUED = 'ISSUED', 'Issued (Payment)'
        RECEIVED = 'RECEIVED', 'Received (Income)'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cheque_number = models.CharField(max_length=50, db_index=True)
    cheque_type = models.CharField(max_length=10, choices=ChequeType.choices)
    date = models.DateField()
    bank_account = models.ForeignKey(BankAccount, on_delete=models.PROTECT)
    payee_payer = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    purpose = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=20, choices=ChequeStatus.choices, default=ChequeStatus.ISSUED)
    deposit_date = models.DateField(null=True, blank=True)
    clearance_date = models.DateField(null=True, blank=True)
    remarks = models.TextField(blank=True)
    reference_id = models.CharField(max_length=50, blank=True, db_index=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'accounts_cheques'
        ordering = ['-date']


# ── Transfers ─────────────────────────────────────────────────────

class Transfer(models.Model):
    class TransferType(models.TextChoices):
        CASH_TO_BANK = 'CASH_TO_BANK', 'Cash to Bank'
        BANK_TO_CASH = 'BANK_TO_CASH', 'Bank to Cash'
        BANK_TO_BANK = 'BANK_TO_BANK', 'Bank to Bank'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    transfer_id = models.CharField(max_length=20, unique=True, db_index=True)
    transfer_type = models.CharField(max_length=20, choices=TransferType.choices)
    date = models.DateField(default=date.today)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    from_cash = models.ForeignKey(CashAccount, on_delete=models.PROTECT, null=True, blank=True, related_name='transfers_out')
    from_bank = models.ForeignKey(BankAccount, on_delete=models.PROTECT, null=True, blank=True, related_name='transfers_out')
    to_cash = models.ForeignKey(CashAccount, on_delete=models.PROTECT, null=True, blank=True, related_name='transfers_in')
    to_bank = models.ForeignKey(BankAccount, on_delete=models.PROTECT, null=True, blank=True, related_name='transfers_in')
    reference = models.CharField(max_length=100, blank=True)
    remarks = models.TextField(blank=True)
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_transfers')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_transfers')
    created_at = models.DateTimeField(default=timezone.now)
    reference_number = models.CharField(max_length=100, blank=True)

    class Meta:
        db_table = 'accounts_transfers'
        ordering = ['-date']

    def save(self, *args, **kwargs):
        if not self.reference_number:
            year = timezone.now().year
            count = Transfer.objects.filter(date__year=year).count() + 1
            candidate = f"TRF-{year}-{count:05d}"
            while Transfer.objects.filter(reference_number=candidate).exists():
                count += 1
                candidate = f"TRF-{year}-{count:05d}"
            self.reference_number = candidate
        if not self.transfer_id:
            year = timezone.now().year
            count = Transfer.objects.filter(date__year=year).count() + 1
            self.transfer_id = f"TRF-{year}-{count:05d}"
        super().save(*args, **kwargs)


# ── Central Transaction Register ──────────────────────────────────

class Transaction(models.Model):
    class TxnType(models.TextChoices):
        INCOME = 'INCOME', 'Income'
        EXPENSE = 'EXPENSE', 'Expense'
        TRANSFER = 'TRANSFER', 'Transfer'
        DISBURSEMENT = 'DISBURSEMENT', 'Disbursement'
        SALARY = 'SALARY', 'Salary Payment'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    transaction_id = models.CharField(max_length=20, unique=True, db_index=True)
    reference_id = models.CharField(max_length=50, blank=True, db_index=True)
    date = models.DateField(default=date.today)
    transaction_type = models.CharField(max_length=20, choices=TxnType.choices)
    category = models.CharField(max_length=50, blank=True)
    description = models.CharField(max_length=255)
    account_type = models.CharField(max_length=10, choices=[('CASH', 'Cash'), ('BANK', 'Bank')])
    debit = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    credit = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    payment_method = models.CharField(max_length=20, choices=PaymentMethod.choices, blank=True)
    status = models.CharField(max_length=20, default='COMPLETED')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'accounts_transactions'
        ordering = ['-date', '-created_at']

    def save(self, *args, **kwargs):
        if not self.transaction_id:
            year = timezone.now().year
            count = Transaction.objects.filter(date__year=year).count() + 1
            candidate = f"TXN-{year}-{count:06d}"
            while Transaction.objects.filter(transaction_id=candidate).exists():
                count += 1
                candidate = f"TXN-{year}-{count:06d}"
            self.transaction_id = candidate
        super().save(*args, **kwargs)


# ── Online Donations & Monthly Autopay Subscriptions ─────────────

class PaymentType(models.TextChoices):
    ONE_TIME = 'ONE_TIME', 'One-Time Donation'
    MONTHLY_AUTOPAY = 'MONTHLY_AUTOPAY', 'Monthly Autopay'


class PaymentGatewayStatus(models.TextChoices):
    INITIATED = 'INITIATED', 'Initiated'
    PENDING = 'PENDING', 'Pending'
    SUCCESS = 'SUCCESS', 'Success'
    FAILED = 'FAILED', 'Failed'
    CANCELLED = 'CANCELLED', 'Cancelled'


class SubscriptionStatus(models.TextChoices):
    ACTIVE = 'ACTIVE', 'Active'
    PAUSED = 'PAUSED', 'Paused'
    CANCELLED = 'CANCELLED', 'Cancelled'
    COMPLETED = 'COMPLETED', 'Completed'


class DonationPayment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    donor_user = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='donation_payments')
    donor_name = models.CharField(max_length=255)
    donor_phone = models.CharField(max_length=20, blank=True)
    donor_email = models.EmailField(blank=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_type = models.CharField(max_length=20, choices=PaymentType.choices, default=PaymentType.ONE_TIME)
    purpose = models.CharField(max_length=255, default='General Donation')
    notes = models.TextField(blank=True)

    # Razorpay attributes
    razorpay_order_id = models.CharField(max_length=100, blank=True, db_index=True)
    razorpay_payment_id = models.CharField(max_length=100, blank=True, db_index=True)
    razorpay_signature = models.CharField(max_length=255, blank=True)
    razorpay_subscription_id = models.CharField(max_length=100, blank=True, db_index=True)

    status = models.CharField(max_length=20, choices=PaymentGatewayStatus.choices, default=PaymentGatewayStatus.INITIATED)
    income = models.OneToOneField(Income, null=True, blank=True, on_delete=models.SET_NULL, related_name='online_payment')
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'accounts_donation_payments'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.donor_name} — ₹{self.amount} ({self.status})"


class DonationSubscription(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='donation_subscriptions')
    donor_name = models.CharField(max_length=255)
    donor_phone = models.CharField(max_length=20, blank=True)
    donor_email = models.EmailField(blank=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    purpose = models.CharField(max_length=255, default='Monthly Donation Autopay')

    razorpay_plan_id = models.CharField(max_length=100, blank=True)
    razorpay_subscription_id = models.CharField(max_length=100, unique=True, db_index=True)
    status = models.CharField(max_length=20, choices=SubscriptionStatus.choices, default=SubscriptionStatus.ACTIVE)

    total_cycles_paid = models.PositiveIntegerField(default=0)
    next_charge_date = models.DateField(null=True, blank=True)
    last_charged_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'accounts_donation_subscriptions'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.donor_name} — ₹{self.amount}/month ({self.status})"
