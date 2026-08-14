"""Accounts Module Views"""
from django.db.models import Sum, Q
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from core.permissions import IsAccountant, IsManagerOrAccountant, IsAccountantOrCashier, IsAnyStaff, IsOwnerOrManager
from core.models import AuditLog, Role
from notify.service import push_dashboard_refresh
from accounts_module.models import (CashAccount, CashTransaction, BankAccount, BankTransaction,
                                     Income, Expense, Cheque, Transfer, Transaction)
from accounts_module.serializers import (CashAccountSerializer, CashTransactionSerializer,
                                          BankAccountSerializer, BankTransactionSerializer,
                                          IncomeSerializer, ExpenseSerializer, ChequeSerializer,
                                          TransferSerializer, TransactionSerializer)


# ── Dashboard ─────────────────────────────────────────────────────

class AccountsDashboardView(APIView):
    permission_classes = [IsAccountant]

    def get(self, request):
        from manager_module.models import AssessmentRequest, RequestStatus

        cash_bal = sum(a.current_balance for a in CashAccount.objects.filter(is_active=True))
        bank_bal = sum(b.current_balance for b in BankAccount.objects.filter(is_active=True))
        today = timezone.now().date()
        month_start = today.replace(day=1)

        income_month = Income.objects.filter(date__gte=month_start).aggregate(t=Sum('amount'))['t'] or 0
        expense_month = Expense.objects.filter(date__gte=month_start).aggregate(t=Sum('amount'))['t'] or 0
        pending_requests = AssessmentRequest.objects.filter(
            status__in=['SUBMITTED', 'UNDER_REVIEW']
        ).count()

        today_income = Income.objects.filter(date=today).aggregate(t=Sum('amount'))['t'] or 0
        today_expense = Expense.objects.filter(date=today).aggregate(t=Sum('amount'))['t'] or 0

        return Response({
            'cash_balance': float(cash_bal),
            'bank_balance': float(bank_bal),
            'total_balance': float(cash_bal + bank_bal),
            'income_this_month': float(income_month),
            'expenses_this_month': float(expense_month),
            'net_this_month': float(income_month - expense_month),
            'pending_money_requests': pending_requests,
            'today_income': float(today_income),
            'today_expense': float(today_expense),
            'cash_accounts': CashAccountSerializer(CashAccount.objects.filter(is_active=True), many=True).data,
            'bank_accounts': BankAccountSerializer(BankAccount.objects.filter(is_active=True), many=True).data,
        })


# ── Cash ──────────────────────────────────────────────────────────

class CashAccountListView(generics.ListCreateAPIView):
    permission_classes = [IsAccountantOrCashier]
    serializer_class = CashAccountSerializer
    queryset = CashAccount.objects.all()


class CashTransactionListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAccountantOrCashier]
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
    filterset_fields = ['source', 'payment_method', 'account_type']
    search_fields = ['receipt_number', 'donor_name', 'purpose', 'reference_number']
    ordering_fields = ['date', 'amount']
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        qs = Income.objects.select_related('created_by').all()
        if self.request.user.role == Role.STAFF:
            qs = qs.filter(created_by=self.request.user)
        return qs

    def perform_create(self, serializer):
        income = serializer.save(created_by=self.request.user)
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
        # Create central transaction record
        Transaction.objects.create(
            date=income.date, transaction_type='INCOME', category=income.source,
            description=f"Income: {income.donor_name or income.source}",
            account_type=income.account_type, credit=income.amount,
            payment_method=income.payment_method, reference_id=income.receipt_number,
            created_by=self.request.user
        )
        push_dashboard_refresh(['ACCOUNTANT', 'MANAGER', 'ADMIN', 'STAFF'])

class IncomeDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAnyStaff, IsOwnerOrManager]
    serializer_class = IncomeSerializer
    queryset = Income.objects.all()
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def perform_update(self, serializer):
        serializer.save()
        push_dashboard_refresh(['ACCOUNTANT', 'MANAGER', 'ADMIN', 'STAFF'])

    def perform_destroy(self, instance):
        instance.delete()
        push_dashboard_refresh(['ACCOUNTANT', 'MANAGER', 'ADMIN', 'STAFF'])


# ── Expenses ──────────────────────────────────────────────────────

class ExpenseListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAccountant]
    serializer_class = ExpenseSerializer
    queryset = Expense.objects.select_related('created_by').all()
    filterset_fields = ['category', 'payment_method', 'account_type', 'status']
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
    permission_classes = [IsAccountantOrCashier]
    serializer_class = TransactionSerializer
    queryset = Transaction.objects.select_related('created_by').all()
    filterset_fields = ['transaction_type', 'account_type', 'payment_method', 'status']
    search_fields = ['transaction_id', 'reference_id', 'description']
    ordering_fields = ['date', 'created_at', 'debit', 'credit']


class TransactionDetailView(generics.RetrieveAPIView):
    permission_classes = [IsAccountantOrCashier]
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
