"""HR Module Views"""
from django.http import HttpResponse
from django.utils import timezone
from django.db.models import Count, Q
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from core.permissions import IsHR, IsAnyStaff, IsOwnerOrManager, IsOwnerOrManagerOrHR
from core.models import AuditLog
from notify.service import push_notification, push_to_role, push_dashboard_refresh
from hr_module.member_receipt_service import generate_member_certificate_html
from hr_module.member_pdf_generator import generate_member_receipt_pdf_bytes
from hr_module.member_image_generator import generate_member_receipt_image_bytes
from hr_module.models import (Member, MemberDocument, Volunteer, ExecutiveMember,
                               ExecutiveOfficer, SalaryStructure, Attendance,
                               LeaveRequest, MonthlyPayroll, EmployeeDocument,
                               Complaint, StaffReport, PaymentAdvanceRequest, PerformancePoint)
from hr_module.serializers import (MemberSerializer, MemberDocumentSerializer,
                                    VolunteerSerializer, ExecutiveMemberSerializer,
                                    ExecutiveOfficerSerializer, SalaryStructureSerializer,
                                    AttendanceSerializer, LeaveRequestSerializer,
                                    MonthlyPayrollSerializer, EmployeeDocumentSerializer,
                                    ComplaintSerializer, StaffReportSerializer,
                                    PaymentAdvanceRequestSerializer, PerformancePointSerializer)


def get_officer_for_user(user):
    """Find or create ExecutiveOfficer corresponding to logged in User."""
    if not user:
        return None
    officer = ExecutiveOfficer.objects.filter(
        Q(email__iexact=user.email) | Q(full_name__iexact=user.full_name)
    ).first()
    if not officer:
        officer = ExecutiveOfficer.objects.create(
            full_name=user.full_name,
            email=user.email,
            phone=getattr(user, 'phone', '') or '',
            designation=getattr(user, 'role', 'Staff'),
            created_by=user
        )
    return officer



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
        from django.db.models import Sum, Q
        
        incomes_today = Income.objects.filter(created_by=user, date=today)
        donations_today = incomes_today.aggregate(t=Sum('amount'))['t'] or 0
        donations_cash = incomes_today.filter(Q(payment_method__iexact='CASH') | Q(account_type='CASH')).aggregate(t=Sum('amount'))['t'] or 0
        donations_bank = float(donations_today) - float(donations_cash)
        
        # Membership amount collected today
        from hr_module.models import MembershipReceipt
        membership_amount = MembershipReceipt.objects.filter(member__created_by=user, generated_at__date=today).aggregate(t=Sum('amount'))['t'] or 0
        
        # Assessments submitted today by this user
        from manager_module.models import AssessmentRequest
        assessments_today = AssessmentRequest.objects.filter(requested_by=user, created_at__date=today).count()
        
        # Attendance Percentage Calculation
        officer = get_officer_for_user(user)
        attendance_percentage = 0
        if officer:
            eff_date = get_attendance_effective_date()
            month_records = Attendance.objects.filter(
                employee=officer,
                date__month=eff_date.month,
                date__year=eff_date.year
            )
            days_elapsed = max(1, eff_date.day)
            present_days = month_records.filter(status='PRESENT').count()
            attendance_percentage = min(100, round((present_days / days_elapsed) * 100))

        return Response({
            'members': members_today,
            'donations': float(donations_today),
            'cash_donations': float(donations_cash),
            'bank_donations': float(donations_bank),
            'membership_amount': float(membership_amount),
            'assessments': assessments_today,
            'attendancePercentage': attendance_percentage,
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
        member = serializer.save(created_by=self.request.user)
        push_dashboard_refresh(['HR', 'MANAGER', 'ADMIN', 'STAFF'])

        # Automated Membership Payment & Receipt Workflow
        if member.phone:
            try:
                from hr_module.models import MembershipReceipt
                from django.core.files.base import ContentFile
                from notify.whatsapp_service import send_whatsapp_message

                # 1. Create Receipt Record & Unique Receipt Number
                receipt = MembershipReceipt.objects.create(
                    member=member,
                    amount=getattr(member, 'monthly_fee', 100.00) or 100.00
                )

                # Create matching Income record to track Cash/Bank properly
                from accounts_module.models import Income
                payment_mode = self.request.data.get('payment_mode', 'CASH')
                transaction_id = self.request.data.get('transaction_id', '')
                Income.objects.create(
                    donor_name=member.full_name,
                    donor_phone=member.phone,
                    source='MEMBERSHIP',
                    amount=receipt.amount,
                    payment_method=payment_mode,
                    reference_number=transaction_id,
                    account_type='BANK' if payment_mode in ['UPI', 'NEFT', 'RTGS', 'IMPS'] else 'CASH',
                    created_by=self.request.user
                )

                # 2. Generate A4 PDF Document
                try:
                    num_val = int(str(member.member_id).replace('MEM-', ''))
                    formatted_mem_id = f"{num_val:04d}"
                except Exception:
                    formatted_mem_id = f"{member.member_id}"

                pdf_bytes = generate_member_receipt_pdf_bytes(
                    member,
                    receipt_number=receipt.receipt_number,
                    membership_id=formatted_mem_id,
                    amount=float(receipt.amount)
                )

                # 3. Save PDF File & Dynamic Image Card File securely
                file_name = f"SLCT_Membership_Receipt_{member.member_id}_{member.joining_date}.pdf"
                receipt.pdf_file.save(file_name, ContentFile(pdf_bytes), save=True)

                # Save dynamic PNG Receipt Image Card using default_storage
                from django.core.files.storage import default_storage
                img_bytes = generate_member_receipt_image_bytes(
                    member,
                    receipt_number=receipt.receipt_number,
                    membership_id=formatted_mem_id,
                    amount=float(receipt.amount)
                )
                img_file_path = f"membership_receipts/SLCT_Receipt_Image_{member.member_id}_{member.joining_date}.png"
                if default_storage.exists(img_file_path):
                    default_storage.delete(img_file_path)
                saved_path = default_storage.save(img_file_path, ContentFile(img_bytes))

                # 4. Build absolute URIs for WhatsApp delivery
                pdf_url = self.request.build_absolute_uri(receipt.pdf_file.url)
                img_url = default_storage.url(saved_path)
                if img_url.startswith('/'):
                    img_url = self.request.build_absolute_uri(img_url)

                # 5. Formatted WhatsApp Message with Rich Image Card & Social Links
                msg = (
                    f"Dear {member.full_name},\n\n"
                    f"Thank you for becoming a member of Sree Lakshmi Charitable Trust.\n\n"
                    f"Your membership payment of ₹{receipt.amount:,.2f} has been successfully received.\n\n"
                    f"🪪 Membership ID: {formatted_mem_id}\n"
                    f"📄 Receipt No.: {receipt.receipt_number}\n\n"
                    f"Please find your official membership receipt attached.\n\n"
                    f"Thank you for supporting our mission.\n"
                    f"Sree Lakshmi Charitable Trust\n\n"
                    f"📱 Instagram: https://www.instagram.com/sreelakshmicharity?igsh=MWFna2dnYnFsdDRmbQ==\n"
                    f"📘 Facebook: https://www.facebook.com/share/1BZ1MR7HzA/?mibextid=wwXIfr\n"
                    f"🌐 Website: https://sreelakshmicharity.org"
                )

                res = send_whatsapp_message(
                    to_phone=member.phone,
                    message_body=msg,
                    image_url=img_url
                )

                if res.get('success'):
                    receipt.whatsapp_status = 'SENT'
                else:
                    receipt.whatsapp_status = 'FAILED'
                receipt.save()

            except Exception:
                pass

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


class MemberCertificateView(APIView):
    """Public viewable digital membership card & printable certificate."""
    permission_classes = []

    def get(self, request, pk):
        try:
            member = Member.objects.get(pk=pk)
        except Member.DoesNotExist:
            return Response({'error': 'Member not found'}, status=404)

        html_content = generate_member_certificate_html(member)
        return HttpResponse(html_content, content_type='text/html')


class MemberPdfView(APIView):
    """Downloads binary PDF document for a member receipt."""
    permission_classes = []

    def get(self, request, pk):
        try:
            member = Member.objects.get(pk=pk)
        except Member.DoesNotExist:
            return Response({'error': 'Member not found'}, status=404)

        pdf_bytes = generate_member_receipt_pdf_bytes(member)
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="SLCT_Membership_Receipt_{member.member_id}.pdf"'
        return response


class MemberImageView(APIView):
    """Generates and serves binary PNG image card for a member receipt."""
    permission_classes = []

    def get(self, request, pk):
        try:
            member = Member.objects.get(pk=pk)
        except Member.DoesNotExist:
            return Response({'error': 'Member not found'}, status=404)

        from hr_module.models import MembershipReceipt
        last_receipt = MembershipReceipt.objects.filter(member=member).first()
        receipt_no = last_receipt.receipt_number if last_receipt else None
        amount = float(last_receipt.amount) if last_receipt else None
        try:
            num_val = int(member.member_id.replace('MEM-', ''))
            mem_id_val = f"SLCT/MEM/{num_val:04d}"
        except Exception:
            mem_id_val = f"SLCT/MEM/{member.member_id}"

        img_bytes = generate_member_receipt_image_bytes(member, receipt_number=receipt_no, membership_id=mem_id_val, amount=amount)
        return HttpResponse(img_bytes, content_type='image/png')


class RetryWhatsAppView(APIView):
    """Retries WhatsApp dispatch for a MembershipReceipt if status was FAILED."""
    permission_classes = [IsAnyStaff]

    def post(self, request, pk):
        try:
            from hr_module.models import MembershipReceipt
            receipt = MembershipReceipt.objects.get(pk=pk)
        except MembershipReceipt.DoesNotExist:
            return Response({'error': 'Receipt not found'}, status=404)

        member = receipt.member
        if not member or not member.phone:
            return Response({'error': 'Member phone number missing'}, status=400)

        from notify.whatsapp_service import send_whatsapp_message
        from django.core.files.storage import default_storage
        from django.core.files.base import ContentFile

        img_file_path = f"membership_receipts/SLCT_Receipt_Image_{member.member_id}_{member.joining_date}.png"

        try:
            num_val = int(str(member.member_id).replace('MEM-', ''))
            formatted_mem_id = f"{num_val:04d}"
        except Exception:
            formatted_mem_id = f"{member.member_id}"

        # Ensure dynamic PNG image card exists in storage
        if not default_storage.exists(img_file_path):
            img_bytes = generate_member_receipt_image_bytes(
                member,
                receipt_number=receipt.receipt_number,
                membership_id=formatted_mem_id,
                amount=float(receipt.amount)
            )
            default_storage.save(img_file_path, ContentFile(img_bytes))

        img_url = default_storage.url(img_file_path)
        if img_url.startswith('/'):
            img_url = request.build_absolute_uri(img_url)

        msg = (
            f"Dear {member.full_name},\n\n"
            f"Thank you for becoming a member of Sree Lakshmi Charitable Trust.\n\n"
            f"Your membership payment of ₹{receipt.amount:,.2f} has been successfully received.\n\n"
            f"🪪 Membership ID: {formatted_mem_id}\n"
            f"📄 Receipt No.: {receipt.receipt_number}\n\n"
            f"Please find your official membership receipt attached.\n\n"
            f"Thank you for supporting our mission.\n"
            f"Sree Lakshmi Charitable Trust\n\n"
            f"📱 Instagram: https://www.instagram.com/sreelakshmicharity?igsh=MWFna2dnYnFsdDRmbQ==\n"
            f"📘 Facebook: https://www.facebook.com/share/1BZ1MR7HzA/?mibextid=wwXIfr\n"
            f"🌐 Website: https://sreelakshmicharity.org"
        )

        res = send_whatsapp_message(
            to_phone=member.phone,
            message_body=msg,
            image_url=img_url
        )

        if res.get('success'):
            receipt.whatsapp_status = 'SENT'
            receipt.save()
            return Response({'message': 'WhatsApp receipt sent successfully', 'status': 'SENT'})
        else:
            receipt.whatsapp_status = 'FAILED'
            receipt.save()
            return Response({'error': 'WhatsApp dispatch failed', 'status': 'FAILED'}, status=500)


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
# ── Complaints ────────────────────────────────────────────────────
class ComplaintListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAnyStaff]
    serializer_class = ComplaintSerializer
    filterset_fields = ['status', 'employee']
    search_fields = ['complaint_id', 'title']

    def get_queryset(self):
        qs = Complaint.objects.select_related('employee').all()
        user_role = getattr(self.request.user, 'role', '')
        # If user is a regular mobile app user (not admin/manager/hr), only show their own complaints
        if user_role not in ['ADMIN', 'MANAGER', 'HR', 'ACCOUNTANT']:
            officer = get_officer_for_user(self.request.user)
            if officer:
                qs = qs.filter(employee=officer)
        return qs

    def perform_create(self, serializer):
        emp = serializer.validated_data.get('employee')
        if not emp:
            emp = get_officer_for_user(self.request.user)
        instance = serializer.save(employee=emp)
        push_to_role(
            role='HR',
            notification_type='NEW_COMPLAINT',
            title='New Complaint Raised',
            message=f"Complaint {instance.complaint_id} raised by {emp.full_name if emp else self.request.user.full_name}."
        )


class ComplaintDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAnyStaff]
    serializer_class = ComplaintSerializer
    queryset = Complaint.objects.all()

    def perform_update(self, serializer):
        instance = serializer.save()
        if instance.status in ['RESOLVED', 'REJECTED']:
            push_to_role(
                role='STAFF',
                notification_type='COMPLAINT_UPDATE',
                title=f"Complaint {instance.status}",
                message=f"Your complaint '{instance.complaint_id}' has been marked as {instance.status}."
            )


# ── Staff Reports ──────────────────────────────────────────────────
class StaffReportListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAnyStaff]
    serializer_class = StaffReportSerializer
    filterset_fields = ['status', 'employee']
    search_fields = ['report_id', 'title']
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        qs = StaffReport.objects.select_related('employee', 'submitted_by').all()
        user_role = getattr(self.request.user, 'role', '')
        if user_role not in ['ADMIN', 'MANAGER', 'HR', 'ACCOUNTANT']:
            officer = get_officer_for_user(self.request.user)
            qs = qs.filter(Q(submitted_by=self.request.user) | Q(employee=officer))
        return qs

    def perform_create(self, serializer):
        emp = serializer.validated_data.get('employee')
        if not emp:
            emp = get_officer_for_user(self.request.user)
        report = serializer.save(submitted_by=self.request.user, employee=emp)
        push_to_role(
            role='HR',
            notification_type='NEW_STAFF_REPORT',
            title='New Staff Report Submitted',
            message=f"Report '{report.title}' submitted by {self.request.user.full_name}."
        )

# ── Staff Reports ──────────────────────────────────────────────────
class StaffReportDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAnyStaff]
    serializer_class = StaffReportSerializer
    queryset = StaffReport.objects.all()
    parser_classes = [MultiPartParser, FormParser, JSONParser]


class SalaryBalanceView(APIView):
    permission_classes = [IsAnyStaff]

    def get(self, request):
        officer = get_officer_for_user(request.user)
        if not officer:
            return Response({'salary': 0, 'balance': 0}, status=200)

        from hr_module.models import SalaryStructure
        try:
            salary_struct = SalaryStructure.objects.get(employee=officer, is_active=True)
            net_salary = float(salary_struct.net_salary)
        except SalaryStructure.DoesNotExist:
            net_salary = 0

        # Calculate current month's approved advances to determine balance
        from django.utils import timezone
        now = timezone.now()
        advances = PaymentAdvanceRequest.objects.filter(
            employee=officer,
            created_at__year=now.year,
            created_at__month=now.month,
            status__in=['APPROVED', 'DISBURSED']
        )
        total_advances = sum(float(a.amount) for a in advances)
        balance = net_salary - total_advances

        return Response({
            'salary': net_salary,
            'balance': balance if balance > 0 else 0,
            'total_advances': total_advances
        })

# ── Payment Advance Requests ──────────────────────────────────────
class PaymentAdvanceListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAnyStaff]
    serializer_class = PaymentAdvanceRequestSerializer
    filterset_fields = ['status', 'employee']
    search_fields = ['request_id', 'reason']

    def get_queryset(self):
        qs = PaymentAdvanceRequest.objects.select_related('employee', 'requested_by').all()
        user_role = getattr(self.request.user, 'role', '')
        if user_role not in ['ADMIN', 'MANAGER', 'HR', 'ACCOUNTANT']:
            officer = get_officer_for_user(self.request.user)
            qs = qs.filter(Q(requested_by=self.request.user) | Q(employee=officer))
        return qs

    def perform_create(self, serializer):
        emp = serializer.validated_data.get('employee')
        if not emp:
            emp = get_officer_for_user(self.request.user)
        advance = serializer.save(requested_by=self.request.user, employee=emp)
        push_to_role(
            role='HR',
            notification_type='NEW_PAYMENT_ADVANCE',
            title='Salary Advance Request Received',
            message=f"{self.request.user.full_name} requested ₹{advance.amount} needed by {advance.needed_by_date}."
        )


class PaymentAdvanceDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAnyStaff]
    serializer_class = PaymentAdvanceRequestSerializer
    queryset = PaymentAdvanceRequest.objects.all()


class PaymentAdvanceApprovalView(APIView):
    permission_classes = [IsHR]

    def post(self, request, pk):
        action = request.data.get('action')  # approve / reject / disburse
        payout_date = request.data.get('payout_date')
        remarks = request.data.get('hr_remarks', '')

        try:
            advance = PaymentAdvanceRequest.objects.get(pk=pk)
        except PaymentAdvanceRequest.DoesNotExist:
            return Response({'error': 'Advance request not found.'}, status=404)

        if action == 'approve':
            advance.status = 'APPROVED'
            if payout_date:
                advance.payout_date = payout_date
            advance.hr_remarks = remarks
        elif action == 'reject':
            advance.status = 'REJECTED'
            advance.hr_remarks = remarks
        elif action == 'disburse':
            advance.status = 'DISBURSED'
            advance.hr_remarks = remarks
        else:
            return Response({'error': 'Invalid action'}, status=400)

        advance.save()
        push_to_role(
            role='STAFF',
            notification_type='ADVANCE_STATUS_UPDATE',
            title=f"Advance Request {advance.status}",
            message=f"Your advance request {advance.request_id} is now {advance.status}."
        )
        return Response(PaymentAdvanceRequestSerializer(advance).data)


# ── Performance Points (Achieved Points) ──────────────────────────
class PerformancePointListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAnyStaff]
    serializer_class = PerformancePointSerializer
    filterset_fields = ['employee', 'month', 'year']

    def get_queryset(self):
        qs = PerformancePoint.objects.select_related('employee', 'awarded_by').all()
        user_role = getattr(self.request.user, 'role', '')
        if user_role not in ['ADMIN', 'MANAGER', 'HR', 'ACCOUNTANT']:
            officer = get_officer_for_user(self.request.user)
            if officer:
                qs = qs.filter(employee=officer)
        return qs

    def perform_create(self, serializer):
        serializer.save(awarded_by=self.request.user)


class PerformancePointLeaderboardView(APIView):
    permission_classes = [IsAnyStaff]

    def get(self, request):
        from django.db.models import Sum
        today = timezone.now().date()
        try:
            month = int(request.query_params.get('month', today.month))
            year = int(request.query_params.get('year', today.year))
        except (ValueError, TypeError):
            month = today.month
            year = today.year

        # Aggregate points per employee for the specified month/year
        scores = (
            PerformancePoint.objects.filter(month=month, year=year)
            .values('employee', 'employee__full_name', 'employee__employee_id', 'employee__designation')
            .annotate(total_points=Sum('points'))
            .order_by('-total_points')
        )

        leaderboard = []
        best_performer = None

        for rank, s in enumerate(scores, 1):
            item = {
                'rank': rank,
                'employee_id': str(s['employee']),
                'emp_code': s['employee__employee_id'],
                'full_name': s['employee__full_name'],
                'designation': s['employee__designation'],
                'total_points': s['total_points'],
            }
            leaderboard.append(item)
            if rank == 1:
                best_performer = item

        # Also get current user's personal stats
        user_officer = get_officer_for_user(request.user)
        my_stats = None
        if user_officer:
            my_m_points = PerformancePoint.objects.filter(
                employee=user_officer, month=month, year=year
            ).aggregate(t=Sum('points'))['t'] or 0

            my_total_all_time = PerformancePoint.objects.filter(
                employee=user_officer
            ).aggregate(t=Sum('points'))['t'] or 0

            history_qs = PerformancePoint.objects.filter(employee=user_officer)[:10]

            my_stats = {
                'officer_id': str(user_officer.id),
                'full_name': user_officer.full_name,
                'month_points': my_m_points,
                'all_time_points': my_total_all_time,
                'history': PerformancePointSerializer(history_qs, many=True).data
            }

        return Response({
            'month': month,
            'year': year,
            'best_performer': best_performer,
            'leaderboard': leaderboard,
            'my_stats': my_stats
        })


def get_attendance_effective_date():
    """Returns the effective attendance date based on an 8:00 AM daily reset cycle."""
    now_local = timezone.localtime(timezone.now())
    if now_local.hour < 8:
        return (now_local - timezone.timedelta(days=1)).date()
    return now_local.date()


# ── Staff Attendance View ──────────────────────────────────────────
class StaffAttendanceView(APIView):
    permission_classes = [IsAnyStaff]

    def get(self, request):
        officer = get_officer_for_user(request.user)
        if not officer:
            return Response({'error': 'No officer profile found.'}, status=404)

        effective_date = get_attendance_effective_date()
        today_record = Attendance.objects.filter(employee=officer, date=effective_date).first()

        # Monthly records
        now_local = timezone.localtime(timezone.now())
        records = Attendance.objects.filter(
            employee=officer,
            date__month=now_local.month,
            date__year=now_local.year
        ).order_by('-date')

        return Response({
            'officer_name': officer.full_name,
            'today': AttendanceSerializer(today_record).data if today_record else None,
            'monthly_records': AttendanceSerializer(records, many=True).data,
            'effective_date': effective_date.isoformat(),
        })

    def post(self, request):
        officer = get_officer_for_user(request.user)
        if not officer:
            return Response({'error': 'No officer profile found.'}, status=404)

        effective_date = get_attendance_effective_date()
        now_time = timezone.localtime(timezone.now()).time()
        action = request.data.get('action', 'check_in')  # check_in or check_out

        att, created = Attendance.objects.get_or_create(
            employee=officer, date=effective_date,
            defaults={'status': 'PRESENT', 'marked_by': request.user}
        )

        if action == 'check_in':
            if not att.check_in:
                att.check_in = now_time
                att.status = 'PRESENT'
                att.save()
        elif action == 'check_out':
            att.check_out = now_time
            if att.check_in:
                # calculate working hours simple estimate
                h = (now_time.hour - att.check_in.hour) + (now_time.minute - att.check_in.minute)/60.0
                att.working_hours = round(max(0, h), 2)
            att.save()

        return Response(AttendanceSerializer(att).data)


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


# ── Leaderboard ──────────────────────────────────────────────────

class StaffLeaderboardView(APIView):
    permission_classes = [IsAnyStaff]

    def get(self, request, *args, **kwargs):
        from accounts_module.models import Income
        from django.db.models import Sum
        from core.models import User, Role
        from datetime import datetime
        
        date_str = request.query_params.get('date')
        if date_str:
            try:
                target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            except ValueError:
                target_date = timezone.now().date()
        else:
            target_date = timezone.now().date()
        
        # Get list of names for staff who are PRESENT on target_date (ignoring case)
        present_staff_names = Attendance.objects.filter(
            date=target_date, status='PRESENT'
        ).values_list('employee__full_name', flat=True)
        
        present_users = User.objects.filter(role=Role.STAFF)
        
        results = []
        for user in present_users:
            is_present = any(user.full_name.lower() == name.lower() for name in present_staff_names)
            if not is_present:
                continue
                
            total_collection = Income.objects.filter(
                date=target_date, created_by=user
            ).aggregate(t=Sum('amount'))['t'] or 0
            
            results.append({
                'staff_id': str(user.id),
                'name': user.full_name,
                'photo_url': request.build_absolute_uri(user.photo.url) if user.photo else None,
                'amount': float(total_collection)
            })
            
        results.sort(key=lambda x: x['amount'], reverse=True)
        
        # Add rank
        for idx, item in enumerate(results):
            item['rank'] = idx + 1
            
        limit = request.query_params.get('limit')
        if limit and limit.isdigit():
            results = results[:int(limit)]
            
        return Response(results)

