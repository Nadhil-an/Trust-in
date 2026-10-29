"""HR Module Views"""
from django.http import HttpResponse
from django.utils import timezone
from django.db.models import Count, Q
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from core.permissions import IsHR, IsManagerOrHR, IsAnyStaff, IsOwnerOrManager, IsOwnerOrManagerOrHR
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from hr_module.models import VolunteerStatus
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


def sync_member_user_account(member, password=None, username=None, request_user=None):
    """
    Finds or creates a User account with role MEMBER for the given Member in the database (PostgreSQL in prod).
    Updates username if provided.
    Updates password if provided.
    """
    if not member:
        return None

    import re
    from core.models import User, Role, AuditLog
    from django.db.models import Q

    clean_phone = re.sub(r'[^0-9]', '', str(member.phone or ''))[-10:]
    clean_mem_id = str(member.member_id or '').replace('MEM-', '').strip()
    target_username = (username or '').strip()

    matched_users = []

    # 1. By member.created_by if that user is a MEMBER
    if member.created_by and getattr(member.created_by, 'role', None) == Role.MEMBER:
        matched_users.append(member.created_by)

    # 2. By target_username if provided
    if target_username:
        for u in User.objects.filter(role=Role.MEMBER, username__iexact=target_username):
            if u not in matched_users:
                matched_users.append(u)

    # 3. By phone number (check username or phone)
    if clean_phone:
        for u in User.objects.filter(role=Role.MEMBER).filter(Q(username__iexact=clean_phone) | Q(username__iexact=str(member.phone).strip())):
            if u not in matched_users:
                matched_users.append(u)
        for u in User.objects.filter(role=Role.MEMBER).iterator():
            if u.phone and u.phone.strip() in [clean_phone, str(member.phone).strip()] and u not in matched_users:
                matched_users.append(u)

    # 4. By member_id
    if member.member_id:
        for u in User.objects.filter(role=Role.MEMBER).filter(Q(username__iexact=member.member_id) | Q(username__iexact=clean_mem_id)):
            if u not in matched_users:
                matched_users.append(u)

    # 5. By email
    if member.email:
        for u in User.objects.filter(role=Role.MEMBER, email__iexact=member.email.strip()):
            if u not in matched_users:
                matched_users.append(u)

    # 6. By full_name (Name)
    if member.full_name:
        for u in User.objects.filter(role=Role.MEMBER, full_name__iexact=member.full_name.strip()):
            if u not in matched_users:
                matched_users.append(u)

    if matched_users:
        for u in matched_users:
            if password and str(password).strip():
                u.set_password(str(password).strip())
                u.failed_login_attempts = 0
                u.locked_until = None
            if target_username and target_username != u.username:
                if not User.objects.filter(username__iexact=target_username).exclude(id=u.id).exists():
                    u.username = target_username
            u.is_active = (member.status == 'ACTIVE')
            if member.phone and not u.phone:
                u.phone = member.phone
            if member.full_name and u.full_name != member.full_name:
                u.full_name = member.full_name
            if member.email and str(member.email).strip() and u.email != str(member.email).strip():
                if not User.objects.filter(email__iexact=str(member.email).strip()).exclude(id=u.id).exists():
                    u.email = str(member.email).strip()
            u.save()
        primary_user = matched_users[0]
    else:
        # Create a new User account for this Member in database
        base_username = target_username or clean_phone or clean_mem_id or (member.phone or member.full_name.lower().replace(' ', '_'))
        username_val = base_username
        counter = 1
        while User.objects.filter(username__iexact=username_val).exists():
            username_val = f"{base_username}_{counter}"
            counter += 1

        email_val = (member.email or '').strip()
        if not email_val or User.objects.filter(email__iexact=email_val).exists():
            email_val = f"{username_val}@member.local"

        pass_to_set = str(password).strip() if (password and str(password).strip()) else f"Member@{clean_phone[-4:] if len(clean_phone)>=4 else '1234'}"

        primary_user = User.objects.create_user(
            username=username_val,
            email=email_val,
            password=pass_to_set,
            full_name=member.full_name,
            phone=member.phone or '',
            role=Role.MEMBER,
            is_active=(member.status == 'ACTIVE')
        )

    # Link member.created_by directly to primary_user
    if member.created_by != primary_user:
        member.created_by = primary_user
        member.save(update_fields=['created_by'])

    # Record Audit Log
    operator_name = getattr(request_user, 'full_name', 'HR/Manager') if request_user else 'HR/Manager'
    AuditLog.objects.create(
        user=request_user if getattr(request_user, 'is_authenticated', False) else None,
        action='RESET_PASSWORD' if (password and str(password).strip()) else 'UPDATE_MEMBER_USER',
        module='HR',
        record_type='User',
        record_id=str(primary_user.id),
        reference_number=member.member_id,
        description=f"User {primary_user.username} synced for member {member.full_name} ({member.member_id}) by {operator_name}"
    )
    return primary_user


def sync_member_user_password(member, password, request_user=None):
    return sync_member_user_account(member, password=password, request_user=request_user)



class HRDashboardView(APIView):
    permission_classes = [IsHR]

    def get(self, request):
        today = timezone.localdate()
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

        try:
            ensure_member_records_for_users()
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"[HRDashboardView] Error ensuring member records: {e}")

        from core.models import Role
        phone_signup_count = Member.objects.filter(created_by__role=Role.MEMBER).count()

        return Response({
            'members': {'total': Member.objects.count(), 'active': Member.objects.filter(status='ACTIVE').count()},
            'phone_signup_members': phone_signup_count,
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
                Member.objects.order_by('-created_at')[:20], many=True
            ).data,
        })


class StaffDashboardView(APIView):
    permission_classes = [IsAnyStaff]

    def get(self, request):
        user = request.user
        date_str = request.query_params.get('date')
        if date_str:
            from datetime import datetime
            try:
                today = datetime.strptime(date_str, '%Y-%m-%d').date()
            except ValueError:
                today = timezone.localtime(timezone.now()).date()
        else:
            today = timezone.localtime(timezone.now()).date()
        
        # Members added on the selected date by this user
        members_today = Member.objects.filter(created_by=user, created_at__date=today).count()
        
        # Donations collected today by this user — filter by CREATION time, not assigned date
        # This ensures entries show up immediately after submission regardless of rollover logic
        from accounts_module.models import Income
        from django.db.models import Sum, Q
        
        incomes_today = Income.objects.filter(created_by=user, created_at__date=today)
        donations_today = incomes_today.aggregate(t=Sum('amount'))['t'] or 0
        donations_cash = incomes_today.filter(account_type='CASH').aggregate(t=Sum('amount'))['t'] or 0
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

# ── Member Expiry & Validity Synchronization ────────────────────────
def calculate_member_validity(member):
    """
    Calculates member subscription validity, expiration date, and status.
    Lifetime/Honorary/Patron memberships never expire.
    General/Associate memberships expire 1 month after the latest of:
      - Latest MembershipReceipt
      - Latest Income record (source='MEMBERSHIP')
      - Member joining date
    """
    from datetime import date
    from django.utils import timezone
    from dateutil.relativedelta import relativedelta
    from django.db.models import Q
    from hr_module.models import MembershipType, MembershipReceipt
    from accounts_module.models import Income
    import re

    today = timezone.localdate()

    if member.membership_type in [MembershipType.LIFE, MembershipType.HONORARY, MembershipType.PATRON]:
        return {
            'valid_upto': None,
            'valid_upto_str': 'Lifetime',
            'days_left': 99999,
            'is_expired': False,
            'is_active': True,
            'latest_payment_date': None,
        }

    # For General / monthly members:
    receipt = MembershipReceipt.objects.filter(member=member).order_by('-generated_at').first()

    q = Q(donor_name__iexact=member.full_name.strip())
    if member.phone:
        clean_p = re.sub(r'[^0-9]', '', str(member.phone))[-10:]
        if clean_p:
            q |= Q(donor_phone__icontains=clean_p)
    if member.created_by:
        q |= Q(created_by=member.created_by)

    income = Income.objects.filter(source='MEMBERSHIP').filter(q).order_by('-date', '-created_at').first()

    dates = []
    if receipt and receipt.generated_at:
        dates.append(receipt.generated_at.date())
    if income:
        if income.date:
            dates.append(income.date)
        elif income.created_at:
            dates.append(income.created_at.date())
    if member.joining_date:
        dates.append(member.joining_date)

    latest_date = max(dates) if dates else (member.joining_date or today)
    valid_date = latest_date + relativedelta(months=1)
    days_left = (valid_date - today).days
    is_expired = (days_left < 0)

    return {
        'valid_upto': valid_date,
        'valid_upto_str': valid_date.strftime('%d %b %Y'),
        'days_left': days_left,
        'is_expired': is_expired,
        'is_active': not is_expired,
        'latest_payment_date': latest_date,
    }


def sync_member_subscription_status(member, notify=True):
    """
    Evaluates member validity.
    If membership has expired and status is currently ACTIVE:
      - Sets status to EXPIRED
      - Pushes high-priority notifications to MANAGER and HR dashboards
      - Emits dashboard refresh
    If membership is renewed and status is EXPIRED:
      - Sets status back to ACTIVE
    """
    from hr_module.models import MemberStatus
    from core.models import SystemNotification
    from notify.service import push_to_role, push_dashboard_refresh

    validity = calculate_member_validity(member)
    today = timezone.localdate()

    if validity['is_expired']:
        # Transition from ACTIVE -> EXPIRED
        if member.status == MemberStatus.ACTIVE:
            member.status = MemberStatus.EXPIRED
            member.save(update_fields=['status'])

            if notify:
                # Prevent spam: check if notification was already sent in last 25 days for this member
                already_notified = SystemNotification.objects.filter(
                    notification_type='MEMBERSHIP_EXPIRED',
                    reference_id=str(member.id),
                    created_at__gte=timezone.now() - timezone.timedelta(days=25)
                ).exists()

                if not already_notified:
                    valid_str = validity.get('valid_upto_str', 'recently')
                    title = f"Membership Expired: {member.full_name}"
                    message = (
                        f"The membership for {member.full_name} (ID: {member.member_id}, "
                        f"Phone: {member.phone or 'N/A'}) expired on {valid_str}. "
                        f"Status has been updated to EXPIRED."
                    )
                    # Push to HR, Manager, and Admin dashboards
                    push_to_role('HR', title, message, 'MEMBERSHIP_EXPIRED', reference_id=str(member.id), priority='HIGH', reference_type='MEMBER')
                    push_to_role('MANAGER', title, message, 'MEMBERSHIP_EXPIRED', reference_id=str(member.id), priority='HIGH', reference_type='MEMBER')
                    push_to_role('ADMIN', title, message, 'MEMBERSHIP_EXPIRED', reference_id=str(member.id), priority='HIGH', reference_type='MEMBER')
                    push_dashboard_refresh(['HR', 'MANAGER', 'ADMIN'])

    else:
        # If valid and currently EXPIRED (e.g. member paid renewal fee), restore to ACTIVE
        if member.status == MemberStatus.EXPIRED:
            member.status = MemberStatus.ACTIVE
            member.save(update_fields=['status'])
            push_dashboard_refresh(['HR', 'MANAGER', 'ADMIN'])

    return validity


def ensure_member_records_for_users():
    """
    Guarantees every User with role=Role.MEMBER (all phone signups and mobile members)
    has a corresponding Member entry in hr_members, so they display in the HR dashboard.
    """
    from core.models import User, Role
    from hr_module.models import Member
    import re
    member_users = User.objects.filter(role=Role.MEMBER)
    for u in member_users:
        m = Member.objects.filter(created_by=u).first()
        if not m and u.phone:
            clean_p = re.sub(r'\D', '', str(u.phone))[-10:]
            if clean_p:
                for cand in Member.objects.all():
                    if cand.phone and re.sub(r'\D', '', str(cand.phone))[-10:] == clean_p:
                        m = cand
                        if not m.created_by:
                            m.created_by = u
                            m.save(update_fields=['created_by'])
                        break
        if not m:
            clean_phone_val = re.sub(r'\D', '', str(u.phone or ''))[-10:] if u.phone else ''
            Member.objects.create(
                full_name=u.full_name or u.username,
                phone=clean_phone_val or u.phone or '',
                email=u.email if not (u.email or '').endswith('@member.local') else '',
                created_by=u,
                status='ACTIVE' if u.is_active else 'INACTIVE',
                membership_type='GENERAL',
            )


def sync_all_members_expiry(notify=True):
    """
    Scans all ACTIVE members that are subject to expiry, sets expired members to EXPIRED,
    and sends real-time notifications to the Manager and HR dashboards.
    """
    from hr_module.models import Member, MemberStatus, MembershipType
    members_to_check = Member.objects.filter(
        status=MemberStatus.ACTIVE
    ).exclude(membership_type__in=[MembershipType.LIFE, MembershipType.HONORARY, MembershipType.PATRON])

    for m in members_to_check:
        try:
            sync_member_subscription_status(m, notify=notify)
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Error syncing expiry for member {m.id}: {e}")


# ── Members ───────────────────────────────────────────────────────
class MemberListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAnyStaff]
    serializer_class = MemberSerializer
    filterset_fields = ['status', 'membership_type', 'gender']
    search_fields = ['member_id', 'full_name', 'phone', 'email']
    ordering_fields = ['full_name', 'joining_date', 'created_at']
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        # Automatically ensure all phone signups and member users have Member records
        try:
            ensure_member_records_for_users()
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"[MemberListCreateView] Error ensuring member records: {e}")

        # Automatically verify and sync expired memberships with notifications to HR & Manager
        try:
            sync_all_members_expiry(notify=True)
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"[MemberListCreateView] Error syncing member expiries: {e}")

        qs = Member.objects.all()
        # If the user is STAFF (and not manager/admin/hr), only show members they added
        from core.models import Role
        if self.request.user.role == Role.STAFF:
            qs = qs.filter(created_by=self.request.user)
        return qs

    def perform_create(self, serializer):
        import logging
        logger = logging.getLogger(__name__)

        member = serializer.save(created_by=self.request.user)
        password = self.request.data.get('password')
        if password and str(password).strip():
            sync_member_user_password(member, str(password).strip(), request_user=self.request.user)
        push_dashboard_refresh(['HR', 'MANAGER', 'ADMIN', 'STAFF'])

        # Automated Membership Payment & Receipt Workflow
        try:
            from hr_module.models import MembershipReceipt
            from django.core.files.base import ContentFile
            from notify.whatsapp_service import send_whatsapp_message
            from accounts_module.models import Income

            # Determine effective date based on whether today's register is closed
            from datetime import date, timedelta
            from hr_module.models import PromoterRegistryEntry
            effective_date = date.today()
            registry = PromoterRegistryEntry.objects.filter(promoter=self.request.user, date=effective_date).first()
            if registry and registry.is_closed:
                effective_date = effective_date + timedelta(days=1)

            receipt = MembershipReceipt.objects.create(
                member=member,
                amount=getattr(member, 'monthly_fee', 100.00) or 100.00
            )

            # Create matching Income record to track Cash/Bank properly
            payment_mode = self.request.data.get('payment_mode', 'CASH')
            transaction_id = self.request.data.get('transaction_id', '')
            voucher_id = self.request.data.get('voucher_id', '')
            
            # Extract document if uploaded (e.g. receipt photo for missing phone numbers)
            document = self.request.FILES.get('document')

            Income.objects.create(
                donor_name=member.full_name,
                donor_phone=member.phone,
                source='MEMBERSHIP',
                amount=receipt.amount,
                payment_method=payment_mode,
                reference_number=voucher_id or transaction_id,
                account_type='BANK' if payment_mode in ['UPI', 'NEFT', 'RTGS', 'IMPS'] else 'CASH',
                document=document,
                created_by=self.request.user,
                date=effective_date
            )

            # --- Auto-Increment Voucher atomically ---
            from hr_module.models import StaffVoucherBook
            vb = StaffVoucherBook.objects.filter(staff=self.request.user).first()
            if vb and vb.book_number > 0 and str(vb.current_voucher) == str(voucher_id or transaction_id):
                try:
                    vb.increment()
                except ValueError:
                    pass
            # -----------------------------------------

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

            if member.phone:
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

                # 4. Build final image URL — R2 URLs are already absolute
                img_url = default_storage.url(saved_path)
                if img_url.startswith('/'):
                    scheme = self.request.scheme
                    host = self.request.get_host()
                    img_url = f"{scheme}://{host}{img_url}"

                receipt_id = receipt.id

                # 5. Dispatch WhatsApp in background thread so it doesn't block the API response
                import threading
                def dispatch_whatsapp():
                    try:
                        from hr_module.models import MembershipReceipt as MR
                        r = MR.objects.get(id=receipt_id)
                        msg = (
                            f"Dear {member.full_name},\n\n"
                            f"Thank you for becoming a member of *Sree Lakshmi Charitable Trust*.\n\n"
                            f"Your membership payment of \u20b9{r.amount:,.2f} has been successfully received.\n\n"
                            f"\U0001faaa Membership ID: *{formatted_mem_id}*\n"
                            f"\U0001f4c4 Voucher ID: *{voucher_id or r.receipt_number}*\n\n"
                            f"Please find your official membership receipt attached.\n\n"
                            f"Thank you for supporting our mission.\n"
                            f"*Sree Lakshmi Charitable Trust*\n\n"
                            f"\U0001f4f1 Instagram: https://www.instagram.com/sreelakshmicharity?igsh=MWFna2dnYnFsdDRmbQ==\n"
                            f"\U0001f4d8 Facebook: https://www.facebook.com/share/1BZ1MR7HzA/?mibextid=wwXIfr\n"
                            f"\U0001f310 Website: https://sreelakshmicharity.org"
                        )
                        res = send_whatsapp_message(
                            to_phone=member.phone,
                            message_body=msg,
                            image_url=img_url
                        )
                        if res.get('success'):
                            r.whatsapp_status = 'SENT'
                            logger.info(f"[Membership WhatsApp] Sent to {member.phone} for member {member.member_id}")
                        else:
                            r.whatsapp_status = 'FAILED'
                            logger.warning(f"[Membership WhatsApp] Failed for {member.phone}: {res}")
                        r.save(update_fields=['whatsapp_status'])
                    except Exception as e:
                        import traceback
                        logger.error(f"[Membership WhatsApp] Exception for member {member.member_id}: {e}\n{traceback.format_exc()}")

                t = threading.Thread(target=dispatch_whatsapp, daemon=True)
                t.start()

        except Exception as e:
            import traceback
            logger.error(f"[Membership Receipt] Error during receipt/WhatsApp workflow for {member.member_id}: {e}\n{traceback.format_exc()}")


class MemberDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAnyStaff, IsOwnerOrManagerOrHR]
    serializer_class = MemberSerializer
    queryset = Member.objects.all()
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_object(self):
        obj = super().get_object()
        try:
            sync_member_subscription_status(obj, notify=True)
        except Exception:
            pass
        return obj

    def perform_update(self, serializer):
        member = serializer.save()
        password = self.request.data.get('password')
        username = self.request.data.get('username')
        if (password and str(password).strip()) or (username and str(username).strip()):
            sync_member_user_account(
                member,
                password=str(password).strip() if (password and str(password).strip()) else None,
                username=str(username).strip() if (username and str(username).strip()) else None,
                request_user=self.request.user
            )
        push_dashboard_refresh(['HR', 'MANAGER', 'ADMIN', 'STAFF'])

    def perform_destroy(self, instance):
        from core.models import User, Role, SystemNotification
        import re
        from django.db.models import Q

        # Permanently purge linked User credentials for this member
        clean_phone = re.sub(r'[^0-9]', '', str(instance.phone or ''))[-10:]
        clean_mem_id = str(instance.member_id or '').replace('MEM-', '').strip()
        users_to_delete = []

        if instance.created_by and getattr(instance.created_by, 'role', None) == Role.MEMBER:
            users_to_delete.append(instance.created_by)
        if clean_phone:
            for u in User.objects.filter(role=Role.MEMBER).filter(Q(username__iexact=clean_phone) | Q(username__iexact=str(instance.phone).strip())):
                if u not in users_to_delete:
                    users_to_delete.append(u)
        if instance.member_id:
            for u in User.objects.filter(role=Role.MEMBER).filter(Q(username__iexact=instance.member_id) | Q(username__iexact=clean_mem_id)):
                if u not in users_to_delete:
                    users_to_delete.append(u)

        for u in users_to_delete:
            try:
                u.delete()
            except Exception:
                pass

        try:
            SystemNotification.objects.filter(reference_id=str(instance.id)).delete()
        except Exception:
            pass

        instance.delete()
        push_dashboard_refresh(['HR', 'MANAGER', 'ADMIN', 'STAFF'])


class MemberResetPasswordView(APIView):
    permission_classes = [IsAnyStaff, IsOwnerOrManagerOrHR]

    def post(self, request, pk):
        try:
            member = Member.objects.get(pk=pk)
        except Member.DoesNotExist:
            return Response({'error': 'Member not found.'}, status=status.HTTP_404_NOT_FOUND)

        password = request.data.get('password')
        if not password or len(str(password).strip()) < 6:
            return Response({'error': 'Password must be at least 6 characters.'}, status=status.HTTP_400_BAD_REQUEST)

        username = request.data.get('username')
        sync_member_user_account(
            member,
            password=str(password).strip(),
            username=str(username).strip() if (username and str(username).strip()) else None,
            request_user=request.user
        )
        push_dashboard_refresh(['HR', 'MANAGER', 'ADMIN', 'STAFF'])
        return Response({'message': f'Password for member "{member.full_name}" has been reset successfully.'})


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
            f"📄 Voucher ID: {receipt.receipt_number}\n\n"
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
    permission_classes = [IsManagerOrHR]
    serializer_class = VolunteerSerializer
    queryset = Volunteer.objects.all().order_by('-created_at')
    filterset_fields = ['status']
    search_fields = ['volunteer_id', 'full_name', 'phone', 'email', 'skills', 'blood_group', 'occupation']
    ordering_fields = ['full_name', 'joining_date', 'created_at']
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class VolunteerDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsManagerOrHR]
    serializer_class = VolunteerSerializer
    queryset = Volunteer.objects.all()
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def perform_destroy(self, instance):
        instance.delete()
        push_dashboard_refresh(['HR', 'MANAGER', 'ADMIN'], module='VOLUNTEERS')


class VolunteerMyStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        volunteer = Volunteer.objects.filter(user=user).order_by('-created_at').first()
        if not volunteer:
            # Check by phone
            clean_phone = getattr(user, 'phone', None)
            if clean_phone:
                volunteer = Volunteer.objects.filter(phone=clean_phone).order_by('-created_at').first()
            if not volunteer and user.email:
                volunteer = Volunteer.objects.filter(email=user.email).order_by('-created_at').first()
            if volunteer and not volunteer.user:
                volunteer.user = user
                volunteer.save(update_fields=['user'])

        if not volunteer:
            return Response({'has_applied': False, 'status': None, 'volunteer': None})

        return Response({
            'has_applied': True,
            'status': volunteer.status,
            'volunteer': VolunteerSerializer(volunteer, context={'request': request}).data
        })


class VolunteerApplyView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        user = request.user
        # Check existing active or pending application
        existing = Volunteer.objects.filter(user=user, status__in=[VolunteerStatus.PENDING, VolunteerStatus.ACTIVE]).first()
        if existing:
            return Response({
                'detail': f'You already have an application ({existing.volunteer_id}) with status {existing.status}.',
                'volunteer': VolunteerSerializer(existing, context={'request': request}).data
            }, status=status.HTTP_400_BAD_REQUEST)

        full_name = request.data.get('full_name') or getattr(user, 'full_name', '')
        phone = request.data.get('phone') or getattr(user, 'phone', '')
        email = request.data.get('email') or getattr(user, 'email', '')
        date_of_birth = request.data.get('date_of_birth') or None
        blood_group = request.data.get('blood_group', '').strip()
        occupation = request.data.get('occupation', '').strip()
        address = request.data.get('address', '').strip()
        address_proof = request.FILES.get('address_proof')
        photo = request.FILES.get('photo')

        if not full_name or not phone:
            return Response({'detail': 'Full name and phone number are required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Parse date_of_birth if empty string
        if date_of_birth == '' or date_of_birth == 'null':
            date_of_birth = None

        volunteer = Volunteer.objects.create(
            user=user,
            full_name=full_name,
            phone=phone,
            email=email,
            date_of_birth=date_of_birth,
            blood_group=blood_group,
            occupation=occupation,
            address=address,
            address_proof=address_proof,
            photo=photo,
            status=VolunteerStatus.PENDING,
            created_by=user
        )

        # Notify Managers and Admins
        try:
            push_to_role(
                role='MANAGER',
                title='New Volunteer Application',
                message=f'{volunteer.full_name} has applied to join as a Volunteer ({volunteer.volunteer_id}).',
                notification_type='VOLUNTEER_APPLICATION',
                reference_id=str(volunteer.id),
                reference_type='Volunteer',
                priority='HIGH'
            )
            push_to_role(
                role='ADMIN',
                title='New Volunteer Application',
                message=f'{volunteer.full_name} has applied to join as a Volunteer ({volunteer.volunteer_id}).',
                notification_type='VOLUNTEER_APPLICATION',
                reference_id=str(volunteer.id),
                reference_type='Volunteer',
                priority='HIGH'
            )
            push_dashboard_refresh(['MANAGER', 'ADMIN', 'HR'], module='VOLUNTEERS')
        except Exception:
            pass

        AuditLog.objects.create(
            user=user,
            action='VOLUNTEER_APPLY',
            module='HR',
            record_type='Volunteer',
            record_id=str(volunteer.id),
            reference_number=volunteer.volunteer_id,
            description=f'Volunteer application submitted: {volunteer.volunteer_id} ({volunteer.full_name})'
        )

        return Response(VolunteerSerializer(volunteer, context={'request': request}).data, status=status.HTTP_201_CREATED)


class VolunteerApproveView(APIView):
    permission_classes = [IsManagerOrHR]

    def post(self, request, pk):
        volunteer = get_object_or_404(Volunteer, pk=pk)
        volunteer.status = VolunteerStatus.ACTIVE
        volunteer.approved_by = request.user
        volunteer.approved_at = timezone.now()
        volunteer.rejection_reason = ''
        volunteer.save()

        # Send push notification to applicant user
        target_user = volunteer.user
        if not target_user and volunteer.phone:
            from core.models import User
            target_user = User.objects.filter(phone=volunteer.phone).first()
            if target_user:
                volunteer.user = target_user
                volunteer.save(update_fields=['user'])

        if target_user:
            try:
                push_notification(
                    recipient=target_user,
                    title='🎉 Volunteership Approved!',
                    message=f'Congratulations {volunteer.full_name}! Your volunteer application ({volunteer.volunteer_id}) has been approved by Sree Lakshmi Charitable Trust. Your official Volunteership Card is now active in the app.',
                    notification_type='VOLUNTEER_APPROVED',
                    reference_id=str(volunteer.id),
                    reference_type='Volunteer',
                    priority='HIGH'
                )
            except Exception as e:
                import logging
                logging.getLogger(__name__).error(f'Error pushing volunteer approval: {e}')

        try:
            push_dashboard_refresh(['MANAGER', 'ADMIN', 'HR'], module='VOLUNTEERS')
        except Exception:
            pass

        AuditLog.objects.create(
            user=request.user,
            action='VOLUNTEER_APPROVED',
            module='HR',
            record_type='Volunteer',
            record_id=str(volunteer.id),
            reference_number=volunteer.volunteer_id,
            description=f'Approved volunteer {volunteer.volunteer_id} ({volunteer.full_name})'
        )

        return Response(VolunteerSerializer(volunteer, context={'request': request}).data)


class VolunteerRejectView(APIView):
    permission_classes = [IsManagerOrHR]

    def post(self, request, pk):
        volunteer = get_object_or_404(Volunteer, pk=pk)
        reason = request.data.get('reason', '').strip() or 'Application could not be approved at this time.'
        volunteer.status = VolunteerStatus.REJECTED
        volunteer.rejection_reason = reason
        volunteer.approved_by = request.user
        volunteer.save()

        target_user = volunteer.user
        if target_user:
            try:
                push_notification(
                    recipient=target_user,
                    title='Volunteer Application Update',
                    message=f'Regarding your volunteer application ({volunteer.volunteer_id}): {reason}',
                    notification_type='VOLUNTEER_REJECTED',
                    reference_id=str(volunteer.id),
                    reference_type='Volunteer',
                    priority='NORMAL'
                )
            except Exception:
                pass

        try:
            push_dashboard_refresh(['MANAGER', 'ADMIN', 'HR'], module='VOLUNTEERS')
        except Exception:
            pass

        AuditLog.objects.create(
            user=request.user,
            action='VOLUNTEER_REJECTED',
            module='HR',
            record_type='Volunteer',
            record_id=str(volunteer.id),
            reference_number=volunteer.volunteer_id,
            description=f'Rejected volunteer {volunteer.volunteer_id} ({volunteer.full_name}): {reason}'
        )

        return Response(VolunteerSerializer(volunteer, context={'request': request}).data)


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

    def perform_destroy(self, instance):
        instance.delete()
        push_dashboard_refresh(['HR', 'MANAGER', 'ADMIN'])



# ── Executive Officers ────────────────────────────────────────────
class ExecutiveOfficerListCreateView(generics.ListCreateAPIView):
    serializer_class = ExecutiveOfficerSerializer
    queryset = ExecutiveOfficer.objects.all()
    filterset_fields = ['employment_type', 'department']
    search_fields = ['employee_id', 'full_name', 'phone', 'designation']
    ordering_fields = ['full_name', 'joining_date']
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAnyStaff()]
        return [IsHR()]

    def get_queryset(self):
        # Self-healing: ensure any active User with role='STAFF' has an ExecutiveOfficer record
        try:
            from core.models import User
            from django.utils import timezone
            from django.db.models import Q
            staff_users = User.objects.filter(role__iexact='STAFF', is_active=True)
            for u in staff_users:
                name = (u.full_name or u.username or '').strip()
                if not name:
                    continue
                q = Q(full_name__iexact=name)
                if u.email and u.email.strip():
                    q |= Q(email__iexact=u.email.strip())
                if u.phone and str(u.phone).strip():
                    q |= Q(phone__iexact=str(u.phone).strip())
                if not ExecutiveOfficer.objects.filter(q).exists():
                    ExecutiveOfficer.objects.create(
                        full_name=name,
                        email=u.email or '',
                        phone=str(u.phone or ''),
                        designation='Staff',
                        department='General',
                        status='ACTIVE',
                        joining_date=getattr(u, 'date_joined', timezone.now()).date() if hasattr(u, 'date_joined') else timezone.now().date()
                    )
        except Exception:
            pass

        qs = super().get_queryset()
        status_param = self.request.query_params.get('status')
        if status_param:
            if status_param.upper() in ['INACTIVE', 'TERMINATED']:
                qs = qs.filter(status__in=['INACTIVE', 'TERMINATED'])
            else:
                qs = qs.filter(status__iexact=status_param)
        else:
            if self.request.query_params.get('show_all') != 'true':
                qs = qs.filter(status='ACTIVE')
        designation = self.request.query_params.get('designation')
        if designation:
            from django.db.models import Q
            qs = qs.filter(
                Q(designation__iexact=designation) | 
                Q(designation__iexact=designation.replace('_', ' ')) |
                Q(designation__iexact=designation.replace(' ', '_')) |
                Q(designation__icontains=designation)
            )
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class ExecutiveOfficerDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsHR]
    serializer_class = ExecutiveOfficerSerializer
    queryset = ExecutiveOfficer.objects.all()
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def perform_destroy(self, instance):
        from core.models import User
        from django.db.models import Q
        
        # Deactivate user login access to immediately block mobile app access while preserving history
        q = Q(username__iexact=instance.employee_id)
        if instance.phone:
            q |= Q(username__iexact=instance.phone)
            q |= Q(phone__iexact=instance.phone)
        if instance.email:
            q |= Q(email__iexact=instance.email)
        
        users = list(User.objects.filter(q).exclude(role__in=['ADMIN', 'MANAGER']))
        name_users = list(User.objects.filter(full_name__iexact=instance.full_name).exclude(role__in=['ADMIN', 'MANAGER']))
        
        all_users = set(users + name_users)
        for u in all_users:
            u.is_active = False
            u.set_unusable_password()
            u.save(update_fields=['is_active', 'password'])

            # Send immediate force logout signal to user's WebSocket channel
            try:
                from asgiref.sync import async_to_sync
                from channels.layers import get_channel_layer
                channel_layer = get_channel_layer()
                if channel_layer:
                    async_to_sync(channel_layer.group_send)(
                        f"notify_{str(u.id)}",
                        {'type': 'force_logout', 'message': 'Account deleted by HR'}
                    )
            except Exception as e:
                print("WebSocket force logout error:", e)

            # Free up the voucher book for reassignment
            from hr_module.models import StaffVoucherBook
            StaffVoucherBook.objects.filter(staff=u).update(
                book_number=0, voucher_start=0, voucher_end=0, current_voucher=0,
                next_book_number=None, next_voucher_start=None, next_voucher_end=None, next_current_voucher=None
            )

        is_permanent = self.request.query_params.get('permanent') == 'true' or bool(self.request.data.get('permanent'))
        if is_permanent:
            for u in all_users:
                try:
                    u.delete()
                except Exception:
                    pass
            instance.delete()
        else:
            # Mark officer profile status as INACTIVE to remove from active staff list while preserving all history
            instance.status = 'INACTIVE'
            reason = self.request.data.get('termination_reason')
            if reason:
                instance.termination_reason = reason
            instance.save(update_fields=['status', 'termination_reason'])

        push_dashboard_refresh(['HR', 'MANAGER', 'ADMIN', 'STAFF'])



class ExecutiveOfficerReactivateView(APIView):
    permission_classes = [IsHR]

    def post(self, request, pk):
        try:
            instance = ExecutiveOfficer.objects.get(pk=pk)
        except ExecutiveOfficer.DoesNotExist:
            return Response({'error': 'Staff not found.'}, status=status.HTTP_404_NOT_FOUND)

        from core.models import User
        from django.db.models import Q

        # Find associated users and reactivate them
        q = Q(username__iexact=instance.employee_id)
        if instance.phone:
            q |= Q(username__iexact=instance.phone)
            q |= Q(phone__iexact=instance.phone)
        if instance.email:
            q |= Q(email__iexact=instance.email)

        password = request.data.get('password')
        if not password:
            return Response({'error': 'Password is required for reactivation.'}, status=status.HTTP_400_BAD_REQUEST)

        users = list(User.objects.filter(q).exclude(role__in=['ADMIN', 'MANAGER']))
        name_users = list(User.objects.filter(full_name__iexact=instance.full_name).exclude(role__in=['ADMIN', 'MANAGER']))
        all_users = set(users + name_users)
        
        # If no user account found, we could create one or just let the system handle it
        for u in all_users:
            u.is_active = True
            u.set_password(password)
            u.save(update_fields=['is_active', 'password'])

        instance.status = 'ACTIVE'
        instance.save(update_fields=['status'])

        push_dashboard_refresh(['HR', 'MANAGER', 'ADMIN', 'STAFF'])
        
        return Response({'message': f'Staff reactivated successfully. Password updated.'})


class ExecutiveOfficerResetPasswordView(APIView):
    permission_classes = [IsHR]

    def post(self, request, pk):
        try:
            instance = ExecutiveOfficer.objects.get(pk=pk)
        except ExecutiveOfficer.DoesNotExist:
            return Response({'error': 'Staff not found.'}, status=status.HTTP_404_NOT_FOUND)

        from core.models import User
        from django.db.models import Q

        # Find associated users and update password
        q = Q(username__iexact=instance.employee_id)
        if instance.phone:
            q |= Q(username__iexact=instance.phone)
            q |= Q(phone__iexact=instance.phone)
        if instance.email:
            q |= Q(email__iexact=instance.email)

        password = request.data.get('password')
        if not password:
            return Response({'error': 'Password is required.'}, status=status.HTTP_400_BAD_REQUEST)

        users = list(User.objects.filter(q).exclude(role__in=['ADMIN', 'MANAGER']))
        name_users = list(User.objects.filter(full_name__iexact=instance.full_name).exclude(role__in=['ADMIN', 'MANAGER']))
        all_users = set(users + name_users)
        
        if not all_users:
            return Response({'error': 'No user account found for this staff member.'}, status=status.HTTP_404_NOT_FOUND)

        for u in all_users:
            u.set_password(password)
            u.save(update_fields=['password'])

        return Response({'message': 'Password reset successfully.'})


class DesignationListView(APIView):
    permission_classes = [IsAnyStaff]

    def get(self, request):
        designations = ExecutiveOfficer.objects.exclude(designation__isnull=True).exclude(designation='').values_list('designation', flat=True).distinct()
        
        # Standardize format for frontend: uppercase and spaces to underscores
        cleaned_designations = set()
        for d in designations:
            cleaned_designations.add(str(d).upper().replace(' ', '_'))
            
        return Response(list(cleaned_designations))


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
        
        # Get Salary Advances taken in this month
        from accounts_module.models import Expense
        advances = Expense.objects.filter(
            category='SALARY ADVANCE',
            payee__iexact=employee.full_name,
            date__year=year,
            date__month=month
        ).exclude(status='CANCELLED')
        
        advance_taken = sum(float(exp.amount) for exp in advances)
        
        return Response({
            'employee_name': employee.full_name,
            'employment_type': employee.employment_type,
            'salary_structure': salary_data,
            'attendance': {
                'present': att_counts.get('PRESENT', 0),
                'absent': att_counts.get('ABSENT', 0),
                'leave': att_counts.get('LEAVE', 0),
                'late': att_counts.get('LATE', 0),
            },
            'salary_advance_taken': advance_taken
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
    serializer_class = AttendanceSerializer
    queryset = Attendance.objects.select_related('employee', 'marked_by').all()
    filterset_fields = ['employee', 'date', 'status']
    search_fields = ['employee__full_name', 'employee__employee_id']
    ordering_fields = ['date']

    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAnyStaff()]
        return [IsHR()]

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

        today = timezone.localdate()
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
            date = rec.get('date', timezone.localdate())
            defaults_to_update = {
                'status': rec.get('status', 'PRESENT'),
                'remarks': rec.get('remarks', ''),
                'marked_by': request.user,
            }
            if 'check_in' in rec:
                defaults_to_update['check_in'] = rec['check_in']
            if 'check_out' in rec:
                defaults_to_update['check_out'] = rec['check_out']

            att, was_created = Attendance.objects.update_or_create(
                employee_id=emp_id, date=date,
                defaults=defaults_to_update
            )
            if was_created:
                created += 1
            else:
                updated += 1
        return Response({'created': created, 'updated': updated})


# ── Leave Management ──────────────────────────────────────────────
from hr_module.leave_service import (
    validate_leave_application,
    approve_leave_request,
    reject_leave_request,
    cancel_leave_request,
    get_leave_balance_summary,
    get_approved_leave_days_in_month,
    MONTHLY_STANDARD_LIMIT,
    ADVANCE_NOTICE_DAYS_REQUIRED,
)
from hr_module.models import (
    LeaveRequest,
    LeaveHRNote,
    LeaveHRCommunication,
    LeaveAuditLog,
)
from hr_module.serializers import (
    LeaveRequestSerializer,
    LeaveHRNoteSerializer,
    LeaveHRCommunicationSerializer,
    LeaveAuditLogSerializer,
)
from datetime import datetime


class LeaveRequestListCreateView(generics.ListCreateAPIView):
    """
    HR and Manager View to view and list all staff leave applications.
    Supports filtering by staff, department, status, month, and date range.
    Includes overall statistics in response headers / meta.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = LeaveRequestSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        user = self.request.user
        qs = LeaveRequest.objects.select_related(
            'employee', 'staff_user', 'approved_by', 'reapplication_of'
        ).prefetch_related(
            'hr_notes', 'hr_communications', 'audit_logs', 'reapplications'
        ).all()

        # If ordinary staff, restrict to own requests
        if user.role not in ['HR', 'MANAGER', 'ADMIN']:
            officer = get_officer_for_user(user)
            if not officer:
                return LeaveRequest.objects.none()
            qs = qs.filter(Q(employee=officer) | Q(staff_user=user))

        # Filters
        search = self.request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(employee__full_name__icontains=search) |
                Q(employee__employee_id__icontains=search) |
                Q(staff_user__staff_uid__icontains=search) |
                Q(reason__icontains=search) |
                Q(description__icontains=search)
            )

        status_filter = self.request.query_params.get('status', '').strip().upper()
        if status_filter and status_filter != 'ALL':
            qs = qs.filter(status=status_filter)

        department = self.request.query_params.get('department', '').strip()
        if department and department != 'ALL':
            qs = qs.filter(employee__department__iexact=department)

        employee_id = self.request.query_params.get('employee_id', '').strip()
        if employee_id:
            qs = qs.filter(Q(employee__id=employee_id) | Q(employee__employee_id=employee_id))

        from_date = self.request.query_params.get('from_date')
        if from_date:
            qs = qs.filter(from_date__gte=from_date)

        to_date = self.request.query_params.get('to_date')
        if to_date:
            qs = qs.filter(to_date__lte=to_date)

        # Monthly filtration (e.g. month=10, year=2026 or month='2026-10')
        month_param = self.request.query_params.get('month', '').strip()
        year_param = self.request.query_params.get('year', '').strip()
        if month_param:
            try:
                import calendar, datetime
                if '-' in month_param:
                    parts = month_param.split('-')
                    filter_year, filter_month = int(parts[0]), int(parts[1])
                else:
                    filter_month = int(month_param)
                    filter_year = int(year_param) if year_param else timezone.now().year
                _, last_day = calendar.monthrange(filter_year, filter_month)
                m_start = datetime.date(filter_year, filter_month, 1)
                m_end = datetime.date(filter_year, filter_month, last_day)
                qs = qs.filter(from_date__lte=m_end, to_date__gte=m_start)
            except (ValueError, TypeError):
                pass
        elif year_param:
            try:
                filter_year = int(year_param)
                import datetime
                y_start = datetime.date(filter_year, 1, 1)
                y_end = datetime.date(filter_year, 12, 31)
                qs = qs.filter(from_date__lte=y_end, to_date__gte=y_start)
            except (ValueError, TypeError):
                pass

        exceeds_limit = self.request.query_params.get('exceeds_monthly_limit')
        if exceeds_limit is not None and exceeds_limit != '':
            val = str(exceeds_limit).lower() in ['true', '1', 'yes']
            qs = qs.filter(exceeds_monthly_limit=val)

        return qs.order_by('-created_at')

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        # Add summary stats for HR / Manager
        now = timezone.localtime(timezone.now())
        all_qs = LeaveRequest.objects.all()

        target_year = now.year
        target_month = now.month
        month_param = request.query_params.get('month', '').strip()
        year_param = request.query_params.get('year', '').strip()
        if month_param:
            try:
                if '-' in month_param:
                    parts = month_param.split('-')
                    target_year, target_month = int(parts[0]), int(parts[1])
                else:
                    target_month = int(month_param)
                    if year_param:
                        target_year = int(year_param)
            except (ValueError, TypeError):
                pass

        stats = {
            'total_pending': all_qs.filter(status='PENDING').count(),
            'approved_this_month': all_qs.filter(
                status='APPROVED'
            ).filter(
                Q(approved_at__year=target_year, approved_at__month=target_month) |
                Q(from_date__year=target_year, from_date__month=target_month)
            ).distinct().count(),
            'rejected_count': all_qs.filter(status='REJECTED').count(),
            'total_count': all_qs.count(),
        }

        if isinstance(response.data, dict) and 'results' in response.data:
            response.data['stats'] = stats
        else:
            response.data = {
                'results': response.data,
                'stats': stats
            }
        return response


class LeaveRequestDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Detailed view of a single leave application.
    Accessible to HR, Managers, Admins, and the staff member who applied.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = LeaveRequestSerializer
    queryset = LeaveRequest.objects.select_related(
        'employee', 'staff_user', 'approved_by', 'reapplication_of'
    ).prefetch_related(
        'hr_notes', 'hr_communications', 'audit_logs', 'reapplications'
    ).all()
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def check_object_permissions(self, request, obj):
        super().check_object_permissions(request, obj)
        user = request.user
        if user.role in ['HR', 'MANAGER', 'ADMIN']:
            return True
        officer = get_officer_for_user(user)
        if obj.staff_user == user or (officer and obj.employee == officer):
            return True
        self.permission_denied(request, message="You do not have permission to view this leave application.")


class LeaveApprovalView(APIView):
    """
    Manager Decision View.
    Approves or rejects a staff leave application.
    STRICT ROLE-BASED ACCESS CONTROL: Only Managers and Admins can approve or reject!
    HR staff are prohibited from modifying the approval status.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        # 1. Enforce Role-Based Access Control
        if request.user.role not in ['MANAGER', 'ADMIN']:
            return Response(
                {
                    'error': (
                        'Unauthorized: HR staff cannot approve or reject leave applications. '
                        'Only authorized Managers and Admins have approval authority.'
                    )
                },
                status=status.HTTP_403_FORBIDDEN
            )

        action = request.data.get('action', '').strip().lower()  # 'approve' / 'reject'
        try:
            leave = LeaveRequest.objects.select_related('employee', 'staff_user').get(pk=pk)
        except LeaveRequest.DoesNotExist:
            return Response({'error': 'Leave request not found.'}, status=status.HTTP_404_NOT_FOUND)

        if leave.status != 'PENDING':
            return Response(
                {'error': f"Cannot take action. Application is already in '{leave.status}' status."},
                status=status.HTTP_400_BAD_REQUEST
            )

        client_ip = request.META.get('REMOTE_ADDR')

        try:
            if action == 'approve':
                updated_leave = approve_leave_request(leave, request.user, ip_address=client_ip)
                return Response({
                    'message': f"Leave application for {leave.employee.full_name} approved successfully.",
                    'status': updated_leave.status,
                    'leave': LeaveRequestSerializer(updated_leave).data
                })

            elif action == 'reject':
                reason = request.data.get('reason', '').strip()
                if not reason:
                    return Response(
                        {'error': 'A rejection reason is mandatory when rejecting a leave application.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                updated_leave = reject_leave_request(leave, request.user, reason, ip_address=client_ip)
                return Response({
                    'message': f"Leave application for {leave.employee.full_name} rejected.",
                    'status': updated_leave.status,
                    'rejection_reason': updated_leave.rejection_reason,
                    'leave': LeaveRequestSerializer(updated_leave).data
                })

            else:
                return Response({'error': "Invalid action. Use 'approve' or 'reject'."}, status=status.HTTP_400_BAD_REQUEST)

        except ValidationError as ve:
            return Response({'error': str(ve.message if hasattr(ve, 'message') else ve)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': f"Failed to process leave decision: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class StaffLeaveListCreateView(APIView):
    """
    Staff-facing view:
    - GET: Returns the logged-in staff member's leave requests and monthly balance summary.
    - POST: Submits a new leave application with full backend validations:
        - Dates validity
        - Overlapping applications
        - 2-day monthly limit & 15-day advance notice requirement
        - Creates audit log and notifies Managers
    """
    permission_classes = [IsAnyStaff]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        officer = get_officer_for_user(request.user)
        if not officer:
            return Response({'error': 'No officer profile found for your user account.'}, status=404)

        now = timezone.localtime(timezone.now())
        balance = get_leave_balance_summary(officer, now.date())

        qs = LeaveRequest.objects.filter(
            Q(employee=officer) | Q(staff_user=request.user)
        ).select_related('employee', 'staff_user', 'approved_by', 'reapplication_of').prefetch_related(
            'hr_communications', 'reapplications'
        ).order_by('-created_at')

        status_filter = request.query_params.get('status', '').strip().upper()
        if status_filter and status_filter != 'ALL':
            qs = qs.filter(status=status_filter)

        return Response({
            'officer_name': officer.full_name,
            'employee_id': officer.employee_id,
            'balance_summary': balance,
            'results': LeaveRequestSerializer(qs, many=True).data
        })

    def post(self, request):
        officer = get_officer_for_user(request.user)
        if not officer:
            return Response({'error': 'No officer profile found for your user account.'}, status=404)

        data = request.data
        from_date_raw = data.get('from_date')
        to_date_raw = data.get('to_date')
        leave_type = data.get('leave_type', 'CASUAL').strip().upper()
        reason = (data.get('reason') or '').strip()
        description = (data.get('description') or '').strip()
        is_half_day = str(data.get('is_half_day', 'false')).lower() in ['true', '1', 'yes']
        half_day_session = data.get('half_day_session', '').strip().upper()
        reapplication_of_id = data.get('reapplication_of')

        if not from_date_raw or not to_date_raw:
            return Response({'error': 'From Date and To Date are required.'}, status=400)
        if not reason:
            return Response({'error': 'Reason for leave is required.'}, status=400)

        try:
            from_date = datetime.strptime(str(from_date_raw), '%Y-%m-%d').date()
            to_date = datetime.strptime(str(to_date_raw), '%Y-%m-%d').date()
        except ValueError:
            return Response({'error': 'Invalid date format. Use YYYY-MM-DD.'}, status=400)

        # Validate Reapplication
        reapplication_of = None
        if reapplication_of_id:
            try:
                reapplication_of = LeaveRequest.objects.get(id=reapplication_of_id, employee=officer)
                if reapplication_of.status != 'REJECTED':
                    return Response({'error': 'You can only reapply for a rejected leave application.'}, status=400)
            except LeaveRequest.DoesNotExist:
                return Response({'error': 'Original rejected application not found.'}, status=404)

        # Backend Validations: monthly limit, overlapping, 15-day notice
        application_date = timezone.localtime(timezone.now()).date()
        try:
            days_by_month, total_days, exceeds_limit, notice_days = validate_leave_application(
                employee=officer,
                from_date=from_date,
                to_date=to_date,
                is_half_day=is_half_day,
                application_date=application_date
            )
        except ValidationError as ve:
            return Response({'error': str(ve.message if hasattr(ve, 'message') else ve)}, status=400)

        # Create the Leave Application with status PENDING
        leave = LeaveRequest(
            employee=officer,
            staff_user=request.user,
            leave_type=leave_type,
            from_date=from_date,
            to_date=to_date,
            is_half_day=is_half_day,
            half_day_session=half_day_session if is_half_day else '',
            number_of_days=total_days,
            reason=reason,
            description=description,
            status='PENDING',
            applied_at=timezone.now(),
            created_at=timezone.now(),
            exceeds_monthly_limit=exceeds_limit,
            notice_days=notice_days,
            reapplication_of=reapplication_of
        )

        if 'attachment' in request.FILES:
            leave.attachment = request.FILES['attachment']

        leave.save()

        # Audit Log
        LeaveAuditLog.objects.create(
            leave_request=leave,
            actor=request.user,
            action='REAPPLIED' if reapplication_of else 'APPLIED',
            details=(
                f"Applied for {total_days} days leave ({from_date.strftime('%d %b %Y')} to {to_date.strftime('%d %b %Y')}). "
                f"Notice: {notice_days} days. Exceeds standard limit: {exceeds_limit}."
            ),
            ip_address=request.META.get('REMOTE_ADDR')
        )

        # Notify Managers & HR
        push_to_role(
            role='MANAGER',
            title="New Leave Application 📝",
            message=f"{officer.full_name} submitted a leave application ({leave_type}) for {from_date} to {to_date} ({total_days} days).",
            notification_type='LEAVE_REQUESTED',
            reference_id=str(leave.id),
            reference_type='LEAVE'
        )
        push_to_role(
            role='HR',
            title="New Leave Application Submitted",
            message=f"{officer.full_name} submitted a leave application ({leave_type}) for {from_date} to {to_date} ({total_days} days).",
            notification_type='LEAVE_REQUESTED',
            reference_id=str(leave.id),
            reference_type='LEAVE'
        )

        push_dashboard_refresh(roles=['HR', 'MANAGER', 'STAFF'])

        return Response(LeaveRequestSerializer(leave).data, status=status.HTTP_201_CREATED)


class StaffLeaveCancelView(APIView):
    """
    Staff cancel their own pending leave request.
    """
    permission_classes = [IsAnyStaff]

    def post(self, request, pk):
        officer = get_officer_for_user(request.user)
        try:
            leave = LeaveRequest.objects.get(
                Q(id=pk) & (Q(employee=officer) | Q(staff_user=request.user))
            )
        except LeaveRequest.DoesNotExist:
            return Response({'error': 'Leave request not found or not owned by you.'}, status=404)

        try:
            cancelled = cancel_leave_request(leave, request.user, ip_address=request.META.get('REMOTE_ADDR'))
            return Response({
                'message': 'Leave application cancelled successfully.',
                'status': cancelled.status,
                'leave': LeaveRequestSerializer(cancelled).data
            })
        except ValidationError as ve:
            return Response({'error': str(ve.message if hasattr(ve, 'message') else ve)}, status=400)


class StaffLeaveBalanceView(APIView):
    """
    Returns the staff member's leave balance breakdown for the current month.
    """
    permission_classes = [IsAnyStaff]

    def get(self, request):
        officer = get_officer_for_user(request.user)
        if not officer:
            return Response({'error': 'No officer profile found.'}, status=404)

        balance = get_leave_balance_summary(officer)
        return Response(balance)


class LeaveHRNotesView(APIView):
    """
    Internal HR notes on a leave application.
    Accessible only to HR, Managers, and Admins.
    Private to management; not visible to staff.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        if request.user.role not in ['HR', 'MANAGER', 'ADMIN']:
            return Response({'error': 'Unauthorized to view internal HR notes.'}, status=403)
        try:
            leave = LeaveRequest.objects.get(pk=pk)
        except LeaveRequest.DoesNotExist:
            return Response({'error': 'Leave request not found.'}, status=404)

        notes = leave.hr_notes.select_related('author').all()
        return Response(LeaveHRNoteSerializer(notes, many=True).data)

    def post(self, request, pk):
        if request.user.role not in ['HR', 'MANAGER', 'ADMIN']:
            return Response({'error': 'Unauthorized to add internal HR notes.'}, status=403)
        try:
            leave = LeaveRequest.objects.get(pk=pk)
        except LeaveRequest.DoesNotExist:
            return Response({'error': 'Leave request not found.'}, status=404)

        note_text = (request.data.get('note') or '').strip()
        if not note_text:
            return Response({'error': 'Note text cannot be empty.'}, status=400)

        hr_note = LeaveHRNote.objects.create(
            leave_request=leave,
            author=request.user,
            note=note_text
        )

        LeaveAuditLog.objects.create(
            leave_request=leave,
            actor=request.user,
            action='HR_NOTE_ADDED',
            details=f"Internal note added by {request.user.full_name or request.user.username}",
            ip_address=request.META.get('REMOTE_ADDR')
        )

        return Response(LeaveHRNoteSerializer(hr_note).data, status=201)


class LeaveHRCommunicationView(APIView):
    """
    Communication between HR and Staff regarding a leave application.
    - GET: Visible to HR, Manager, and the staff member.
    - POST: HR or Manager sends a decision or guidance message to the staff member.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            leave = LeaveRequest.objects.select_related('employee', 'staff_user').get(pk=pk)
        except LeaveRequest.DoesNotExist:
            return Response({'error': 'Leave request not found.'}, status=404)

        user = request.user
        officer = get_officer_for_user(user)
        is_owner = (leave.staff_user == user) or (officer and leave.employee == officer)
        is_mgmt = user.role in ['HR', 'MANAGER', 'ADMIN']

        if not is_owner and not is_mgmt:
            return Response({'error': 'Unauthorized to view communications.'}, status=403)

        comms = leave.hr_communications.select_related('sender').all()
        return Response(LeaveHRCommunicationSerializer(comms, many=True).data)

    def post(self, request, pk):
        if request.user.role not in ['HR', 'MANAGER', 'ADMIN']:
            return Response({'error': 'Only HR and Managers can send decision communications.'}, status=403)
        try:
            leave = LeaveRequest.objects.select_related('employee', 'staff_user').get(pk=pk)
        except LeaveRequest.DoesNotExist:
            return Response({'error': 'Leave request not found.'}, status=404)

        msg = (request.data.get('message') or '').strip()
        is_decision = str(request.data.get('is_decision_communicated', 'false')).lower() in ['true', '1', 'yes']

        if not msg:
            return Response({'error': 'Message text cannot be empty.'}, status=400)

        comm = LeaveHRCommunication.objects.create(
            leave_request=leave,
            sender=request.user,
            message=msg,
            is_decision_communicated=is_decision,
            delivery_status='SENT'
        )

        LeaveAuditLog.objects.create(
            leave_request=leave,
            actor=request.user,
            action='HR_COMMUNICATED',
            details=f"Message sent to staff: {msg[:60]}",
            ip_address=request.META.get('REMOTE_ADDR')
        )

        # Notify the staff member
        target_user = leave.staff_user or getattr(leave.employee, 'created_by', None)
        if target_user:
            push_notification(
                recipient=target_user,
                title="Message from HR Regarding Leave 📬",
                message=f"HR ({request.user.full_name or 'Management'}): {msg}",
                notification_type='LEAVE_COMMUNICATION',
                reference_id=str(leave.id),
                reference_type='LEAVE'
            )

        push_dashboard_refresh(roles=['HR', 'MANAGER', 'STAFF'])
        return Response(LeaveHRCommunicationSerializer(comm).data, status=201)


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
            return Response({'salary': 0, 'balance': 0, 'requests_this_month': 0, 'allowed_amount': 0}, status=200)

        from hr_module.models import SalaryStructure
        try:
            salary_struct = SalaryStructure.objects.get(employee=officer, is_active=True)
            net_salary = float(salary_struct.net_salary)
            basic_salary = float(salary_struct.basic_salary)
        except SalaryStructure.DoesNotExist:
            net_salary = 0
            basic_salary = 0

        # Calculate current month's approved advances to determine balance
        from django.utils import timezone
        now = timezone.localtime(timezone.now())
        advances = PaymentAdvanceRequest.objects.filter(
            employee=officer,
            created_at__year=now.year,
            created_at__month=now.month,
            status__in=['APPROVED', 'DISBURSED', 'PENDING']
        )
        total_advances = sum(float(a.amount) for a in advances)
        requests_this_month = advances.count()
        
        current_day = now.day
        allowed_amount = 0
        if current_day >= 15:
            # (Basic Salary / 30 * current_day) / 4
            allowed_amount = ((basic_salary / 30) * current_day) / 4

        balance = allowed_amount - total_advances

        return Response({
            'salary': net_salary, # Keep net_salary for backward compatibility if needed
            'basic_salary': basic_salary,
            'balance': balance if balance > 0 else 0,
            'total_advances': total_advances,
            'requests_this_month': requests_this_month,
            'allowed_amount': allowed_amount,
            'current_day': current_day
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
        today = timezone.localdate()
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
    """Returns the effective attendance date based on a 12:00 AM daily reset cycle."""
    now_local = timezone.localtime(timezone.now())
    return now_local.date()


# ── Staff Attendance View ──────────────────────────────────────────
class StaffAttendanceView(APIView):
    permission_classes = [IsAnyStaff]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

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
                if 'photo' in request.FILES:
                    att.check_in_photo = request.FILES['photo']
                if 'location' in request.data:
                    att.check_in_location = request.data['location']
                att.save()
                push_dashboard_refresh(['HR', 'MANAGER', 'ADMIN', 'STAFF'])
        elif action == 'check_out':
            att.check_out = now_time
            if att.check_in:
                # calculate working hours simple estimate
                h = (now_time.hour - att.check_in.hour) + (now_time.minute - att.check_in.minute)/60.0
                att.working_hours = round(max(0, h), 2)
            if 'photo' in request.FILES:
                att.check_out_photo = request.FILES['photo']
            if 'location' in request.data:
                att.check_out_location = request.data['location']
            att.save()
            push_dashboard_refresh(['HR', 'MANAGER', 'ADMIN', 'STAFF'])

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
                target_date = timezone.localdate()
        else:
            target_date = timezone.localdate()
        
        # Get list of names/emails for staff who are PRESENT, LATE, or HALF_DAY
        present_staff = Attendance.objects.filter(
            date=target_date, status__in=['PRESENT', 'LATE', 'HALF_DAY']
        ).values('employee__full_name', 'employee__email')
        
        present_staff_names = [s['employee__full_name'].strip().lower() for s in present_staff if s['employee__full_name']]
        present_staff_emails = [s['employee__email'].strip().lower() for s in present_staff if s['employee__email']]
        
        present_users = User.objects.filter(role=Role.STAFF, is_active=True)
        
        results = []
        for user in present_users:
            total_collection = Income.objects.filter(
                date=target_date, created_by=user
            ).aggregate(t=Sum('amount'))['t'] or 0
            
            user_name_clean = user.full_name.strip().lower() if user.full_name else ''
            user_email_clean = user.email.strip().lower() if user.email else ''
            
            is_present = (user_name_clean in present_staff_names) or (user_email_clean in present_staff_emails and user_email_clean)
            
            # Show if they are present OR if they collected any amount
            if not is_present and total_collection <= 0:
                continue
            
            from core.serializers import UserSerializer as UserProfileSerializer
            user_data = UserProfileSerializer(user, context={'request': request}).data
            photo_url = user_data.get('photo')


            results.append({
                'staff_id': str(user.id),
                'staff_uid': user.staff_uid,
                'name': user.full_name,
                'photo_url': photo_url,
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


# ── Staff Voucher Book ─────────────────────────────────────────────

class StaffVoucherView(APIView):
    """
    GET  /hr/staff-vouchers/              → list all STAFF users with their voucher books
    GET  /hr/staff-vouchers/<staff_id>/   → get one staff member's voucher book
    PATCH /hr/staff-vouchers/<staff_id>/  → HR sets book_number, voucher_start, voucher_end, current_voucher
    """
    permission_classes = [IsAnyStaff]

    def _get_staff_user(self, staff_id):
        from core.models import User, Role
        from hr_module.models import ExecutiveOfficer
        from django.db.models import Q

        # 1. Try treating it as a User ID
        try:
            return User.objects.get(pk=staff_id, role=Role.STAFF)
        except User.DoesNotExist:
            pass
        
        # 2. Try treating it as an ExecutiveOfficer ID
        try:
            officer = ExecutiveOfficer.objects.get(pk=staff_id)
            
            q = Q()
            if officer.email and officer.email.strip():
                q |= Q(email__iexact=officer.email.strip())
            if officer.phone and officer.phone.strip():
                q |= Q(phone__iexact=officer.phone.strip())
            if officer.full_name:
                cleaned_name = officer.full_name.strip()
                q |= Q(full_name__iexact=cleaned_name)
                q |= Q(username__iexact=cleaned_name)
                q |= Q(full_name__iexact=cleaned_name + ' ')  # Catch trailing space in DB
            if officer.employee_id:
                q |= Q(username__iexact=officer.employee_id)
                q |= Q(staff_uid=officer.employee_id)

            if q:
                user = User.objects.filter(q, role=Role.STAFF).first()
                if user:
                    return user
        except ExecutiveOfficer.DoesNotExist:
            pass

        return None

    def get(self, request, staff_id=None):
        from hr_module.models import StaffVoucherBook
        from core.models import User, Role

        if staff_id:
            user = self._get_staff_user(staff_id)
            if not user:
                return Response({'error': 'Staff user account not found. Please ensure the employee has an active user account with STAFF role.'}, status=404)
            vb, _ = StaffVoucherBook.objects.get_or_create(staff=user)
            return Response(self._serialize(vb, request))

        # List all STAFF members with their voucher data
        staff_users = User.objects.filter(role=Role.STAFF, is_active=True)
        result = []
        for u in staff_users:
            vb, _ = StaffVoucherBook.objects.get_or_create(staff=u)
            result.append(self._serialize(vb, request))
        return Response(result)

    def patch(self, request, staff_id):
        from hr_module.models import StaffVoucherBook

        user = self._get_staff_user(staff_id)
        if not user:
            from hr_module.models import ExecutiveOfficer
            from core.models import User
            try:
                officer = ExecutiveOfficer.objects.get(pk=staff_id)
                any_user = User.objects.filter(full_name__iexact=officer.full_name.strip()).first()
                if any_user and any_user.role != 'STAFF':
                    return Response({'error': f'User account exists but has role "{any_user.role}". Voucher books can only be assigned to STAFF.'}, status=400)
            except:
                pass
            return Response({'error': 'Staff user account not found. Please create a login account for this employee with STAFF role.'}, status=404)

        # Check uniqueness of book_number before assigning
        new_book_number = request.data.get('book_number')
        if new_book_number is not None:
            try:
                new_book_number = int(new_book_number)
                if new_book_number > 0:
                    existing = StaffVoucherBook.objects.filter(book_number=new_book_number).exclude(staff=user).first()
                    if existing:
                        return Response({'error': f'Book Number {new_book_number} is already assigned to {existing.staff.full_name}.'}, status=400)
            except ValueError:
                return Response({'error': 'Invalid book number.'}, status=400)

        vb, _ = StaffVoucherBook.objects.get_or_create(staff=user)

        allowed = ['book_number', 'voucher_start', 'voucher_end', 'current_voucher', 'next_book_number', 'next_voucher_start', 'next_voucher_end', 'next_current_voucher']
        for field in allowed:
            val = request.data.get(field)
            if val is not None:
                try:
                    setattr(vb, field, int(val))
                except (ValueError, TypeError):
                    return Response({'error': f'Invalid value for {field}'}, status=400)

        vb.updated_by = request.user
        vb.save()
        return Response(self._serialize(vb, request))

    @staticmethod
    def _serialize(vb, request):
        return {
            'staff_id': str(vb.staff.id),
            'staff_name': vb.staff.full_name,
            'staff_uid': vb.staff.staff_uid,
            'book_number': vb.book_number,
            'voucher_start': vb.voucher_start,
            'voucher_end': vb.voucher_end,
            'current_voucher': vb.current_voucher,
            'next_book_number': vb.next_book_number,
            'next_voucher_start': vb.next_voucher_start,
            'next_voucher_end': vb.next_voucher_end,
            'next_current_voucher': vb.next_current_voucher,
            'updated_at': vb.updated_at.isoformat() if vb.updated_at else None,
        }

class StaffVoucherBookActivateNextView(APIView):
    """
    POST /hr/staff-vouchers/<staff_id>/activate-next/
    Forcefully rolls over the voucher book to the queued next book early.
    """
    permission_classes = [IsAnyStaff]

    def post(self, request, staff_id):
        from hr_module.models import StaffVoucherBook
        from core.models import Role

        # Find the user
        user = None
        if '-' in staff_id and len(staff_id) > 10:  # Is UUID
            user = User.objects.filter(id=staff_id, role=Role.STAFF).first()
        else:
            try:
                officer = ExecutiveOfficer.objects.get(pk=staff_id)
                user = User.objects.filter(Q(email__iexact=officer.email) | Q(full_name__iexact=officer.full_name), role=Role.STAFF).first()
            except:
                pass

        if not user:
            return Response({'error': 'Staff user not found.'}, status=404)

        vb = StaffVoucherBook.objects.filter(staff=user).first()
        if not vb:
            return Response({'error': 'No voucher book found.'}, status=404)

        if not vb.next_book_number:
            return Response({'error': 'No queued next book found.'}, status=400)

        # Roll over
        vb.book_number = vb.next_book_number
        vb.voucher_start = vb.next_voucher_start
        vb.voucher_end = vb.next_voucher_end
        vb.current_voucher = vb.next_current_voucher if vb.next_current_voucher is not None else vb.next_voucher_start
        vb.next_book_number = None
        vb.next_voucher_start = None
        vb.next_voucher_end = None
        vb.next_current_voucher = None
        vb.updated_by = request.user
        vb.save()

        return Response(StaffVoucherBookView._serialize(vb, request))


class StaffVoucherIncrementView(APIView):
    """
    POST /hr/staff-vouchers/<staff_id>/increment/
    Advance the current_voucher by 1. Call this after each successful
    Add Member or Donation Collection save.
    """
    permission_classes = [IsAnyStaff]

    def post(self, request, staff_id):
        from hr_module.models import StaffVoucherBook
        
        # Reuse logic from StaffVoucherView if possible, or duplicate the helper
        from core.models import User, Role
        from hr_module.models import ExecutiveOfficer
        from django.db.models import Q

        user = None
        try:
            user = User.objects.get(pk=staff_id, role=Role.STAFF)
        except User.DoesNotExist:
            try:
                officer = ExecutiveOfficer.objects.get(pk=staff_id)
                user = User.objects.filter(Q(email__iexact=officer.email) | Q(full_name__iexact=officer.full_name), role=Role.STAFF).first()
            except ExecutiveOfficer.DoesNotExist:
                pass

        if not user:
            return Response({'error': 'Staff user account not found.'}, status=404)

        vb, _ = StaffVoucherBook.objects.get_or_create(staff=user)
        # Note: We NO LONGER increment blindly here.
        # It is now atomically handled in Income/Member creation!
        return Response({
            'current_voucher': vb.current_voucher,
            'book_number': vb.book_number,
            'voucher_start': vb.voucher_start,
            'voucher_end': vb.voucher_end,
        })


# ── Promoter Registry ─────────────────────────────────────────────

from hr_module.models import PromoterRegistryEntry
from hr_module.serializers import PromoterRegistrySerializer
from accounts_module.models import Income as _Income
from django.utils import timezone as _tz
from django.db.models import Sum, Q as _Q


def _sync_registry_totals(entry):
    """Re-compute cash_collected/online_collected from Income records."""
    incomes = _Income.objects.filter(created_by=entry.promoter, date=entry.date)
    agg = incomes.aggregate(
        cash=Sum('amount', filter=_Q(payment_method='CASH')),
        online=Sum('amount', filter=~_Q(payment_method='CASH')),
    )
    entry.cash_collected = agg['cash'] or 0
    entry.online_collected = agg['online'] or 0
    entry.save(update_fields=['cash_collected', 'online_collected'])


class PromoterRegistryListCreateView(generics.ListCreateAPIView):
    """
    GET  /hr/promoter-registry/?date=YYYY-MM-DD
    POST /hr/promoter-registry/
    """
    permission_classes = [IsAnyStaff]
    serializer_class = PromoterRegistrySerializer
    queryset = PromoterRegistryEntry.objects.select_related('promoter', 'created_by').all()
    filterset_fields = ['promoter', 'date', 'is_closed']
    search_fields = ['entry_code', 'promoter__full_name']
    ordering_fields = ['-date', '-created_at']

    def perform_create(self, serializer):
        entry = serializer.save(created_by=self.request.user)
        _sync_registry_totals(entry)


class PromoterRegistryDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET, PATCH, DELETE /hr/promoter-registry/<pk>/
    PATCH {"is_closed": true} closes the day for that promoter.
    """
    permission_classes = [IsAnyStaff]
    serializer_class = PromoterRegistrySerializer
    queryset = PromoterRegistryEntry.objects.select_related('promoter', 'created_by').all()

    def perform_update(self, serializer):
        instance = self.get_object()
        kwargs = {}
        closing = self.request.data.get('is_closed') and not instance.is_closed
        if closing:
            kwargs['closed_at'] = _tz.now()
            kwargs['closed_by'] = self.request.user
        _sync_registry_totals(instance)
        instance.refresh_from_db()
        serializer.save(**kwargs)


class PromoterRegistryDailySummaryView(APIView):
    """
    GET /hr/promoter-registry/daily-summary/?date=YYYY-MM-DD
    Returns a row for EVERY staff member who is marked PRESENT on that date
    (from Attendance), merged with their Income totals and any existing registry entry.
    """
    permission_classes = [IsAnyStaff]

    def get(self, request):
        date_str = request.query_params.get('date', str(_tz.localdate()))
        verification_status = request.query_params.get('verification_status')
        try:
            from datetime import date as _date
            target_date = _date.fromisoformat(date_str)
        except ValueError:
            return Response({'error': 'Invalid date format. Use YYYY-MM-DD.'}, status=400)

        from core.models import Role, User

        # ── 1. All STAFF marked PRESENT on this date ────────────────
        staff_users = User.objects.filter(role=Role.STAFF)
        staff_by_email = {u.email.lower(): str(u.id) for u in staff_users if u.email}
        staff_by_name = {u.full_name.lower(): str(u.id) for u in staff_users if u.full_name}

        present_attendances = (
            Attendance.objects
            .filter(date=target_date, status__in=['PRESENT', 'LATE', 'HALF_DAY'])
            .select_related('employee')
        )
        
        present_staff = {}
        for a in present_attendances:
            if not a.employee:
                continue
                
            user_id = None
            if a.employee.email and a.employee.email.lower() in staff_by_email:
                user_id = staff_by_email[a.employee.email.lower()]
            elif a.employee.full_name and a.employee.full_name.lower() in staff_by_name:
                user_id = staff_by_name[a.employee.full_name.lower()]
                
            if user_id:
                present_staff[user_id] = a.employee.full_name

        # ── 2. Income totals for this date, grouped by creator ───────
        incomes = _Income.objects.filter(date=target_date).select_related('created_by')
        totals = {}
        for inc in incomes:
            if not inc.created_by_id:
                continue
            sid = str(inc.created_by_id)
            if sid not in totals:
                totals[sid] = {
                    'staff_name': inc.created_by.full_name if inc.created_by else '',
                    'cash': 0, 'online': 0,
                    'cash_count': 0, 'online_count': 0,
                    'receipts': []
                }
            if inc.payment_method == 'CASH':
                totals[sid]['cash'] += float(inc.amount)
                totals[sid]['cash_count'] += 1
            else:
                totals[sid]['online'] += float(inc.amount)
                totals[sid]['online_count'] += 1
                
            # Track receipts to find min and max
            ref = inc.reference_number or inc.receipt_number
            if ref and ref.isdigit():
                totals[sid]['receipts'].append(int(ref))

        # ── 3. Existing registry entries for this date ───────────────
        entries = {
            str(e.promoter_id): e
            for e in PromoterRegistryEntry.objects.filter(date=target_date).select_related('promoter', 'closed_by')
        }

        # ── 3.5. Fetch Voucher Books for all staff ───────────────────
        from hr_module.models import StaffVoucherBook
        voucher_books = {
            str(vb.staff_id): {
                'book_number': vb.book_number,
                'voucher_end': vb.voucher_end,
                'current_voucher': vb.current_voucher,
                'next_book_number': vb.next_book_number
            }
            for vb in StaffVoucherBook.objects.all()
        }

        # ── 4. Merge: union of present staff + income creators + existing entries
        all_ids = set(present_staff.keys()) | set(totals.keys()) | set(entries.keys())

        summary = []
        for sid in all_ids:
            entry = entries.get(sid)
            
            income_data = totals.get(sid, {'cash': 0, 'online': 0, 'staff_name': ''})
            has_collections = income_data['cash'] > 0 or income_data['online'] > 0

            # If a specific verification_status is requested, filter the staff
            if verification_status == 'VERIFIED':
                if not entry or entry.verification_status != 'VERIFIED':
                    continue
            elif verification_status == 'UNVERIFIED':
                if entry and entry.verification_status == 'VERIFIED':
                    continue
            # Prefer name from attendance > income > entry
            name = (
                present_staff.get(sid)
                or (entry.promoter.full_name if entry else None)
                or income_data.get('staff_name', '')
            )
            is_present = sid in present_staff
            vb_info = voucher_books.get(sid)
            
            # Compute auto min and max readings
            receipts = income_data.get('receipts', [])
            auto_starting = min(receipts) if receipts else ''
            auto_ending = max(receipts) if receipts else ''
            
            summary.append({
                'staff_id': sid,
                'staff_name': name,
                'is_present': is_present,
                'cash_collected': income_data['cash'],
                'online_collected': income_data['online'],
                'cash_count': income_data.get('cash_count', 0),
                'online_count': income_data.get('online_count', 0),
                'auto_starting_reading': auto_starting,
                'auto_ending_reading': auto_ending,
                'book_number': str(vb_info['book_number']) if vb_info else '',
                'voucher_book': vb_info,
                'registry_entry': PromoterRegistrySerializer(entry, context={'request': request}).data if entry else None,
                'verification_status': entry.verification_status if entry else 'UNVERIFIED',
                'is_closed': entry.is_closed if entry else False,
            })

        # Sort: present first, then by name
        summary.sort(key=lambda x: (not x['is_present'], x['staff_name']))
        return Response(summary)



class PromoterRegistryCheckClosedView(APIView):
    """
    GET /hr/promoter-registry/is-closed/?staff_id=<uuid>&date=YYYY-MM-DD
    Called by mobile app before allowing a new donation or membership.
    """
    permission_classes = [IsAnyStaff]

    def get(self, request):
        staff_id = request.query_params.get('staff_id')
        date_str = request.query_params.get('date', str(_tz.localdate()))
        if not staff_id:
            return Response({'error': 'staff_id required'}, status=400)
        is_closed = PromoterRegistryEntry.objects.filter(
            promoter_id=staff_id, date=date_str, is_closed=True
        ).exists()
        return Response({'is_closed': is_closed})

class DailyTransactionHistoryView(APIView):
    """
    GET /hr/promoter-registry/transactions/?staff_id=<uuid>&date=YYYY-MM-DD
    Returns detailed transaction history for a specific staff member on a specific date.
    """
    permission_classes = [IsAnyStaff]

    def get(self, request):
        staff_id = request.query_params.get('staff_id')
        date_str = request.query_params.get('date', str(_tz.localdate()))
        
        if not staff_id:
            return Response({'error': 'staff_id required'}, status=400)
            
        try:
            from datetime import date as _date
            target_date = _date.fromisoformat(date_str)
        except ValueError:
            return Response({'error': 'Invalid date format. Use YYYY-MM-DD.'}, status=400)

        from accounts_module.models import Income
        
        incomes = Income.objects.filter(created_by_id=staff_id, date=target_date).order_by('created_at')
        
        cash_transactions = []
        online_transactions = []
        
        for inc in incomes:
            data = {
                'id': str(inc.id),
                'receipt_number': inc.reference_number or inc.receipt_number,
                'amount': float(inc.amount),
                'time': _tz.localtime(inc.created_at).strftime('%I:%M %p') if inc.created_at else '',
                'donor_name': inc.donor_name,
                'phone': inc.donor_phone,
                'remarks': inc.purpose,
                'payment_method': inc.payment_method,
                'source': inc.source
            }
            if inc.payment_method == 'CASH':
                cash_transactions.append(data)
            else:
                online_transactions.append(data)
                
        return Response({
            'cash': cash_transactions,
            'online': online_transactions,
            'cash_total': sum(t['amount'] for t in cash_transactions),
            'online_total': sum(t['amount'] for t in online_transactions),
        })



class MemberPayOnlineView(APIView):
    """
    Records an online membership fee payment (via manual UPI or gateway)
    creating an official Income entry and syncing with accounts ledger & dashboard.
    """
    permission_classes = [IsOwnerOrManagerOrHR]

    def get_permissions(self):
        from rest_framework.permissions import IsAuthenticated
        return [IsAuthenticated()]

    def post(self, request):
        user = request.user
        amount = request.data.get('amount') or getattr(user, 'monthly_fee', 100) or 100
        upi_ref = str(request.data.get('upi_ref') or request.data.get('reference_number') or '').strip()

        try:
            amount = float(amount)
            if amount <= 0:
                amount = 100.0
        except (ValueError, TypeError):
            amount = 100.0

        if not upi_ref:
            upi_ref = f"UPI-{timezone.now().strftime('%Y%m%d%H%M%S')}"

        from accounts_module.models import Income, BankAccount, BankTransaction, DonationPayment, PaymentType, PaymentGatewayStatus
        from datetime import date

        bank_acc = BankAccount.objects.filter(is_active=True).first()

        donor_name = user.full_name or user.username or 'Trust Member'
        donor_phone = str(getattr(user, 'phone', '') or getattr(user, 'username', '') or '')

        income = Income.objects.create(
            donor_name=donor_name,
            donor_phone=donor_phone,
            source='MEMBERSHIP',
            amount=amount,
            payment_method='UPI',
            purpose=f"Monthly Membership Fee (UPI Ref: {upi_ref})",
            reference_number=upi_ref,
            account_type='BANK',
            bank_account=bank_acc,
            created_by=user,
            date=date.today()
        )

        # Update Bank Account Balance and Transaction Log
        if bank_acc:
            new_bal = bank_acc.current_balance + amount
            BankTransaction.objects.create(
                bank_account=bank_acc,
                transaction_type='DEPOSIT',
                date=income.date,
                description=f"Membership Fee: {donor_name}",
                reference_id=income.receipt_number,
                payment_method='UPI',
                amount=amount,
                balance_after=new_bal,
                utr_number=upi_ref,
                created_by=user
            )
            bank_acc.current_balance = new_bal
            bank_acc.save(update_fields=['current_balance'])

        # Record DonationPayment for unified transaction logs
        DonationPayment.objects.create(
            donor_user=user,
            donor_name=donor_name,
            donor_phone=donor_phone,
            amount=amount,
            payment_type=PaymentType.ONE_TIME,
            purpose='Membership Fee',
            status=PaymentGatewayStatus.SUCCESS,
            razorpay_payment_id=upi_ref,
            income=income
        )

        # Clear cached subscription on user
        if hasattr(user, '_cached_subscription_info'):
            delattr(user, '_cached_subscription_info')

        # Broadcast live dashboard refresh
        try:
            push_dashboard_refresh(['ACCOUNTANT', 'MANAGER', 'ADMIN', 'STAFF', 'DATA_ENTRY', 'MEMBER'], user_id=user.id if user else None)
        except Exception:
            pass

        return Response({
            'success': True,
            'message': 'Membership payment recorded successfully!',
            'receipt_number': income.receipt_number,
            'amount': float(income.amount),
            'date': str(income.date)
        }, status=status.HTTP_201_CREATED)


class MemberMarkPaidOfficeView(APIView):
    """
    Records an in-person / office cash membership fee payment.
    """
    def get_permissions(self):
        from rest_framework.permissions import IsAuthenticated
        return [IsAuthenticated()]

    def post(self, request):
        user = request.user
        amount = request.data.get('amount') or getattr(user, 'monthly_fee', 100) or 100
        try:
            amount = float(amount)
            if amount <= 0:
                amount = 100.0
        except (ValueError, TypeError):
            amount = 100.0

        from accounts_module.models import Income, CashAccount, CashTransaction, DonationPayment, PaymentType, PaymentGatewayStatus
        from datetime import date

        cash_acc = CashAccount.objects.filter(is_active=True).first()
        ref_no = f"OFFICE-{timezone.now().strftime('%Y%m%d%H%M%S')}"

        donor_name = user.full_name or user.username or 'Trust Member'
        donor_phone = str(getattr(user, 'phone', '') or getattr(user, 'username', '') or '')

        income = Income.objects.create(
            donor_name=donor_name,
            donor_phone=donor_phone,
            source='MEMBERSHIP',
            amount=amount,
            payment_method='CASH',
            purpose='Monthly Membership Fee (Office Cash)',
            reference_number=ref_no,
            account_type='CASH',
            cash_account=cash_acc,
            created_by=user,
            date=date.today()
        )

        if cash_acc:
            new_bal = cash_acc.current_balance + amount
            CashTransaction.objects.create(
                cash_account=cash_acc,
                transaction_type='RECEIPT',
                date=income.date,
                description=f"Membership Cash: {donor_name}",
                reference_id=income.receipt_number,
                payment_method='CASH',
                amount=amount,
                balance_after=new_bal,
                created_by=user
            )
            cash_acc.current_balance = new_bal
            cash_acc.save(update_fields=['current_balance'])

        DonationPayment.objects.create(
            donor_user=user,
            donor_name=donor_name,
            donor_phone=donor_phone,
            amount=amount,
            payment_type=PaymentType.ONE_TIME,
            purpose='Membership Fee',
            status=PaymentGatewayStatus.SUCCESS,
            razorpay_payment_id=ref_no,
            income=income
        )

        if hasattr(user, '_cached_subscription_info'):
            delattr(user, '_cached_subscription_info')

        try:
            push_dashboard_refresh(['ACCOUNTANT', 'MANAGER', 'ADMIN', 'STAFF', 'DATA_ENTRY', 'MEMBER'], user_id=user.id if user else None)
        except Exception:
            pass

        return Response({
            'success': True,
            'message': 'Office payment recorded successfully!',
            'receipt_number': income.receipt_number,
            'amount': float(income.amount),
            'date': str(income.date)
        }, status=status.HTTP_201_CREATED)
