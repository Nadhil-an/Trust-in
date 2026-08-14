"""Cashier Module Serializers, Views and URLs"""
from rest_framework import serializers, generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.utils import timezone
from django.db.models import Sum

from core.permissions import IsCashier, IsAccountantOrCashier, IsAnyStaff
from core.models import AuditLog
from notify.service import push_to_role, push_request_update, push_dashboard_refresh
from cashier_module.models import Disbursement, CashClosing, CashHandover
from manager_module.models import AssessmentRequest, RequestStatus, RequestStatusHistory
from accounts_module.models import CashAccount, CashTransaction, Transaction


# ── Serializers ───────────────────────────────────────────────────

class DisbursementSerializer(serializers.ModelSerializer):
    request_number = serializers.SerializerMethodField()
    request_purpose = serializers.SerializerMethodField()

    class Meta:
        model = Disbursement
        fields = '__all__'
        read_only_fields = ['id', 'disbursement_id', 'disbursed_by', 'created_at']

    def get_request_number(self, obj):
        return obj.request.request_number if obj.request else ''

    def get_request_purpose(self, obj):
        return obj.request.purpose if obj.request else ''


class CashClosingSerializer(serializers.ModelSerializer):
    difference = serializers.SerializerMethodField()

    class Meta:
        model = CashClosing
        fields = '__all__'
        read_only_fields = ['id', 'closed_by', 'created_at']

    def get_difference(self, obj):
        return float(obj.system_balance - obj.physical_cash)


class CashHandoverSerializer(serializers.ModelSerializer):
    from_name = serializers.SerializerMethodField()
    to_name = serializers.SerializerMethodField()

    class Meta:
        model = CashHandover
        fields = '__all__'
        read_only_fields = ['id', 'handover_id', 'created_at']

    def get_from_name(self, obj):
        return obj.from_cashier.full_name if obj.from_cashier else ''

    def get_to_name(self, obj):
        return obj.to_person.full_name if obj.to_person else ''


# ── Views ─────────────────────────────────────────────────────────

class CashierDashboardView(APIView):
    permission_classes = [IsCashier]

    def get(self, request):
        today = timezone.now().date()
        cash_bal = sum(a.current_balance for a in CashAccount.objects.filter(is_active=True))
        pending = AssessmentRequest.objects.filter(status=RequestStatus.CASHIER_PENDING).count()
        today_payments = CashTransaction.objects.filter(
            date=today, transaction_type='PAYMENT').aggregate(t=Sum('amount'))['t'] or 0
        today_receipts = CashTransaction.objects.filter(
            date=today, transaction_type='RECEIPT').aggregate(t=Sum('amount'))['t'] or 0
        completed_today = Disbursement.objects.filter(date=today).count()

        recent_disbursements = Disbursement.objects.select_related('request', 'disbursed_by').order_by('-created_at')[:10]

        return Response({
            'available_cash': float(cash_bal),
            'pending_requests': pending,
            'today_payments': float(today_payments),
            'today_receipts': float(today_receipts),
            'completed_today': completed_today,
            'recent_disbursements': DisbursementSerializer(recent_disbursements, many=True).data,
        })


class PendingDisbursementsView(APIView):
    """Returns all Accountant-approved requests waiting for cashier."""
    permission_classes = [IsCashier]

    def get(self, request):
        from manager_module.serializers import AssessmentRequestSerializer
        pending = AssessmentRequest.objects.filter(
            status=RequestStatus.CASHIER_PENDING
        ).select_related('requested_by', 'reviewed_by').order_by('-approved_at')
        return Response(AssessmentRequestSerializer(pending, many=True).data)


class DisburseMoneyView(APIView):
    """Cashier disburses approved request — creates disbursement record + updates all linked tables."""
    permission_classes = [IsCashier]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request, pk):
        try:
            req = AssessmentRequest.objects.get(pk=pk, status=RequestStatus.CASHIER_PENDING)
        except AssessmentRequest.DoesNotExist:
            return Response({'error': 'Request not found or not in Cashier Pending status.'}, status=404)

        amount = request.data.get('amount_disbursed', req.amount_approved or req.amount_requested)
        amount = float(amount)

        # Check cash availability
        cash_accounts = CashAccount.objects.filter(is_active=True)
        total_cash = sum(float(a.current_balance) for a in cash_accounts)
        if total_cash < amount:
            return Response({'error': f'Insufficient cash. Available: ₹{total_cash:.2f}'}, status=400)

        main_cash = cash_accounts.first()
        new_balance = float(main_cash.current_balance) - amount

        # Create Disbursement record
        disbursement = Disbursement.objects.create(
            request=req,
            amount_disbursed=amount,
            payment_method=request.data.get('payment_method', 'CASH'),
            voucher_number=request.data.get('voucher_number', ''),
            receiver_name=request.data.get('receiver_name', req.beneficiary_name or req.requested_by.full_name),
            reference=request.data.get('reference', ''),
            remarks=request.data.get('remarks', ''),
            disbursed_by=request.user,
            date=timezone.now().date(),
        )

        # Update cash account balance
        CashTransaction.objects.create(
            cash_account=main_cash,
            transaction_type='PAYMENT',
            date=timezone.now().date(),
            description=f"Disbursement: {req.request_number} — {req.purpose}",
            reference_id=req.request_number,
            amount=amount,
            balance_after=new_balance,
            created_by=request.user,
            voucher_number=disbursement.voucher_number,
        )
        main_cash.current_balance = new_balance
        main_cash.save(update_fields=['current_balance'])

        # Create central Transaction record
        Transaction.objects.create(
            date=timezone.now().date(),
            transaction_type='DISBURSEMENT',
            category=req.category,
            description=f"Disbursement: {req.request_number} — {req.purpose}",
            account_type='CASH',
            debit=amount,
            payment_method='CASH',
            reference_id=req.request_number,
            created_by=request.user,
        )

        # Create Expense record
        from accounts_module.models import Expense
        Expense.objects.create(
            date=timezone.now().date(),
            payee=req.beneficiary_name or req.requested_by.full_name,
            category=req.category,
            amount=amount,
            payment_method='CASH',
            purpose=req.purpose,
            account_type='CASH',
            cash_account=main_cash,
            reference_request=req,
            status='COMPLETED',
            created_by=request.user,
        )

        # Update request status → COMPLETED
        old_status = req.status
        req.status = RequestStatus.COMPLETED
        req.disbursed_by = request.user
        req.disbursed_at = timezone.now()
        req.completed_at = timezone.now()
        req.amount_disbursed = amount
        req.cashier_remarks = request.data.get('remarks', '')
        req.save()

        RequestStatusHistory.objects.create(
            request=req, from_status=old_status, to_status=req.status,
            changed_by=request.user, remarks=f"Disbursed ₹{amount}"
        )

        AuditLog.objects.create(
            user=request.user, action='DISBURSE_MONEY', module='CASHIER',
            record_type='AssessmentRequest', record_id=str(req.id),
            reference_number=req.request_number, previous_status=old_status,
            new_status=req.status,
            description=f"₹{amount} disbursed for {req.request_number} — {req.purpose}",
            ip_address=getattr(request, 'audit_ip', None)
        )

        # Notify
        push_to_role('MANAGER', f'Money Disbursed: {req.request_number}',
                     f'₹{amount:,.2f} disbursed by {request.user.full_name}',
                     'MONEY_DISBURSED', req.request_number)
        push_to_role('ACCOUNTANT', f'Request Completed: {req.request_number}',
                     f'₹{amount:,.2f} disbursed', 'MONEY_DISBURSED', req.request_number)
        push_request_update(str(req.id), req.request_number, req.status, 'CASHIER',
                            ['MANAGER', 'ACCOUNTANT', 'CASHIER', 'ADMIN'])
        push_dashboard_refresh(['MANAGER', 'ACCOUNTANT', 'CASHIER', 'ADMIN'])

        return Response({
            'message': 'Disbursement completed successfully.',
            'disbursement_id': disbursement.disbursement_id,
            'amount_disbursed': amount,
            'new_cash_balance': new_balance,
            'request_status': req.status,
        })


class DisbursementListView(generics.ListAPIView):
    permission_classes = [IsAccountantOrCashier]
    serializer_class = DisbursementSerializer
    queryset = Disbursement.objects.select_related('request', 'disbursed_by').all()
    filterset_fields = ['payment_method', 'date']
    search_fields = ['disbursement_id', 'request__request_number', 'receiver_name']
    ordering_fields = ['date', 'amount_disbursed']


class CashClosingListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsCashier]
    serializer_class = CashClosingSerializer
    queryset = CashClosing.objects.select_related('closed_by').all()
    ordering_fields = ['date']

    def perform_create(self, serializer):
        system_bal = sum(a.current_balance for a in CashAccount.objects.filter(is_active=True))
        physical = serializer.validated_data['physical_cash']
        diff = float(system_bal) - float(physical)
        serializer.save(
            closed_by=self.request.user,
            system_balance=system_bal,
            difference=diff,
        )


class CashHandoverListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsCashier]
    serializer_class = CashHandoverSerializer
    queryset = CashHandover.objects.select_related('from_cashier', 'to_person').all()

    def perform_create(self, serializer):
        serializer.save(from_cashier=self.request.user)


# ── URLs ──────────────────────────────────────────────────────────
from django.urls import path

urlpatterns = [
    path('dashboard/', CashierDashboardView.as_view()),
    path('pending/', PendingDisbursementsView.as_view()),
    path('disburse/<uuid:pk>/', DisburseMoneyView.as_view()),
    path('disbursements/', DisbursementListView.as_view()),
    path('cash-closing/', CashClosingListCreateView.as_view()),
    path('handover/', CashHandoverListCreateView.as_view()),
]
