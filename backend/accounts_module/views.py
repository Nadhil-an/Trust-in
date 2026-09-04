"""Accounts Module Views"""
from django.http import HttpResponse
from django.db.models import Sum, Q
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from core.permissions import IsAccountant, IsManagerOrAccountant, IsAnyStaff, IsOwnerOrManager, IsFinanceOrDataEntry
from core.models import AuditLog, Role
from notify.service import push_dashboard_refresh
from notify.whatsapp_service import send_whatsapp_receipt
from accounts_module.receipt_service import generate_receipt_html
from accounts_module.models import (CashAccount, CashTransaction, BankAccount, BankTransaction,
                                     Income, Expense, Cheque, Transfer, Transaction)
from accounts_module.serializers import (CashAccountSerializer, CashTransactionSerializer,
                                          BankAccountSerializer, BankTransactionSerializer,
                                          IncomeSerializer, ExpenseSerializer, ChequeSerializer,
                                          TransferSerializer, TransactionSerializer)

def _sync_promoter_registry(user, target_date):
    if not user:
        return
    from hr_module.models import PromoterRegistryEntry
    from django.db.models import Sum, Q
    from accounts_module.models import Income
    entry = PromoterRegistryEntry.objects.filter(promoter=user, date=target_date).first()
    if entry:
        incomes = Income.objects.filter(created_by=user, date=target_date)
        agg = incomes.aggregate(
            cash=Sum('amount', filter=Q(payment_method='CASH')),
            online=Sum('amount', filter=~Q(payment_method='CASH')),
        )
        entry.cash_collected = agg['cash'] or 0
        entry.online_collected = agg['online'] or 0
        entry.save(update_fields=['cash_collected', 'online_collected'])



# ── Dashboard ─────────────────────────────────────────────────────

class AccountsDashboardView(APIView):
    permission_classes = [IsAccountant]

    def get(self, request):
        from manager_module.models import AssessmentRequest, RequestStatus
        from hr_module.models import MonthlyPayroll
        from dateutil.relativedelta import relativedelta

        cash_bal = sum(a.current_balance for a in CashAccount.objects.filter(is_active=True))
        bank_bal = sum(b.current_balance for b in BankAccount.objects.filter(is_active=True))
        date_str = request.query_params.get('date')
        if date_str:
            try:
                from datetime import datetime
                today = datetime.strptime(date_str, '%Y-%m-%d').date()
            except ValueError:
                today = timezone.now().date()
        else:
            today = timezone.now().date()
            
        month_start = today.replace(day=1)

        income_month = Income.objects.filter(date__gte=month_start).aggregate(t=Sum('amount'))['t'] or 0
        expense_month = Expense.objects.filter(date__gte=month_start).aggregate(t=Sum('amount'))['t'] or 0
        pending_requests = AssessmentRequest.objects.filter(
            status__in=['SUBMITTED', 'UNDER_REVIEW']
        ).count()

        cashier_pending = AssessmentRequest.objects.filter(
            status__in=[RequestStatus.APPROVED, RequestStatus.PENDING_DISBURSEMENT]
        ).count()

        today_income = Income.objects.filter(date=today).aggregate(t=Sum('amount'))['t'] or 0
        today_expense = Expense.objects.filter(date=today).aggregate(t=Sum('amount'))['t'] or 0

        # Pending salaries
        pending_salaries = MonthlyPayroll.objects.filter(status='APPROVED').count()

        # Monthly trend (last 6 months)
        monthly_trend = []
        for i in range(5, -1, -1):
            ms = (today.replace(day=1) - relativedelta(months=i))
            me = ms + relativedelta(months=1)
            inc = float(Income.objects.filter(date__gte=ms, date__lt=me).aggregate(t=Sum('amount'))['t'] or 0)
            exp = float(Expense.objects.filter(date__gte=ms, date__lt=me).aggregate(t=Sum('amount'))['t'] or 0)
            monthly_trend.append({'month': ms.strftime('%b'), 'income': inc, 'expense': exp, 'net': inc - exp})

        # Staff donation collections (This month & Today)
        staff_coll_month_qs = Income.objects.filter(
            source='DONATION', date__gte=month_start, created_by__isnull=False
        ).values('created_by__full_name').annotate(total=Sum('amount')).order_by('-total')
        staff_collections = [{'staff_name': s['created_by__full_name'] or 'Unknown', 'amount': float(s['total'])} for s in staff_coll_month_qs]

        staff_coll_today_qs = Income.objects.filter(
            source='DONATION', date=today, created_by__isnull=False
        ).values('created_by__full_name').annotate(total=Sum('amount')).order_by('-total')
        staff_collections_today = [{'staff_name': s['created_by__full_name'] or 'Unknown', 'amount': float(s['total'])} for s in staff_coll_today_qs]

        # Today's Donations & Memberships
        td_qs = Income.objects.filter(source='DONATION', date=today)
        today_donations_total = td_qs.aggregate(t=Sum('amount'))['t'] or 0
        today_donations_cash = td_qs.filter(account_type='CASH').aggregate(t=Sum('amount'))['t'] or 0
        today_donations_bank = td_qs.filter(account_type='BANK').aggregate(t=Sum('amount'))['t'] or 0

        tm_qs = Income.objects.filter(source='MEMBERSHIP', date=today)
        today_memberships_total = tm_qs.aggregate(t=Sum('amount'))['t'] or 0
        today_memberships_cash = tm_qs.filter(account_type='CASH').aggregate(t=Sum('amount'))['t'] or 0
        today_memberships_bank = tm_qs.filter(account_type='BANK').aggregate(t=Sum('amount'))['t'] or 0

        return Response({
            'cash_balance': float(cash_bal),
            'bank_balance': float(bank_bal),
            'total_balance': float(cash_bal + bank_bal),
            'income_this_month': float(income_month),
            'expenses_this_month': float(expense_month),
            'net_this_month': float(income_month - expense_month),
            'pending_money_requests': pending_requests,
            'pending_salaries': pending_salaries,
            'cashier_pending': cashier_pending,
            'today_income': float(today_income),
            'today_expense': float(today_expense),
            'monthly_trend': monthly_trend,
            'staff_collections': staff_collections,
            'staff_collections_today': staff_collections_today,
            'today_donations_total': float(today_donations_total),
            'today_donations_cash': float(today_donations_cash),
            'today_donations_bank': float(today_donations_bank),
            'today_memberships_total': float(today_memberships_total),
            'today_memberships_cash': float(today_memberships_cash),
            'today_memberships_bank': float(today_memberships_bank),
            'cash_accounts': CashAccountSerializer(CashAccount.objects.filter(is_active=True), many=True).data,
            'bank_accounts': BankAccountSerializer(BankAccount.objects.filter(is_active=True), many=True).data,
        })


# ── Cash ──────────────────────────────────────────────────────────

class CashAccountListView(generics.ListCreateAPIView):
    permission_classes = [IsAccountant]
    serializer_class = CashAccountSerializer
    queryset = CashAccount.objects.all()


class CashTransactionListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAccountant]
    serializer_class = CashTransactionSerializer
    filterset_fields = ['transaction_type', 'date', 'cash_account']
    search_fields = ['description', 'reference_id', 'voucher_number']
    ordering_fields = ['date', 'created_at']

    def get_queryset(self):
        return CashTransaction.objects.select_related('cash_account', 'created_by').all()

    def perform_create(self, serializer):
        cash_account = serializer.validated_data['cash_account']
        amount = serializer.validated_data['amount']
        txn_type = serializer.validated_data['transaction_type']

        if txn_type in ['RECEIPT', 'TRANSFER_IN', 'OPENING']:
            new_balance = cash_account.current_balance + amount
        else:
            new_balance = cash_account.current_balance - amount

        txn = serializer.save(created_by=self.request.user, balance_after=new_balance)
        cash_account.current_balance = new_balance
        cash_account.save(update_fields=['current_balance'])
        push_dashboard_refresh(['MANAGER', 'ACCOUNTANT', 'CASHIER'])


# ── Bank ──────────────────────────────────────────────────────────

class BankAccountListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAccountant]
    serializer_class = BankAccountSerializer
    queryset = BankAccount.objects.all()


class BankAccountDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAccountant]
    serializer_class = BankAccountSerializer
    queryset = BankAccount.objects.all()


class BankTransactionListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAccountant]
    serializer_class = BankTransactionSerializer
    filterset_fields = ['transaction_type', 'date', 'bank_account', 'payment_method']
    search_fields = ['description', 'reference_id', 'utr_number']
    ordering_fields = ['date', 'created_at']

    def get_queryset(self):
        return BankTransaction.objects.select_related('bank_account', 'created_by').all()

    def perform_create(self, serializer):
        bank_account = serializer.validated_data['bank_account']
        amount = serializer.validated_data['amount']
        txn_type = serializer.validated_data['transaction_type']

        if txn_type in ['DEPOSIT', 'TRANSFER_IN', 'INTEREST']:
            new_balance = bank_account.current_balance + amount
        else:
            new_balance = bank_account.current_balance - amount

        serializer.save(created_by=self.request.user, balance_after=new_balance)
        bank_account.current_balance = new_balance
        bank_account.save(update_fields=['current_balance'])


# ── Income ────────────────────────────────────────────────────────

class IncomeListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAnyStaff]
    serializer_class = IncomeSerializer
    filterset_fields = ['source', 'payment_method', 'account_type', 'date', 'created_by']
    search_fields = ['receipt_number', 'donor_name', 'purpose', 'reference_number']
    ordering_fields = ['date', 'amount']
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        qs = Income.objects.select_related('created_by').all()
        if self.request.user.role == Role.STAFF:
            qs = qs.filter(created_by=self.request.user)
        return qs

    def create(self, request, *args, **kwargs):
        print("INCOMING INCOME POST")
        print("DATA:", request.data)
        print("FILES:", request.FILES)
        from rest_framework import status
        from rest_framework.response import Response
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            print("INCOME VALIDATION ERRORS:", serializer.errors)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_create(self, serializer):
        from hr_module.models import PromoterRegistryEntry
        from datetime import date, timedelta
        
        staff_id = self.request.data.get('staff_id')
        if staff_id and self.request.user.role in [Role.ADMIN, Role.DATA_ENTRY, Role.ACCOUNTANT]:
            from core.models import User
            try:
                user = User.objects.get(id=staff_id)
                creator = user
            except User.DoesNotExist:
                creator = self.request.user
        else:
            creator = self.request.user

        # Auto-rollover if today's registry is already closed
        effective_date = date.today()
        registry = PromoterRegistryEntry.objects.filter(promoter=creator, date=effective_date).first()
        if registry and registry.is_closed:
            effective_date = effective_date + timedelta(days=1)

        income = serializer.save(created_by=creator, date=effective_date)
            
        # --- Auto-Increment Voucher atomically ---
        from hr_module.models import StaffVoucherBook
        vb = StaffVoucherBook.objects.filter(staff=creator).first()
        if vb and vb.book_number > 0 and str(vb.current_voucher) == str(income.reference_number):
            try:
                vb.increment()
            except ValueError:
                pass
        # -----------------------------------------

        _sync_promoter_registry(income.created_by, income.date)
        
        # Auto-update account balance
        if income.account_type == 'CASH' and income.cash_account:
            acc = income.cash_account
            new_bal = acc.current_balance + income.amount
            CashTransaction.objects.create(
                cash_account=acc, transaction_type='RECEIPT',
                date=income.date, description=f"Income: {income.source} — {income.donor_name}",
                reference_id=income.receipt_number, amount=income.amount,
                balance_after=new_bal, created_by=self.request.user
            )
            acc.current_balance = new_bal
            acc.save(update_fields=['current_balance'])
        # Trigger WhatsApp e-receipt dispatch from central Trust number if donor_phone is provided
        if income.donor_phone:
            import threading
            def dispatch_whatsapp():
                try:
                    from accounts_module.donation_image_generator import generate_donation_receipt_image_bytes
                    from django.core.files.storage import default_storage
                    from django.core.files.base import ContentFile
                    
                    # Generate Image
                    img_bytes = generate_donation_receipt_image_bytes(income)
                    
                    # Format Date and Receipt number for file name
                    safe_date = income.date.strftime('%Y-%m-%d')
                    safe_rcp = income.receipt_number.replace('/', '-') if income.receipt_number else f"INC-{income.id}"
                    img_file_path = f"donation_receipts/SLCT_Donation_Receipt_{safe_rcp}_{safe_date}.png"
                    
                    if default_storage.exists(img_file_path):
                        default_storage.delete(img_file_path)
                    saved_path = default_storage.save(img_file_path, ContentFile(img_bytes))

                    # Build Image URL and Receipt URL
                    # Since we are in a background thread, we must safely extract absolute URI from request
                    host = self.request.get_host()
                    scheme = self.request.scheme
                    
                    img_url = default_storage.url(saved_path)
                    if img_url.startswith('/'):
                        img_url = f"{scheme}://{host}{img_url}"
                    receipt_url = f"{scheme}://{host}/api/accounts/income/{income.id}/receipt/"
                    
                    res = send_whatsapp_receipt(
                        to_phone=income.donor_phone,
                        donor_name=income.donor_name,
                        receipt_number=income.reference_number or income.receipt_number,
                        amount=float(income.amount),
                        source=income.source,
                        date_str=income.date.strftime('%d %b %Y'),
                        pdf_url=receipt_url,
                        image_url=img_url
                    )
                    if res.get('success'):
                        income.whatsapp_status = 'SENT'
                    else:
                        income.whatsapp_status = 'FAILED'
                    income.save(update_fields=['whatsapp_status'])
                except Exception as e:
                    import logging
                    logging.error(f"WhatsApp dispatch failed for donation: {e}")
                    income.whatsapp_status = 'FAILED'
                    income.save(update_fields=['whatsapp_status'])

            threading.Thread(target=dispatch_whatsapp).start()

        push_dashboard_refresh(['ACCOUNTANT', 'MANAGER', 'ADMIN', 'STAFF'])

class IncomeDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAnyStaff, IsOwnerOrManager]
    serializer_class = IncomeSerializer
    queryset = Income.objects.all()
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def perform_update(self, serializer):
        income = serializer.save()
        _sync_promoter_registry(income.created_by, income.date)
        push_dashboard_refresh(['ACCOUNTANT', 'MANAGER', 'ADMIN', 'STAFF'])

    def perform_destroy(self, instance):
        user = instance.created_by
        date = instance.date
        instance.delete()
        _sync_promoter_registry(user, date)
        push_dashboard_refresh(['ACCOUNTANT', 'MANAGER', 'ADMIN', 'STAFF'])


class IncomeReceiptView(APIView):
    """Publicly viewable e-receipt page for donors/members."""
    permission_classes = []

    def get(self, request, pk):
        try:
            income = Income.objects.get(pk=pk)
        except Income.DoesNotExist:
            return Response({'error': 'Receipt not found'}, status=404)

        html_content = generate_receipt_html(income)
        return HttpResponse(html_content, content_type='text/html')

class RetryWhatsAppDonationView(APIView):
    """Retries WhatsApp dispatch for a Donation if status was FAILED."""
    permission_classes = [IsAnyStaff]

    def post(self, request, pk):
        try:
            income = Income.objects.get(pk=pk)
        except Income.DoesNotExist:
            return Response({'error': 'Receipt not found'}, status=404)

        if not income.donor_phone:
            return Response({'error': 'Donor phone number missing'}, status=400)

        from accounts_module.donation_image_generator import generate_donation_receipt_image_bytes
        import os
        from django.conf import settings
        from notify.whatsapp_service import send_whatsapp_receipt

        safe_date = income.date.strftime('%Y-%m-%d')
        safe_rcp = income.receipt_number.replace('/', '-') if income.receipt_number else f"INC-{income.id}"
        img_file_path = f"donation_receipts/SLCT_Donation_Receipt_{safe_rcp}_{safe_date}.png"

        from django.core.files.storage import default_storage
        from django.core.files.base import ContentFile

        if not default_storage.exists(img_file_path):
            img_bytes = generate_donation_receipt_image_bytes(income)
            default_storage.save(img_file_path, ContentFile(img_bytes))

        img_url = default_storage.url(img_file_path)
        if img_url.startswith('/'):
            img_url = request.build_absolute_uri(img_url)
        receipt_url = request.build_absolute_uri(f"/api/accounts/income/{income.id}/receipt/")

        res = send_whatsapp_receipt(
            to_phone=income.donor_phone,
            donor_name=income.donor_name,
            receipt_number=income.reference_number or income.receipt_number,
            amount=float(income.amount),
            source=income.source,
            date_str=income.date.strftime('%d %b %Y'),
            pdf_url=receipt_url,
            image_url=img_url
        )

        if res.get('success'):
            income.whatsapp_status = 'SENT'
            income.save(update_fields=['whatsapp_status'])
            return Response({'message': 'WhatsApp receipt sent successfully'})
        else:
            income.whatsapp_status = 'FAILED'
            income.save(update_fields=['whatsapp_status'])
            return Response({'error': 'Failed to send WhatsApp message', 'details': res.get('error')}, status=500)


# ── Expenses ──────────────────────────────────────────────────────

class ExpenseListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAnyStaff]
    serializer_class = ExpenseSerializer
    queryset = Expense.objects.select_related('created_by').all()
    filterset_fields = ['category', 'payment_method', 'account_type', 'status', 'date']
    search_fields = ['expense_id', 'payee', 'purpose']
    ordering_fields = ['date', 'amount']
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def perform_create(self, serializer):
        expense = serializer.save(created_by=self.request.user)
        Transaction.objects.create(
            date=expense.date, transaction_type='EXPENSE', category=expense.category,
            description=f"Expense: {expense.payee} — {expense.purpose}",
            account_type=expense.account_type, debit=expense.amount,
            payment_method=expense.payment_method, reference_id=expense.expense_id,
            created_by=self.request.user
        )


class ExpenseDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAccountant]
    serializer_class = ExpenseSerializer
    queryset = Expense.objects.all()
    parser_classes = [MultiPartParser, FormParser, JSONParser]


# ── Cheques ───────────────────────────────────────────────────────

class ChequeListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAccountant]
    serializer_class = ChequeSerializer
    queryset = Cheque.objects.select_related('bank_account', 'created_by').all()
    filterset_fields = ['cheque_type', 'status', 'bank_account']
    search_fields = ['cheque_number', 'payee_payer', 'purpose']
    ordering_fields = ['date', 'amount']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class ChequeDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAccountant]
    serializer_class = ChequeSerializer
    queryset = Cheque.objects.all()


# ── Transfers ─────────────────────────────────────────────────────

class TransferListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAccountant]
    serializer_class = TransferSerializer
    queryset = Transfer.objects.all()
    filterset_fields = ['transfer_type', 'date']
    ordering_fields = ['date', 'amount']

    def perform_create(self, serializer):
        transfer = serializer.save(created_by=self.request.user)
        # Update balances
        amount = transfer.amount
        if transfer.transfer_type == 'CASH_TO_BANK':
            if transfer.from_cash:
                transfer.from_cash.current_balance -= amount
                transfer.from_cash.save(update_fields=['current_balance'])
            if transfer.to_bank:
                transfer.to_bank.current_balance += amount
                transfer.to_bank.save(update_fields=['current_balance'])
        elif transfer.transfer_type == 'BANK_TO_CASH':
            if transfer.from_bank:
                transfer.from_bank.current_balance -= amount
                transfer.from_bank.save(update_fields=['current_balance'])
            if transfer.to_cash:
                transfer.to_cash.current_balance += amount
                transfer.to_cash.save(update_fields=['current_balance'])
        elif transfer.transfer_type == 'BANK_TO_BANK':
            if transfer.from_bank:
                transfer.from_bank.current_balance -= amount
                transfer.from_bank.save(update_fields=['current_balance'])
            if transfer.to_bank:
                transfer.to_bank.current_balance += amount
                transfer.to_bank.save(update_fields=['current_balance'])
        AuditLog.objects.create(
            user=self.request.user, action='CREATE_TRANSFER', module='ACCOUNTS',
            record_type='Transfer', record_id=str(transfer.id),
            reference_number=transfer.transfer_id,
            description=f"Transfer {transfer.transfer_id}: ₹{amount}",
            ip_address=None
        )


# ── Transactions ──────────────────────────────────────────────────

class TransactionListView(generics.ListAPIView):
    permission_classes = [IsAccountant]
    serializer_class = TransactionSerializer
    queryset = Transaction.objects.select_related('created_by').all()
    filterset_fields = ['transaction_type', 'account_type', 'payment_method', 'status']
    search_fields = ['transaction_id', 'reference_id', 'description']
    ordering_fields = ['date', 'created_at', 'debit', 'credit']


class TransactionDetailView(generics.RetrieveAPIView):
    permission_classes = [IsAccountant]
    serializer_class = TransactionSerializer
    queryset = Transaction.objects.all()


# ── Money Request Processing (Accountant side) ────────────────────

class MoneyRequestListView(APIView):
    """Accountant view of all pending money requests."""
    permission_classes = [IsAccountant]

    def get(self, request):
        from manager_module.models import AssessmentRequest
        from manager_module.serializers import AssessmentRequestListSerializer
        requests = AssessmentRequest.objects.filter(
            status__in=['SUBMITTED', 'UNDER_REVIEW', 'ON_HOLD']
        ).select_related('requested_by').order_by('-created_at')
        return Response(AssessmentRequestListSerializer(requests, many=True).data)


# ── Bank Reconciliation ───────────────────────────────────────────

class BankReconciliationView(APIView):
    permission_classes = [IsAccountant]

    def get(self, request):
        bank_id = request.query_params.get('bank_id')
        from_date = request.query_params.get('from_date')
        to_date = request.query_params.get('to_date')

        try:
            bank = BankAccount.objects.get(id=bank_id)
        except BankAccount.DoesNotExist:
            return Response({'error': 'Bank account not found.'}, status=404)

        txns = BankTransaction.objects.filter(bank_account=bank)
        if from_date:
            txns = txns.filter(date__gte=from_date)
        if to_date:
            txns = txns.filter(date__lte=to_date)

        total_deposits = txns.filter(transaction_type__in=['DEPOSIT', 'TRANSFER_IN', 'INTEREST']).aggregate(
            t=Sum('amount'))['t'] or 0
        total_withdrawals = txns.filter(transaction_type__in=['WITHDRAWAL', 'TRANSFER_OUT', 'CHARGES']).aggregate(
            t=Sum('amount'))['t'] or 0

        return Response({
            'bank_name': bank.bank_name,
            'account_number': bank.account_number,
            'system_balance': float(bank.current_balance),
            'total_deposits': float(total_deposits),
            'total_withdrawals': float(total_withdrawals),
            'transactions': BankTransactionSerializer(txns, many=True).data,
        })


# ── Pending Salaries (Accountant side) ────────────────────────────

class PendingPayrollListView(generics.ListAPIView):
    """Accountant view of all approved payrolls waiting to be paid."""
    permission_classes = [IsAccountant]
    filterset_fields = ['status', 'month', 'year']
    search_fields = ['employee__full_name', 'payroll_id']

    def get_serializer_class(self):
        from hr_module.serializers import MonthlyPayrollSerializer
        return MonthlyPayrollSerializer

    def get_queryset(self):
        from hr_module.models import MonthlyPayroll
        return MonthlyPayroll.objects.filter(
            status__in=['APPROVED', 'PAID']
        ).select_related('employee').order_by('-created_at')


class ProcessPaymentView(APIView):
    """Mark payroll as PAID and create Accounts transaction."""
    permission_classes = [IsAccountant]

    def post(self, request, pk):
        from hr_module.models import MonthlyPayroll
        try:
            payroll = MonthlyPayroll.objects.get(pk=pk, status='APPROVED')
        except MonthlyPayroll.DoesNotExist:
            return Response({'error': 'Payroll not found or not approved.'}, status=404)

        payroll.status = 'PAID'
        payroll.payment_method = request.data.get('payment_method', 'BANK')
        payroll.payment_date = timezone.now().date()
        payroll.payment_reference = request.data.get('payment_reference', '')
        payroll.save()

        # Create Accounts Transaction
        Transaction.objects.create(
            date=payroll.payment_date, transaction_type='SALARY',
            category='SALARY',
            description=f"Salary: {payroll.employee.full_name} — {payroll.month}/{payroll.year}",
            account_type='BANK' if payroll.payment_method == 'BANK' else 'CASH',
            debit=payroll.net_salary,
            payment_method=payroll.payment_method,
            reference_id=payroll.payroll_id,
            created_by=request.user,
        )
        Expense.objects.create(
            date=payroll.payment_date, payee=payroll.employee.full_name,
            category='SALARY', amount=payroll.net_salary,
            payment_method=payroll.payment_method, purpose=f"Salary {payroll.month}/{payroll.year}",
            account_type='BANK' if payroll.payment_method == 'BANK' else 'CASH',
            status='COMPLETED', created_by=request.user,
        )

        AuditLog.objects.create(
            user=request.user, action='PAY_SALARY', module='ACCOUNTS',
            record_type='MonthlyPayroll', record_id=str(payroll.id),
            reference_number=payroll.payroll_id,
            description=f"Salary paid to {payroll.employee.full_name}: ₹{payroll.net_salary}",
            ip_address=getattr(request, 'audit_ip', None)
        )

        return Response({'message': 'Salary paid successfully.', 'payroll_id': payroll.payroll_id})

# ── Total Funds (for Programs Check) ──────────────────────────────

class TotalFundsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        cash_bal = sum(a.current_balance for a in CashAccount.objects.filter(is_active=True))
        bank_bal = sum(b.current_balance for b in BankAccount.objects.filter(is_active=True))
        return Response({'total': cash_bal + bank_bal})


# ── Day Sheet ─────────────────────────────────────────────────────

class DaySheetView(APIView):
    """
    Returns a structured Day Sheet for a given date.

    DEBIT side  = Opening balances (OB CASH, OB BANK) + income collected that day
    CREDIT side = Expenses paid that day + disbursements
    Bottom section: physical cash/bank closing entered manually (from CashClosing model)
    """
    permission_classes = [IsFinanceOrDataEntry]

    def get(self, request):
        from datetime import date as dt_date
        from django.db.models import Sum, Q

        date_str = request.query_params.get('date')
        try:
            if date_str:
                from datetime import datetime
                target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            else:
                target_date = timezone.now().date()
        except ValueError:
            target_date = timezone.now().date()

        # ── Opening Balances (previous day closing balances via CashTransaction OPENING)
        # We use current balances minus today's activity to infer OB
        cash_accounts = list(CashAccount.objects.filter(is_active=True))
        bank_accounts = list(BankAccount.objects.filter(is_active=True))

        # Cash receipts and payments today
        today_cash_receipts = CashTransaction.objects.filter(
            date=target_date, transaction_type__in=['RECEIPT', 'TRANSFER_IN', 'OPENING']
        ).aggregate(t=Sum('amount'))['t'] or 0
        today_cash_payments = CashTransaction.objects.filter(
            date=target_date, transaction_type__in=['PAYMENT', 'TRANSFER_OUT', 'ADJUSTMENT']
        ).aggregate(t=Sum('amount'))['t'] or 0

        current_cash = sum(a.current_balance for a in cash_accounts)
        current_bank = sum(b.current_balance for b in bank_accounts)

        # Opening balance = current balance - today's net movement
        ob_cash = float(current_cash) - float(today_cash_receipts) + float(today_cash_payments)
        ob_bank = float(current_bank)  # Bank OB approximated as current (for display)

        # ── Income entries for the day (these go on DEBIT side after OB)
        incomes = Income.objects.filter(date=target_date).order_by('created_at')
        income_rows = []
        for inc in incomes:
            income_rows.append({
                'particular': (inc.donor_name or inc.source or '').upper(),
                'amount': float(inc.amount),
                'sc': 'BANK' if inc.account_type == 'BANK' else 'CASH',
                'source': inc.source,
                'id': str(inc.id),
            })

        # ── Expense entries for the day (CREDIT side)
        expenses = Expense.objects.filter(date=target_date).order_by('created_at')
        expense_rows = []
        for exp in expenses:
            expense_rows.append({
                'particular': (exp.payee or exp.purpose or '').upper(),
                'amount': float(exp.amount),
                'sc': 'BANK' if exp.account_type == 'BANK' else 'CASH',
                'category': exp.category,
                'id': str(exp.id),
            })

        # ── Totals
        debit_rows = [
            {'particular': 'OB CASH', 'amount': round(ob_cash, 2), 'sc': 'CASH'},
            {'particular': 'OB BANK', 'amount': round(ob_bank, 2), 'sc': 'BANK'},
        ] + income_rows

        credit_rows = expense_rows

        # ── Cash Closing (physical closing entered by cashier)
        from cashier_module.models import CashClosing
        closing = CashClosing.objects.filter(date=target_date).first()

        if closing:
            if closing.debit_rows:
                debit_rows = closing.debit_rows
            if closing.credit_rows:
                credit_rows = closing.credit_rows

        total_debit = sum(float(r.get('amount') or 0) for r in debit_rows)
        total_credit = sum(float(r.get('amount') or 0) for r in credit_rows)
        difference = total_debit - total_credit

        physical_cash = float(closing.physical_cash) if closing else 0.0
        physical_bank = float(closing.physical_bank) if closing else 0.0
        reading_total = physical_cash + physical_bank

        # Reading/Sheet Closing = Debit Total - Credit Total (net funds remaining)
        sheet_closing = round(total_debit - total_credit, 2)
        closing_diff = round((physical_cash + physical_bank) - sheet_closing, 2)

        return Response({
            'date': target_date.strftime('%d-%m-%Y'),
            'debit_rows': debit_rows,
            'credit_rows': credit_rows,
            'total_debit': round(total_debit, 2),
            'total_credit': round(total_credit, 2),
            'difference': round(difference, 2),
            'physical_cash': physical_cash,
            'physical_bank': physical_bank,
            'reading_total': round(reading_total, 2),
            'sheet_closing': sheet_closing,
            'closing_diff': closing_diff,
            'has_closing': closing is not None,
        })

