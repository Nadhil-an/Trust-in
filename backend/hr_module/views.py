"""HR Module Views"""
from django.utils import timezone
from django.db.models import Count, Q
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from core.permissions import IsHR, IsAnyStaff, IsOwnerOrManager, IsOwnerOrManagerOrHR
from core.models import AuditLog
from notify.service import push_notification, push_to_role, push_dashboard_refresh
from hr_module.models import (Member, MemberDocument, Volunteer, ExecutiveMember,
                               ExecutiveOfficer, SalaryStructure, Attendance,
                               LeaveRequest, MonthlyPayroll, EmployeeDocument,
                               Complaint)
from hr_module.serializers import (MemberSerializer, MemberDocumentSerializer,
                                    VolunteerSerializer, ExecutiveMemberSerializer,
                                    ExecutiveOfficerSerializer, SalaryStructureSerializer,
                                    AttendanceSerializer, LeaveRequestSerializer,
                                    MonthlyPayrollSerializer, EmployeeDocumentSerializer,
                                    ComplaintSerializer)


class HRDashboardView(APIView):
    permission_classes = [IsHR]

    def get(self, request):
        today = timezone.now().date()
        present_qs = Attendance.objects.filter(date=today, status='PRESENT')
        absent_qs = Attendance.objects.filter(date=today, status='ABSENT')
        leave_qs = Attendance.objects.filter(date=today, status='LEAVE')

        present_today = present_qs.count()
        absent_today = absent_qs.count()
        on_leave = leave_qs.count()
        
        present_list = [{'id': str(x.employee.id), 'name': x.employee.full_name, 'emp_id': x.employee.employee_id} for x in present_qs.select_related('employee')]
        absent_list = [{'id': str(x.employee.id), 'name': x.employee.full_name, 'emp_id': x.employee.employee_id} for x in absent_qs.select_related('employee')]
        leave_list = [{'id': str(x.employee.id), 'name': x.employee.full_name, 'emp_id': x.employee.employee_id} for x in leave_qs.select_related('employee')]
        pending_leave = LeaveRequest.objects.filter(status='PENDING').count()
        expiring_docs = EmployeeDocument.objects.filter(
            expiry_date__lte=today + timezone.timedelta(days=30),
            status='VALID'
        ).count()
        upcoming_bdays = Member.objects.filter(
            date_of_birth__month=today.month
        ).count()

        attendance_history = []
        for i in range(6, -1, -1):
            d = today - timezone.timedelta(days=i)
            attendance_history.append({
                'date': d.strftime('%d %b'),
                'present': Attendance.objects.filter(date=d, status='PRESENT').count(),
                'absent': Attendance.objects.filter(date=d, status='ABSENT').count(),
                'leave': Attendance.objects.filter(date=d, status='LEAVE').count(),
            })

        return Response({
            'members': {'total': Member.objects.count(), 'active': Member.objects.filter(status='ACTIVE').count()},
            'volunteers': {'total': Volunteer.objects.count(), 'active': Volunteer.objects.filter(status='ACTIVE').count()},
            'executive_members': ExecutiveMember.objects.filter(status='ACTIVE').count(),
            'executive_officers': ExecutiveOfficer.objects.filter(status='ACTIVE', employment_type='FULL_TIME').count(),
            'attendance': {
                'present_today': present_today,
                'absent_today': absent_today,
                'on_leave': on_leave,
                'present_list': present_list,
                'absent_list': absent_list,
                'leave_list': leave_list,
                'history': attendance_history,
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
    permission_classes = [IsAnyStaff, IsOwnerOrManagerOrHR]
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


class OfficerPayrollDataView(APIView):
    permission_classes = [IsHR]

    def get(self, request, pk):
        try:
            employee = ExecutiveOfficer.objects.get(pk=pk)
        except ExecutiveOfficer.DoesNotExist:
            return Response({'error': 'Employee not found.'}, status=404)
        
        try:
            month = int(request.query_params.get('month'))
            year = int(request.query_params.get('year'))
        except (TypeError, ValueError):
            return Response({'error': 'Valid month and year required.'}, status=400)

        # Get active salary structure
        try:
            salary = SalaryStructure.objects.get(employee=employee, is_active=True)
            salary_data = SalaryStructureSerializer(salary).data
        except SalaryStructure.DoesNotExist:
            return Response({'error': 'No active salary structure found for this employee.'}, status=404)

        # Get attendance summary
        attendance = Attendance.objects.filter(
            employee=employee,
            date__year=year,
            date__month=month
        ).values('status').annotate(count=Count('id'))
        
        att_counts = {item['status']: item['count'] for item in attendance}
        
        return Response({
            'employee_name': employee.full_name,
            'employment_type': employee.employment_type,
            'salary_structure': salary_data,
            'attendance': {
                'present': att_counts.get('PRESENT', 0),
                'absent': att_counts.get('ABSENT', 0),
                'leave': att_counts.get('LEAVE', 0),
                'late': att_counts.get('LATE', 0),
            }
        })


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


class OfficerAttendanceGraphView(APIView):
    permission_classes = [IsHR]

    def get(self, request, pk):
        try:
            officer = ExecutiveOfficer.objects.get(pk=pk)
        except ExecutiveOfficer.DoesNotExist:
            return Response({'error': 'Officer not found'}, status=404)

        try:
            days = int(request.query_params.get('days', 7))
        except ValueError:
            days = 7

        today = timezone.now().date()
        history = []
        for i in range(days - 1, -1, -1):
            d = today - timezone.timedelta(days=i)
            att = Attendance.objects.filter(employee=officer, date=d).first()
            
            val = 0
            status_text = 'NOT_MARKED'
            if att:
                status_text = att.status
                if att.status == 'PRESENT':
                    val = 1
                elif att.status == 'HALF_DAY':
                    val = 0.5
                elif att.status in ['ABSENT', 'LEAVE']:
                    val = 0
            
            history.append({
                'date': d.strftime('%d %b'),
                'full_date': d.isoformat(),
                'status': status_text,
                'value': val
            })

        return Response({'history': history})


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



# ── Complaints ────────────────────────────────────────────────────
class ComplaintListCreateView(generics.ListCreateAPIView):
    # Allow any staff to create complaints (e.g. from mobile), but HR needs to see them
    permission_classes = [IsAnyStaff]
    serializer_class = ComplaintSerializer
    queryset = Complaint.objects.select_related('employee').all()
    filterset_fields = ['status', 'employee']
    search_fields = ['complaint_id', 'title']

    def perform_create(self, serializer):
        # We can auto-assign employee based on request.user if they are an ExecutiveOfficer
        # For now we assume the payload contains the employee ID or is provided by mobile app.
        serializer.save()
        push_to_role('HR', {
            'type': 'NEW_COMPLAINT',
            'title': 'New Complaint Raised',
            'message': f"A new complaint has been submitted."
        })


class ComplaintDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAnyStaff]
    serializer_class = ComplaintSerializer
    queryset = Complaint.objects.all()

    def perform_update(self, serializer):
        instance = serializer.save()
        if instance.status in ['RESOLVED', 'REJECTED']:
            push_to_role('STAFF', {
                'type': 'COMPLAINT_UPDATE',
                'title': f"Complaint {instance.status}",
                'message': f"Your complaint '{instance.complaint_id}' has been marked as {instance.status}."
            })


# ── Employee Documents ────────────────────────────────────────────
class EmployeeDocumentView(generics.ListCreateAPIView):
    permission_classes = [IsHR]
    serializer_class = EmployeeDocumentSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        return EmployeeDocument.objects.filter(employee_id=self.kwargs['emp_pk'])

    def perform_create(self, serializer):
        serializer.save(employee_id=self.kwargs['emp_pk'], uploaded_by=self.request.user)


# ── Birthday Alerts ────────────────────────────────────────────────

class BirthdayAlertView(APIView):
    """
    Returns staff members whose birthday is today or tomorrow.
    Used by Manager/HR dashboards and mobile staff home screen.
    """
    permission_classes = [IsAnyStaff]

    def get(self, request):
        from datetime import date, timedelta
        today = date.today()
        tomorrow = today + timedelta(days=1)

        def get_bday_people(target_date):
            officers = ExecutiveOfficer.objects.filter(
                date_of_birth__month=target_date.month,
                date_of_birth__day=target_date.day,
                status='ACTIVE',
            ).values('id', 'full_name', 'designation', 'employee_id', 'date_of_birth')

            result = []
            for o in officers:
                dob = o['date_of_birth']
                age = target_date.year - dob.year if dob else None
                result.append({
                    'id': str(o['id']),
                    'name': o['full_name'],
                    'designation': o['designation'],
                    'employee_id': o['employee_id'],
                    'age': age,
                    'type': 'staff',
                })
            return result

        return Response({
            'today': get_bday_people(today),
            'tomorrow': get_bday_people(tomorrow),
            'today_date': today.strftime('%d %B %Y'),
            'tomorrow_date': tomorrow.strftime('%d %B %Y'),
        })
