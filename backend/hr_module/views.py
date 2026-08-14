"""HR Module Views"""
from django.utils import timezone
from django.db.models import Count, Q
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from core.permissions import IsHR, IsAnyStaff, IsOwnerOrManager
from core.models import AuditLog
from notify.service import push_notification, push_to_role, push_dashboard_refresh
from hr_module.models import (Member, MemberDocument, Volunteer, ExecutiveMember,
                               ExecutiveOfficer, SalaryStructure, Attendance,
                               LeaveRequest, MonthlyPayroll, EmployeeDocument)
from hr_module.serializers import (MemberSerializer, MemberDocumentSerializer,
                                    VolunteerSerializer, ExecutiveMemberSerializer,
                                    ExecutiveOfficerSerializer, SalaryStructureSerializer,
                                    AttendanceSerializer, LeaveRequestSerializer,
                                    MonthlyPayrollSerializer, EmployeeDocumentSerializer)


class HRDashboardView(APIView):
    permission_classes = [IsHR]

    def get(self, request):
        today = timezone.now().date()
        present_today = Attendance.objects.filter(date=today, status='PRESENT').count()
        absent_today = Attendance.objects.filter(date=today, status='ABSENT').count()
        on_leave = Attendance.objects.filter(date=today, status='LEAVE').count()
        pending_leave = LeaveRequest.objects.filter(status='PENDING').count()
        expiring_docs = EmployeeDocument.objects.filter(
            expiry_date__lte=today + timezone.timedelta(days=30),
            status='VALID'
        ).count()
        upcoming_bdays = Member.objects.filter(
            date_of_birth__month=today.month
        ).count()

        return Response({
            'members': {'total': Member.objects.count(), 'active': Member.objects.filter(status='ACTIVE').count()},
            'volunteers': {'total': Volunteer.objects.count(), 'active': Volunteer.objects.filter(status='ACTIVE').count()},
            'executive_members': ExecutiveMember.objects.filter(status='ACTIVE').count(),
            'executive_officers': ExecutiveOfficer.objects.filter(status='ACTIVE').count(),
            'attendance': {
                'present_today': present_today,
                'absent_today': absent_today,
                'on_leave': on_leave,
            },
            'leave': {'pending': pending_leave},
            'alerts': {
                'expiring_documents': expiring_docs,
                'upcoming_birthdays': upcoming_bdays,
            },
            'recent_members': MemberSerializer(
                Member.objects.order_by('-created_at')[:5], many=True
            ).data,
        })


class StaffDashboardView(APIView):
    permission_classes = [IsAnyStaff]

    def get(self, request):
        user = request.user
        today = timezone.localtime(timezone.now()).date()
        
        # Members added today by this user
        members_today = Member.objects.filter(created_by=user, created_at__date=today).count()
        
        # Donations collected today by this user
        from accounts_module.models import Income
        from django.db.models import Sum
        donations_today = Income.objects.filter(created_by=user, date=today).aggregate(t=Sum('amount'))['t'] or 0
        
        # Assessments submitted today by this user
        from manager_module.models import AssessmentRequest
        assessments_today = AssessmentRequest.objects.filter(requested_by=user, created_at__date=today).count()
        
        return Response({
            'members': members_today,
            'donations': float(donations_today),
            'assessments': assessments_today,
        })

# ── Members ───────────────────────────────────────────────────────
class MemberListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAnyStaff]
    serializer_class = MemberSerializer
    filterset_fields = ['status', 'membership_type', 'gender']
    search_fields = ['member_id', 'full_name', 'phone', 'email']
    ordering_fields = ['full_name', 'joining_date', 'created_at']
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        qs = Member.objects.all()
        # If the user is STAFF (and not manager/admin/hr), only show members they added
        from core.models import Role
        if self.request.user.role == Role.STAFF:
            qs = qs.filter(created_by=self.request.user)
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
        push_dashboard_refresh(['HR', 'MANAGER', 'ADMIN', 'STAFF'])

class MemberDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAnyStaff, IsOwnerOrManager]
    serializer_class = MemberSerializer
    queryset = Member.objects.all()
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def perform_update(self, serializer):
        serializer.save()
        push_dashboard_refresh(['HR', 'MANAGER', 'ADMIN', 'STAFF'])

    def perform_destroy(self, instance):
        instance.delete()
        push_dashboard_refresh(['HR', 'MANAGER', 'ADMIN', 'STAFF'])


class MemberDocumentView(generics.ListCreateAPIView):
    permission_classes = [IsHR]
    serializer_class = MemberDocumentSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        return MemberDocument.objects.filter(member_id=self.kwargs['member_pk'])

    def perform_create(self, serializer):
        serializer.save(member_id=self.kwargs['member_pk'], uploaded_by=self.request.user)


# ── Volunteers ────────────────────────────────────────────────────
class VolunteerListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsHR]
    serializer_class = VolunteerSerializer
    queryset = Volunteer.objects.all()
    filterset_fields = ['status']
    search_fields = ['volunteer_id', 'full_name', 'phone', 'email', 'skills']
    ordering_fields = ['full_name', 'joining_date']
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class VolunteerDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsHR]
    serializer_class = VolunteerSerializer
    queryset = Volunteer.objects.all()
    parser_classes = [MultiPartParser, FormParser, JSONParser]


# ── Executive Members ─────────────────────────────────────────────
class ExecutiveMemberListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsHR]
    serializer_class = ExecutiveMemberSerializer
    queryset = ExecutiveMember.objects.all()
    filterset_fields = ['designation', 'status']
    search_fields = ['exec_id', 'full_name', 'phone']
    parser_classes = [MultiPartParser, FormParser, JSONParser]


class ExecutiveMemberDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsHR]
    serializer_class = ExecutiveMemberSerializer
    queryset = ExecutiveMember.objects.all()
    parser_classes = [MultiPartParser, FormParser, JSONParser]


# ── Executive Officers ────────────────────────────────────────────
class ExecutiveOfficerListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsHR]
    serializer_class = ExecutiveOfficerSerializer
    queryset = ExecutiveOfficer.objects.all()
    filterset_fields = ['status', 'employment_type', 'department']
    search_fields = ['employee_id', 'full_name', 'phone', 'designation']
    ordering_fields = ['full_name', 'joining_date']
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class ExecutiveOfficerDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsHR]
    serializer_class = ExecutiveOfficerSerializer
    queryset = ExecutiveOfficer.objects.all()
    parser_classes = [MultiPartParser, FormParser, JSONParser]


# ── Salary Structure ──────────────────────────────────────────────
class SalaryStructureListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsHR]
    serializer_class = SalaryStructureSerializer
    queryset = SalaryStructure.objects.select_related('employee').all()
    filterset_fields = ['employee', 'is_active']

    def perform_create(self, serializer):
        # Deactivate previous structures for this employee
        emp = serializer.validated_data.get('employee')
        SalaryStructure.objects.filter(employee=emp, is_active=True).update(is_active=False)
        serializer.save(created_by=self.request.user, is_active=True)


class SalaryStructureDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsHR]
    serializer_class = SalaryStructureSerializer
    queryset = SalaryStructure.objects.all()


# ── Attendance ────────────────────────────────────────────────────
class AttendanceListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsHR]
    serializer_class = AttendanceSerializer
    queryset = Attendance.objects.select_related('employee', 'marked_by').all()
    filterset_fields = ['employee', 'date', 'status']
    search_fields = ['employee__full_name', 'employee__employee_id']
    ordering_fields = ['date']

    def perform_create(self, serializer):
        serializer.save(marked_by=self.request.user)


class AttendanceDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsHR]
    serializer_class = AttendanceSerializer
    queryset = Attendance.objects.all()


class BulkAttendanceView(APIView):
    """Mark attendance for multiple employees at once."""
    permission_classes = [IsHR]

    def post(self, request):
        records = request.data.get('records', [])
        created, updated = 0, 0
        for rec in records:
            emp_id = rec.get('employee')
            date = rec.get('date', timezone.now().date())
            att, was_created = Attendance.objects.update_or_create(
                employee_id=emp_id, date=date,
                defaults={
                    'status': rec.get('status', 'PRESENT'),
                    'check_in': rec.get('check_in'),
                    'check_out': rec.get('check_out'),
                    'remarks': rec.get('remarks', ''),
                    'marked_by': request.user,
                }
            )
            if was_created:
                created += 1
            else:
                updated += 1
        return Response({'created': created, 'updated': updated})


# ── Leave Management ──────────────────────────────────────────────
class LeaveRequestListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsHR]
    serializer_class = LeaveRequestSerializer
    queryset = LeaveRequest.objects.select_related('employee', 'approved_by').all()
    filterset_fields = ['status', 'leave_type', 'employee']
    ordering_fields = ['created_at', 'from_date']
    parser_classes = [MultiPartParser, FormParser, JSONParser]


class LeaveRequestDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsHR]
    serializer_class = LeaveRequestSerializer
    queryset = LeaveRequest.objects.all()
    parser_classes = [MultiPartParser, FormParser, JSONParser]


class LeaveApprovalView(APIView):
    permission_classes = [IsHR]

    def post(self, request, pk):
        action = request.data.get('action')  # approve / reject
        try:
            leave = LeaveRequest.objects.get(pk=pk, status='PENDING')
        except LeaveRequest.DoesNotExist:
            return Response({'error': 'Leave request not found or already processed.'}, status=404)

        if action == 'approve':
            leave.status = 'APPROVED'
            leave.approved_by = request.user
            leave.approved_at = timezone.now()
            # Mark attendance as LEAVE for these days
            current = leave.from_date
            while current <= leave.to_date:
                Attendance.objects.update_or_create(
                    employee=leave.employee, date=current,
                    defaults={'status': 'LEAVE', 'marked_by': request.user}
                )
                current += timezone.timedelta(days=1)
        elif action == 'reject':
            leave.status = 'REJECTED'
            leave.rejection_reason = request.data.get('reason', '')
        else:
            return Response({'error': 'Invalid action.'}, status=400)

        leave.save()
        return Response({'message': f'Leave {action}d.', 'status': leave.status})


# ── Payroll ───────────────────────────────────────────────────────
class PayrollListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsHR]
    serializer_class = MonthlyPayrollSerializer
    queryset = MonthlyPayroll.objects.select_related('employee', 'salary_structure', 'generated_by').all()
    filterset_fields = ['status', 'month', 'year', 'employee']
    ordering_fields = ['year', 'month']

    def perform_create(self, serializer):
        payroll = serializer.save(generated_by=self.request.user)
        AuditLog.objects.create(
            user=self.request.user, action='GENERATE_PAYROLL', module='HR',
            record_type='MonthlyPayroll', record_id=str(payroll.id),
            reference_number=payroll.payroll_id,
            description=f"Payroll generated for {payroll.employee.full_name} — {payroll.month}/{payroll.year}",
            ip_address=getattr(self.request, 'audit_ip', None)
        )


class PayrollDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsHR]
    serializer_class = MonthlyPayrollSerializer
    queryset = MonthlyPayroll.objects.all()


class ProcessPaymentView(APIView):
    """Mark payroll as PAID and create Accounts transaction."""
    permission_classes = [IsHR]

    def post(self, request, pk):
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
        from accounts_module.models import Transaction, Expense
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
            user=request.user, action='PAY_SALARY', module='HR',
            record_type='MonthlyPayroll', record_id=str(payroll.id),
            reference_number=payroll.payroll_id,
            description=f"Salary paid to {payroll.employee.full_name}: ₹{payroll.net_salary}",
            ip_address=getattr(request, 'audit_ip', None)
        )

        return Response({'message': 'Salary paid successfully.', 'payroll_id': payroll.payroll_id})


# ── Employee Documents ────────────────────────────────────────────
class EmployeeDocumentView(generics.ListCreateAPIView):
    permission_classes = [IsHR]
    serializer_class = EmployeeDocumentSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        return EmployeeDocument.objects.filter(employee_id=self.kwargs['emp_pk'])

    def perform_create(self, serializer):
        serializer.save(employee_id=self.kwargs['emp_pk'], uploaded_by=self.request.user)
