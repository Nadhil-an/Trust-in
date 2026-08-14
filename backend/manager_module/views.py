"""Manager Module Views — Assessment Requests, FAO/ACO/GEO Reports, Inventory, Dashboard"""
from django.utils import timezone
from django.db.models import Count, Sum, Q
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from core.permissions import (
    IsManager, IsManagerOrAccountant, IsAnyStaff,
    IsFAO, IsACO, IsGEO, IsMobileStaff, IsMobileUser,
)
from core.models import AuditLog, Role
from notify.service import push_to_role, push_request_update, push_dashboard_refresh
from manager_module.models import (
    AssessmentRequest, RequestStatus, RequestStatusHistory,
    EligibilityStatus,
    FAOReport, FAOPhoto,
    ACOCalculation,
    GEOReport, GEOPhoto,
    CharityInventory,
    MinutesRegistry, Partner,
)
from manager_module.serializers import (
    AssessmentRequestSerializer, AssessmentRequestListSerializer,
    RequestStatusHistorySerializer,
    FAOReportSerializer,
    ACOCalculationSerializer,
    GEOReportSerializer,
    CharityInventorySerializer,
    MinutesSerializer, PartnerSerializer,
)


# ── Dashboard ──────────────────────────────────────────────────────

class ManagerDashboardView(APIView):
    permission_classes = [IsManager]

    def get(self, request):
        from accounts_module.models import CashAccount, BankAccount
        from hr_module.models import Member, Volunteer

        reqs = AssessmentRequest.objects.all()
        cash_bal = sum(a.current_balance for a in CashAccount.objects.filter(is_active=True))
        bank_bal = sum(b.current_balance for b in BankAccount.objects.filter(is_active=True))

        data = {
            'requests': {
                'pending': reqs.filter(status=RequestStatus.SUBMITTED).count(),
                'with_fao': reqs.filter(status=RequestStatus.WITH_FAO).count(),
                'with_aco': reqs.filter(status=RequestStatus.WITH_ACO).count(),
                'with_geo': reqs.filter(status=RequestStatus.WITH_GEO).count(),
                'under_review': reqs.filter(status=RequestStatus.UNDER_REVIEW).count(),
                'approved': reqs.filter(status=RequestStatus.APPROVED).count(),
                'rejected': reqs.filter(status=RequestStatus.REJECTED).count(),
                'on_hold': reqs.filter(status=RequestStatus.ON_HOLD).count(),
                'cashier_pending': reqs.filter(status=RequestStatus.CASHIER_PENDING).count(),
                'completed': reqs.filter(status=RequestStatus.COMPLETED).count(),
                'total': reqs.count(),
            },
            'finance': {
                'cash_balance': float(cash_bal),
                'bank_balance': float(bank_bal),
                'total_balance': float(cash_bal + bank_bal),
            },
            'hr': {
                'members': Member.objects.filter(status='ACTIVE').count(),
                'volunteers': Volunteer.objects.filter(status='ACTIVE').count(),
            },
            'inventory': {
                'total_items': CharityInventory.objects.filter(is_active=True).count(),
                'low_stock': CharityInventory.objects.filter(is_active=True, quantity_available__lte=5).count(),
            },
            'recent_requests': AssessmentRequestListSerializer(
                reqs.select_related('requested_by').order_by('-created_at')[:10], many=True
            ).data,
        }
        return Response(data)


# ── Mobile Role Dashboards ──────────────────────────────────────────

class FAODashboardView(APIView):
    """Dashboard stats for FAO mobile app."""
    permission_classes = [IsFAO]

    def get(self, request):
        qs = AssessmentRequest.objects.filter(status=RequestStatus.WITH_FAO)
        total = qs.count()
        critical = qs.filter(priority='CRITICAL').count()
        urgent = qs.filter(priority='URGENT').count()
        today = AssessmentRequest.objects.filter(
            fao_report__submitted_at__date=timezone.now().date()
        ).count()
        return Response({
            'pending': total,
            'critical': critical,
            'urgent': urgent,
            'reviewed_today': today,
        })


class ACODashboardView(APIView):
    """Dashboard stats for ACO mobile app."""
    permission_classes = [IsACO]

    def get(self, request):
        qs = AssessmentRequest.objects.filter(status=RequestStatus.WITH_ACO)
        total = qs.count()
        today = AssessmentRequest.objects.filter(
            aco_calculation__submitted_at__date=timezone.now().date()
        ).count()
        return Response({
            'pending': total,
            'forwarded_today': today,
        })


class GEODashboardView(APIView):
    """Dashboard stats for GEO mobile app."""
    permission_classes = [IsGEO]

    def get(self, request):
        qs = AssessmentRequest.objects.filter(status=RequestStatus.WITH_GEO)
        total = qs.count()
        today = AssessmentRequest.objects.filter(
            geo_report__submitted_at__date=timezone.now().date()
        ).count()
        return Response({
            'pending': total,
            'forwarded_today': today,
        })


# ── Assessment Requests ────────────────────────────────────────────

class AssessmentRequestListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filterset_fields = ['status', 'category', 'priority', 'eligibility', 'source']
    search_fields = ['request_number', 'purpose', 'beneficiary_name', 'beneficiary_phone']
    ordering_fields = ['created_at', 'amount_requested', 'required_date', 'priority']

    def get_serializer_class(self):
        if self.request.method == 'GET':
            return AssessmentRequestListSerializer
        return AssessmentRequestSerializer

    def get_queryset(self):
        qs = AssessmentRequest.objects.select_related(
            'requested_by', 'reviewed_by', 'disbursed_by'
        )
        # Mobile role filtering: each role sees only their cases
        user = self.request.user
        role = getattr(user, 'role', None)
        if role == Role.FIELD_ASSESSMENT_OFFICER:
            qs = qs.filter(status=RequestStatus.WITH_FAO)
        elif role == Role.ASSESSMENT_CALCULATION_OFFICER:
            qs = qs.filter(status=RequestStatus.WITH_ACO)
        elif role == Role.GENERAL_ENQUIRY_OFFICER:
            qs = qs.filter(status=RequestStatus.WITH_GEO)
        elif role in [Role.STAFF, Role.MEMBER]:
            qs = qs.filter(requested_by=user)
        return qs

    def perform_create(self, serializer):
        req = serializer.save(
            requested_by=self.request.user,
            status=RequestStatus.SUBMITTED,
            submitted_at=timezone.now()
        )
        AuditLog.objects.create(
            user=self.request.user, action='CREATE_ASSESSMENT', module='MANAGER',
            record_type='AssessmentRequest', record_id=str(req.id),
            reference_number=req.request_number, new_status=req.status,
            description=f"Assessment {req.request_number} submitted by {self.request.user.full_name}",
            ip_address=getattr(self.request, 'audit_ip', None)
        )
        RequestStatusHistory.objects.create(
            request=req, from_status='', to_status=req.status,
            changed_by=self.request.user, remarks='Assessment submitted'
        )
        # Notify manager
        push_to_role('MANAGER', f'New Assessment: {req.request_number}',
                     f'{req.beneficiary_name} — {req.category}', 'ASSESSMENT_SUBMITTED',
                     req.request_number)
        push_dashboard_refresh(['MANAGER', 'ADMIN', 'STAFF'])


from core.permissions import IsOwnerOrManager

class AssessmentRequestDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated, IsOwnerOrManager]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    serializer_class = AssessmentRequestSerializer

    def perform_update(self, serializer):
        serializer.save()
        push_dashboard_refresh(['MANAGER', 'ADMIN', 'STAFF'])

    def perform_destroy(self, instance):
        instance.delete()
        push_dashboard_refresh(['MANAGER', 'ADMIN', 'STAFF'])

    def get_queryset(self):
        return AssessmentRequest.objects.select_related(
            'requested_by', 'reviewed_by', 'disbursed_by'
        ).prefetch_related(
            'status_history__changed_by',
            'fao_report__photos',
            'aco_calculation',
            'geo_report__photos',
        )


class RequestActionView(APIView):
    """Handle all status transitions on an assessment request."""
    permission_classes = [IsAuthenticated]

    ALLOWED_TRANSITIONS = {
        # Manager actions
        'assign_fao': {
            'from': [RequestStatus.SUBMITTED, RequestStatus.UNDER_REVIEW],
            'to': RequestStatus.WITH_FAO,
            'roles': [Role.MANAGER, Role.ADMIN],
        },
        'assign_geo': {
            'from': [RequestStatus.SUBMITTED, RequestStatus.UNDER_REVIEW, RequestStatus.WITH_ACO],
            'to': RequestStatus.WITH_GEO,
            'roles': [Role.MANAGER, Role.ADMIN],
        },
        'approve': {
            'from': [RequestStatus.SUBMITTED, RequestStatus.UNDER_REVIEW, RequestStatus.WITH_ACO,
                     RequestStatus.WITH_GEO, RequestStatus.ON_HOLD],
            'to': RequestStatus.APPROVED,
            'roles': [Role.MANAGER, Role.ADMIN],
        },
        'approve_partial': {
            'from': [RequestStatus.WITH_ACO, RequestStatus.WITH_GEO, RequestStatus.UNDER_REVIEW],
            'to': RequestStatus.APPROVED,
            'roles': [Role.MANAGER, Role.ADMIN],
        },
        'reject': {
            'from': [RequestStatus.SUBMITTED, RequestStatus.UNDER_REVIEW,
                     RequestStatus.WITH_FAO, RequestStatus.WITH_ACO, RequestStatus.WITH_GEO,
                     RequestStatus.ON_HOLD],
            'to': RequestStatus.REJECTED,
            'roles': [Role.MANAGER, Role.ADMIN],
        },
        'hold': {
            'from': [RequestStatus.SUBMITTED, RequestStatus.UNDER_REVIEW, RequestStatus.WITH_ACO],
            'to': RequestStatus.ON_HOLD,
            'roles': [Role.MANAGER, Role.ADMIN],
        },
        'cancel': {
            'from': [RequestStatus.SUBMITTED, RequestStatus.ON_HOLD, RequestStatus.WITH_FAO],
            'to': RequestStatus.CANCELLED,
            'roles': [Role.MANAGER, Role.ADMIN],
        },
        # FAO actions
        'forward_to_aco': {
            'from': [RequestStatus.WITH_FAO],
            'to': RequestStatus.WITH_ACO,
            'roles': [Role.FIELD_ASSESSMENT_OFFICER, Role.MANAGER, Role.ADMIN],
        },
        'fao_reject': {
            'from': [RequestStatus.WITH_FAO],
            'to': RequestStatus.FAO_REJECTED,
            'roles': [Role.FIELD_ASSESSMENT_OFFICER, Role.MANAGER, Role.ADMIN],
        },
        'return_to_staff': {
            'from': [RequestStatus.WITH_FAO],
            'to': RequestStatus.SUBMITTED,
            'roles': [Role.FIELD_ASSESSMENT_OFFICER, Role.MANAGER, Role.ADMIN],
        },
        'mark_urgent': {
            'from': [RequestStatus.WITH_FAO, RequestStatus.WITH_ACO, RequestStatus.WITH_GEO],
            'to': None,  # status doesn't change, priority does
            'roles': [Role.FIELD_ASSESSMENT_OFFICER, Role.ASSESSMENT_CALCULATION_OFFICER,
                      Role.GENERAL_ENQUIRY_OFFICER, Role.MANAGER, Role.ADMIN],
        },
        # ACO actions
        'forward_to_manager': {
            'from': [RequestStatus.WITH_ACO],
            'to': RequestStatus.UNDER_REVIEW,
            'roles': [Role.ASSESSMENT_CALCULATION_OFFICER, Role.MANAGER, Role.ADMIN],
        },
        'return_to_fao': {
            'from': [RequestStatus.WITH_ACO],
            'to': RequestStatus.WITH_FAO,
            'roles': [Role.ASSESSMENT_CALCULATION_OFFICER, Role.MANAGER, Role.ADMIN],
        },
        # GEO actions
        'geo_approve': {
            'from': [RequestStatus.WITH_GEO],
            'to': RequestStatus.UNDER_REVIEW,
            'roles': [Role.GENERAL_ENQUIRY_OFFICER, Role.MANAGER, Role.ADMIN],
        },
        'geo_reject': {
            'from': [RequestStatus.WITH_GEO],
            'to': RequestStatus.REJECTED,
            'roles': [Role.GENERAL_ENQUIRY_OFFICER, Role.MANAGER, Role.ADMIN],
        },
        'geo_further_enquiry': {
            'from': [RequestStatus.WITH_GEO],
            'to': RequestStatus.WITH_GEO,
            'roles': [Role.GENERAL_ENQUIRY_OFFICER, Role.MANAGER, Role.ADMIN],
        },
        # Cashier
        'disburse': {
            'from': [RequestStatus.APPROVED, RequestStatus.CASHIER_PENDING],
            'to': RequestStatus.DISBURSED,
            'roles': [Role.CASHIER, Role.ADMIN],
        },
    }

    def post(self, request, pk, action=None):
        # action can come from URL param or request body
        if action is None:
            action = request.data.get('action', '')
        if not action:
            return Response({'error': 'Action is required.'}, status=400)


        transition = self.ALLOWED_TRANSITIONS.get(action)
        if not transition:
            return Response({'error': 'Invalid action.'}, status=400)

        try:
            req = AssessmentRequest.objects.select_related('requested_by').get(pk=pk)
        except AssessmentRequest.DoesNotExist:
            return Response({'error': 'Assessment not found.'}, status=404)

        user_role = request.user.role
        if user_role not in transition['roles']:
            return Response({'error': f'Role {user_role} cannot perform action: {action}.'}, status=403)

        if req.status not in transition['from']:
            return Response({'error': f'Cannot {action} from current status: {req.status}.'}, status=400)

        old_status = req.status
        new_status = transition['to']
        remarks = request.data.get('remarks', '')
        amount_approved = request.data.get('amount_approved')

        # Apply field changes
        if new_status is not None:
            req.status = new_status

        if action == 'mark_urgent':
            req.priority = 'CRITICAL'
        elif action in ['approve', 'approve_partial']:
            req.approved_at = timezone.now()
            req.reviewed_by = request.user
            if amount_approved:
                req.amount_approved = amount_approved
            req.manager_remarks = remarks
            req.status = RequestStatus.APPROVED
        elif action == 'hold':
            req.hold_reason = request.data.get('hold_reason', remarks)
        elif action in ['reject', 'fao_reject', 'geo_reject']:
            req.rejection_reason = request.data.get('rejection_reason', remarks)
        elif action == 'cancel':
            req.manager_remarks = remarks
        elif action == 'forward_to_manager':
            # Set recommended amount from ACO calculation if available
            try:
                req.amount_requested = req.aco_calculation.recommended_amount
            except Exception:
                pass
        elif action == 'geo_approve':
            try:
                override = req.geo_report.recommended_amount_override
                if override:
                    req.amount_approved = override
            except Exception:
                pass

        req.save()

        RequestStatusHistory.objects.create(
            request=req, from_status=old_status, to_status=req.status,
            changed_by=request.user, remarks=remarks
        )
        AuditLog.objects.create(
            user=request.user, action=f'{action.upper()}_ASSESSMENT', module='MANAGER',
            record_type='AssessmentRequest', record_id=str(req.id),
            reference_number=req.request_number, previous_status=old_status, new_status=req.status,
            description=f"Assessment {req.request_number} action '{action}' by {request.user.full_name}",
            ip_address=getattr(request, 'audit_ip', None)
        )

        # Real-time notifications
        self._send_notifications(action, req, request.user, remarks)
        push_request_update(str(req.id), req.request_number, req.status,
                            user_role, [Role.MANAGER, Role.ADMIN,
                                        Role.FIELD_ASSESSMENT_OFFICER,
                                        Role.ASSESSMENT_CALCULATION_OFFICER,
                                        Role.GENERAL_ENQUIRY_OFFICER])
        push_dashboard_refresh([Role.MANAGER, Role.ADMIN,
                                 Role.FIELD_ASSESSMENT_OFFICER,
                                 Role.ASSESSMENT_CALCULATION_OFFICER,
                                 Role.GENERAL_ENQUIRY_OFFICER])

        return Response({
            'message': f'Action "{action}" completed.',
            'status': req.status,
            'request_number': req.request_number,
        })

    def _send_notifications(self, action, req, actor, remarks):
        num = req.request_number
        name = req.beneficiary_name or num
        if action == 'assign_fao':
            push_to_role(Role.FIELD_ASSESSMENT_OFFICER,
                         f'New Assessment Assigned: {num}',
                         f'{name} — Field visit required', 'ASSESSMENT_ASSIGNED', num)
        elif action == 'forward_to_aco':
            push_to_role(Role.ASSESSMENT_CALCULATION_OFFICER,
                         f'Eligible Assessment: {num}',
                         f'{name} — Cost calculation needed', 'FAO_FORWARDED', num)
            push_to_role(Role.MANAGER,
                         f'FAO Report Submitted: {num}',
                         f'Assessment marked eligible by FAO', 'FAO_SUBMITTED', num)
        elif action == 'fao_reject':
            push_to_role(Role.MANAGER,
                         f'FAO Rejected: {num}',
                         f'{name} — Not eligible: {remarks}', 'FAO_REJECTED', num)
        elif action == 'forward_to_manager':
            push_to_role(Role.MANAGER,
                         f'ACO Report Ready: {num}',
                         f'Cost estimation submitted for {name}', 'ACO_SUBMITTED', num)
        elif action == 'assign_geo':
            push_to_role(Role.GENERAL_ENQUIRY_OFFICER,
                         f'Verification Required: {num}',
                         f'{name} — Advanced enquiry needed', 'GEO_ASSIGNED', num)
        elif action == 'geo_approve':
            push_to_role(Role.MANAGER,
                         f'GEO Verification Done: {num}',
                         f'GEO recommends approval for {name}', 'GEO_APPROVED', num)
        elif action == 'approve':
            push_to_role(Role.CASHIER,
                         f'Ready for Disbursement: {num}',
                         f'₹{req.amount_approved or req.amount_requested} for {name}',
                         'ASSESSMENT_APPROVED', num)


class RequestStatusHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            req = AssessmentRequest.objects.get(pk=pk)
        except AssessmentRequest.DoesNotExist:
            return Response({'error': 'Not found.'}, status=404)
        history = req.status_history.select_related('changed_by').all()
        return Response(RequestStatusHistorySerializer(history, many=True).data)


# ── FAO Report ─────────────────────────────────────────────────────

class FAOReportView(APIView):
    """GET existing FAO report or POST new one for an assessment."""
    permission_classes = [IsFAO]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request, pk):
        try:
            req = AssessmentRequest.objects.get(pk=pk)
        except AssessmentRequest.DoesNotExist:
            return Response({'error': 'Assessment not found.'}, status=404)
        try:
            report = req.fao_report
            return Response(FAOReportSerializer(report).data)
        except FAOReport.DoesNotExist:
            return Response({'detail': 'No FAO report yet.'}, status=404)

    def post(self, request, pk):
        try:
            assessment = AssessmentRequest.objects.get(pk=pk)
        except AssessmentRequest.DoesNotExist:
            return Response({'error': 'Assessment not found.'}, status=404)

        if assessment.status != RequestStatus.WITH_FAO:
            return Response({'error': f'Assessment is in status {assessment.status}, not WITH_FAO.'}, status=400)

        # Update or create
        try:
            report = assessment.fao_report
            serializer = FAOReportSerializer(report, data=request.data, partial=True)
        except FAOReport.DoesNotExist:
            serializer = FAOReportSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        eligibility = request.data.get('eligibility', EligibilityStatus.PENDING)

        report = serializer.save(
            assessment=assessment,
            submitted_by=request.user,
            submitted_at=timezone.now(),
            eligibility=eligibility,
        )

        # Update assessment eligibility
        assessment.eligibility = eligibility
        if report.category_confirmed:
            assessment.category = report.category_confirmed
        if report.urgency_assessment:
            assessment.priority = report.urgency_assessment

        # Auto-transition based on eligibility
        old_status = assessment.status
        if eligibility == EligibilityStatus.ELIGIBLE:
            assessment.status = RequestStatus.WITH_ACO
            msg = 'Eligible — forwarded to ACO automatically'
        elif eligibility == EligibilityStatus.NOT_ELIGIBLE:
            assessment.status = RequestStatus.FAO_REJECTED
            msg = 'Not eligible — rejected by FAO'
        else:
            msg = 'FAO report saved (eligibility pending)'

        assessment.save()

        RequestStatusHistory.objects.create(
            request=assessment, from_status=old_status, to_status=assessment.status,
            changed_by=request.user, remarks=f'FAO report submitted. {msg}'
        )
        AuditLog.objects.create(
            user=request.user, action='SUBMIT_FAO_REPORT', module='MANAGER',
            record_type='FAOReport', record_id=str(report.id),
            reference_number=assessment.request_number,
            previous_status=old_status, new_status=assessment.status,
            description=f"FAO Report submitted for {assessment.request_number}. {msg}",
        )

        # Notify
        if eligibility == EligibilityStatus.ELIGIBLE:
            push_to_role(Role.ASSESSMENT_CALCULATION_OFFICER,
                         f'New Case for Calculation: {assessment.request_number}',
                         f'{assessment.beneficiary_name} — Cost estimation needed',
                         'FAO_FORWARDED', assessment.request_number)
            push_to_role(Role.MANAGER,
                         f'FAO Report: {assessment.request_number}',
                         'Marked ELIGIBLE — Forwarded to ACO', 'FAO_SUBMITTED',
                         assessment.request_number)
        elif eligibility == EligibilityStatus.NOT_ELIGIBLE:
            push_to_role(Role.MANAGER,
                         f'FAO Rejected: {assessment.request_number}',
                         f'Not eligible: {report.eligibility_reason[:80]}',
                         'FAO_REJECTED', assessment.request_number)

        push_dashboard_refresh([Role.MANAGER, Role.ADMIN, Role.ASSESSMENT_CALCULATION_OFFICER])

        return Response(FAOReportSerializer(report).data, status=201)


# ── ACO Calculation ────────────────────────────────────────────────

class ACOCalculationView(APIView):
    """GET existing ACO calculation or POST new one."""
    permission_classes = [IsACO]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request, pk):
        try:
            req = AssessmentRequest.objects.get(pk=pk)
        except AssessmentRequest.DoesNotExist:
            return Response({'error': 'Assessment not found.'}, status=404)
        try:
            calc = req.aco_calculation
            return Response(ACOCalculationSerializer(calc).data)
        except ACOCalculation.DoesNotExist:
            return Response({'detail': 'No ACO calculation yet.'}, status=404)

    def post(self, request, pk):
        try:
            assessment = AssessmentRequest.objects.get(pk=pk)
        except AssessmentRequest.DoesNotExist:
            return Response({'error': 'Assessment not found.'}, status=404)

        if assessment.status != RequestStatus.WITH_ACO:
            return Response({'error': f'Assessment status is {assessment.status}, not WITH_ACO.'}, status=400)

        try:
            calc = assessment.aco_calculation
            serializer = ACOCalculationSerializer(calc, data=request.data, partial=True)
        except ACOCalculation.DoesNotExist:
            serializer = ACOCalculationSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        calc = serializer.save(
            assessment=assessment,
            submitted_by=request.user,
            submitted_at=timezone.now(),
        )

        # Auto-forward to Manager
        old_status = assessment.status
        assessment.status = RequestStatus.UNDER_REVIEW
        assessment.amount_requested = calc.recommended_amount
        assessment.save()

        RequestStatusHistory.objects.create(
            request=assessment, from_status=old_status, to_status=assessment.status,
            changed_by=request.user,
            remarks=f'ACO calculation submitted. Recommended: ₹{calc.recommended_amount}'
        )
        AuditLog.objects.create(
            user=request.user, action='SUBMIT_ACO_CALCULATION', module='MANAGER',
            record_type='ACOCalculation', record_id=str(calc.id),
            reference_number=assessment.request_number,
            previous_status=old_status, new_status=assessment.status,
            description=f"ACO Calculation submitted. Recommended ₹{calc.recommended_amount}",
        )

        push_to_role(Role.MANAGER,
                     f'ACO Report Ready: {assessment.request_number}',
                     f'Cost: ₹{calc.total_estimated_cost} | Recommended: ₹{calc.recommended_amount}',
                     'ACO_SUBMITTED', assessment.request_number)
        push_dashboard_refresh([Role.MANAGER, Role.ADMIN])

        return Response(ACOCalculationSerializer(calc).data, status=201)


# ── GEO Report ─────────────────────────────────────────────────────

class GEOReportView(APIView):
    """GET existing GEO report or POST new one."""
    permission_classes = [IsGEO]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request, pk):
        try:
            req = AssessmentRequest.objects.get(pk=pk)
        except AssessmentRequest.DoesNotExist:
            return Response({'error': 'Assessment not found.'}, status=404)
        try:
            report = req.geo_report
            return Response(GEOReportSerializer(report).data)
        except GEOReport.DoesNotExist:
            return Response({'detail': 'No GEO report yet.'}, status=404)

    def post(self, request, pk):
        try:
            assessment = AssessmentRequest.objects.get(pk=pk)
        except AssessmentRequest.DoesNotExist:
            return Response({'error': 'Assessment not found.'}, status=404)

        if assessment.status != RequestStatus.WITH_GEO:
            return Response({'error': f'Assessment status is {assessment.status}, not WITH_GEO.'}, status=400)

        try:
            geo = assessment.geo_report
            serializer = GEOReportSerializer(geo, data=request.data, partial=True)
        except GEOReport.DoesNotExist:
            serializer = GEOReportSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        recommendation = request.data.get('recommendation', 'APPROVE_AS_IS')
        report = serializer.save(
            assessment=assessment,
            submitted_by=request.user,
            submitted_at=timezone.now(),
            recommendation=recommendation,
        )

        old_status = assessment.status
        if recommendation in ['APPROVE_AS_IS', 'APPROVE_WITH_CHANGES']:
            assessment.status = RequestStatus.UNDER_REVIEW
            if report.recommended_amount_override:
                assessment.amount_requested = report.recommended_amount_override
            push_to_role(Role.MANAGER,
                         f'GEO Verification Done: {assessment.request_number}',
                         f'GEO recommends approval — {assessment.beneficiary_name}',
                         'GEO_SUBMITTED', assessment.request_number)
        elif recommendation == 'REJECT':
            assessment.status = RequestStatus.REJECTED
            assessment.rejection_reason = report.recommendation_justification
            push_to_role(Role.MANAGER,
                         f'GEO Rejected: {assessment.request_number}',
                         report.recommendation_justification[:80],
                         'GEO_REJECTED', assessment.request_number)
        else:
            # FURTHER_REVIEW — stays WITH_GEO
            push_to_role(Role.MANAGER,
                         f'GEO Needs Further Review: {assessment.request_number}',
                         'GEO officer flagged for further review',
                         'GEO_FURTHER', assessment.request_number)

        assessment.save()

        RequestStatusHistory.objects.create(
            request=assessment, from_status=old_status, to_status=assessment.status,
            changed_by=request.user,
            remarks=f'GEO Report submitted. Recommendation: {recommendation}'
        )
        AuditLog.objects.create(
            user=request.user, action='SUBMIT_GEO_REPORT', module='MANAGER',
            record_type='GEOReport', record_id=str(report.id),
            reference_number=assessment.request_number,
            previous_status=old_status, new_status=assessment.status,
            description=f"GEO Report submitted. Recommendation: {recommendation}",
        )
        push_dashboard_refresh([Role.MANAGER, Role.ADMIN])

        return Response(GEOReportSerializer(report).data, status=201)


# ── Charity Inventory ───────────────────────────────────────────────

class CharityInventoryListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = CharityInventorySerializer
    filterset_fields = ['category', 'is_active']
    search_fields = ['item_name', 'item_code', 'description']
    ordering_fields = ['category', 'item_name', 'quantity_available']

    def get_queryset(self):
        return CharityInventory.objects.filter(is_active=True)

    def perform_create(self, serializer):
        serializer.save(updated_by=self.request.user)


class CharityInventoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsManager]
    serializer_class = CharityInventorySerializer
    queryset = CharityInventory.objects.all()

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)


# ── Minutes Registry ───────────────────────────────────────────────

class MinutesListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsManager]
    serializer_class = MinutesSerializer
    queryset = MinutesRegistry.objects.select_related('created_by', 'approved_by').all()
    filterset_fields = ['meeting_type', 'status']
    search_fields = ['meeting_id', 'title', 'chairperson']
    ordering_fields = ['meeting_date']
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class MinutesDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsManager]
    serializer_class = MinutesSerializer
    queryset = MinutesRegistry.objects.all()
    parser_classes = [MultiPartParser, FormParser, JSONParser]


# ── Partners ───────────────────────────────────────────────────────

class PartnerListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsManager]
    serializer_class = PartnerSerializer
    queryset = Partner.objects.all()
    filterset_fields = ['partner_type', 'status']
    search_fields = ['partner_id', 'organization_name', 'contact_person']
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class PartnerDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsManager]
    serializer_class = PartnerSerializer
    queryset = Partner.objects.all()
    parser_classes = [MultiPartParser, FormParser, JSONParser]
