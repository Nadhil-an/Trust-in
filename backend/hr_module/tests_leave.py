from datetime import date, timedelta
from decimal import Decimal
from django.test import TestCase
from rest_framework.test import APIClient
from django.utils import timezone
from django.core.exceptions import ValidationError
from core.models import User, Role
from hr_module.models import (
    ExecutiveOfficer,
    LeaveRequest,
    Attendance,
    AttendanceStatus,
    LeaveHRNote,
    LeaveHRCommunication,
    LeaveAuditLog,
)
from hr_module.leave_service import (
    calculate_leave_days_breakdown,
    get_approved_leave_days_in_month,
    validate_leave_application,
    approve_leave_request,
    reject_leave_request,
    cancel_leave_request,
    get_leave_balance_summary,
    MONTHLY_STANDARD_LIMIT,
)


class LeaveManagementSystemTests(TestCase):
    def setUp(self):
        # Create Users
        self.manager_user = User.objects.create_user(
            username='manager_raj',
            email='raj.manager@trust.org',
            full_name='Rajesh Manager',
            role=Role.MANAGER,
            password='password123'
        )
        self.hr_user = User.objects.create_user(
            username='hr_priya',
            email='priya.hr@trust.org',
            full_name='Priya HR',
            role=Role.HR,
            password='password123'
        )
        self.staff_user = User.objects.create_user(
            username='staff_anand',
            email='anand.staff@trust.org',
            full_name='Anand Staff',
            role=Role.STAFF,
            password='password123'
        )

        # Create corresponding ExecutiveOfficer for staff
        self.employee = ExecutiveOfficer.objects.create(
            employee_id='EMP-00101',
            full_name='Anand Staff',
            email='anand.staff@trust.org',
            phone='9876543210',
            designation='Staff',
            department='Field Ops',
            status='ACTIVE',
            created_by=self.manager_user
        )

        self.today = timezone.localtime(timezone.now()).date()

    def test_standard_leave_within_monthly_limit(self):
        """Staff requests 2 days within the monthly allowance."""
        start = self.today + timedelta(days=2)
        end = self.today + timedelta(days=3)

        days_by_month, total_days, exceeds_limit, notice = validate_leave_application(
            employee=self.employee,
            from_date=start,
            to_date=end,
            application_date=self.today
        )

        self.assertEqual(total_days, Decimal('2.0'))
        self.assertFalse(exceeds_limit)

    def test_leave_exceeding_monthly_limit_without_notice_fails(self):
        """Staff requests 3 days (exceeds 2-day limit) with only 5 days notice -> Must fail."""
        start = self.today + timedelta(days=5)
        end = self.today + timedelta(days=7)  # 3 days

        with self.assertRaises(ValidationError) as ctx:
            validate_leave_application(
                employee=self.employee,
                from_date=start,
                to_date=end,
                application_date=self.today
            )
        self.assertIn("exceeds the monthly allowance of 2.0 days", str(ctx.exception))
        self.assertIn("at least 15 calendar days in advance", str(ctx.exception))

    def test_leave_exceeding_monthly_limit_with_15_day_notice_passes(self):
        """Staff requests 4 days with 20 days notice -> Must pass with exceeds_monthly_limit=True."""
        start = self.today + timedelta(days=20)
        end = self.today + timedelta(days=23)  # 4 days

        days_by_month, total_days, exceeds_limit, notice = validate_leave_application(
            employee=self.employee,
            from_date=start,
            to_date=end,
            application_date=self.today
        )
        self.assertEqual(total_days, Decimal('4.0'))
        self.assertTrue(exceeds_limit)
        self.assertEqual(notice, 20)

    def test_monthly_limit_counts_only_approved_days(self):
        """Pending and Rejected applications do not count towards the 2-day limit."""
        p_start = self.today + timedelta(days=2)
        p_end = self.today + timedelta(days=3)
        LeaveRequest.objects.create(
            employee=self.employee,
            staff_user=self.staff_user,
            from_date=p_start,
            to_date=p_end,
            number_of_days=Decimal('2.0'),
            reason="Pending check",
            status='PENDING'
        )

        r_start = self.today + timedelta(days=5)
        r_end = self.today + timedelta(days=6)
        LeaveRequest.objects.create(
            employee=self.employee,
            staff_user=self.staff_user,
            from_date=r_start,
            to_date=r_end,
            number_of_days=Decimal('2.0'),
            reason="Rejected check",
            status='REJECTED',
            rejection_reason="Test"
        )

        approved = get_approved_leave_days_in_month(self.employee, self.today.year, self.today.month)
        self.assertEqual(approved, Decimal('0.0'))

    def test_half_day_leave_calculation(self):
        """Half-day leave counts as 0.5 days."""
        target = self.today + timedelta(days=3)
        days_by_month, total_days, exceeds_limit, _ = validate_leave_application(
            employee=self.employee,
            from_date=target,
            to_date=target,
            is_half_day=True,
            application_date=self.today
        )
        self.assertEqual(total_days, Decimal('0.5'))
        self.assertFalse(exceeds_limit)

    def test_overlapping_leave_validation(self):
        """Cannot submit overlapping pending or approved leave."""
        d1 = self.today + timedelta(days=5)
        d2 = self.today + timedelta(days=6)

        LeaveRequest.objects.create(
            employee=self.employee,
            staff_user=self.staff_user,
            from_date=d1,
            to_date=d2,
            number_of_days=Decimal('2.0'),
            reason="Trip",
            status='PENDING'
        )

        d3 = self.today + timedelta(days=6)
        d4 = self.today + timedelta(days=7)

        with self.assertRaises(ValidationError) as ctx:
            validate_leave_application(
                employee=self.employee,
                from_date=d3,
                to_date=d4,
                application_date=self.today
            )
        self.assertIn("overlapping dates", str(ctx.exception))

    def test_manager_approval_creates_attendance_and_audit(self):
        """Manager approves leave -> Attendance updated to LEAVE, audit log recorded."""
        start = self.today + timedelta(days=2)
        end = self.today + timedelta(days=3)

        leave = LeaveRequest.objects.create(
            employee=self.employee,
            staff_user=self.staff_user,
            from_date=start,
            to_date=end,
            number_of_days=Decimal('2.0'),
            reason="Personal",
            status='PENDING'
        )

        approve_leave_request(leave, self.manager_user)

        leave.refresh_from_db()
        self.assertEqual(leave.status, 'APPROVED')
        self.assertEqual(leave.approved_by, self.manager_user)

        att_records = Attendance.objects.filter(employee=self.employee, date__in=[start, end])
        self.assertEqual(att_records.count(), 2)
        for att in att_records:
            self.assertEqual(att.status, AttendanceStatus.LEAVE)

        audit = LeaveAuditLog.objects.filter(leave_request=leave, action='APPROVED').first()
        self.assertIsNotNone(audit)
        self.assertEqual(audit.actor, self.manager_user)

    def test_manager_rejection_requires_reason(self):
        """Manager rejection must fail if reason is empty, and succeed with reason."""
        start = self.today + timedelta(days=2)
        end = self.today + timedelta(days=2)

        leave = LeaveRequest.objects.create(
            employee=self.employee,
            staff_user=self.staff_user,
            from_date=start,
            to_date=end,
            number_of_days=Decimal('1.0'),
            reason="Urgent work",
            status='PENDING'
        )

        with self.assertRaises(ValidationError):
            reject_leave_request(leave, self.manager_user, "")

        reject_leave_request(leave, self.manager_user, "Project deadline conflicts with this date.")
        leave.refresh_from_db()
        self.assertEqual(leave.status, 'REJECTED')
        self.assertEqual(leave.rejection_reason, "Project deadline conflicts with this date.")

        audit = LeaveAuditLog.objects.filter(leave_request=leave, action='REJECTED').first()
        self.assertIsNotNone(audit)

    def test_reapplication_after_rejection(self):
        """Staff member can reapply with new dates after rejection, preserving history."""
        start1 = self.today + timedelta(days=2)
        leave1 = LeaveRequest.objects.create(
            employee=self.employee,
            staff_user=self.staff_user,
            from_date=start1,
            to_date=start1,
            number_of_days=Decimal('1.0'),
            reason="Trip 1",
            status='PENDING'
        )
        reject_leave_request(leave1, self.manager_user, "Not approved for this date")
        leave1.refresh_from_db()

        # Staff creates a reapplication for a different date
        start2 = self.today + timedelta(days=10)
        leave2 = LeaveRequest.objects.create(
            employee=self.employee,
            staff_user=self.staff_user,
            from_date=start2,
            to_date=start2,
            number_of_days=Decimal('1.0'),
            reason="Trip 2 (rescheduled)",
            status='PENDING',
            reapplication_of=leave1
        )

        self.assertEqual(leave2.reapplication_of.id, leave1.id)
        self.assertEqual(leave1.status, 'REJECTED')
        self.assertEqual(leave2.status, 'PENDING')
        self.assertIn(leave2, leave1.reapplications.all())

    def test_hr_cannot_approve_or_reject_endpoint(self):
        """HR role attempting to call action endpoint must get 403 Forbidden."""
        client = APIClient()
        client.force_authenticate(user=self.hr_user)

        start = self.today + timedelta(days=2)
        leave = LeaveRequest.objects.create(
            employee=self.employee,
            staff_user=self.staff_user,
            from_date=start,
            to_date=start,
            number_of_days=Decimal('1.0'),
            reason="Test",
            status='PENDING'
        )

        # HR attempts approve
        res = client.post(f'/api/hr/leave/{leave.id}/action/', {'action': 'approve'}, format='json')
        self.assertEqual(res.status_code, 403)
        self.assertIn("HR staff cannot approve or reject", res.json()['error'])

        # Manager attempts approve
        client.force_authenticate(user=self.manager_user)
        res_mgr = client.post(f'/api/hr/leave/{leave.id}/action/', {'action': 'approve'}, format='json')
        self.assertEqual(res_mgr.status_code, 200)
        self.assertEqual(res_mgr.json()['status'], 'APPROVED')

    def test_hr_notes_and_communications(self):
        """HR can add internal notes and send communication messages to staff."""
        client = APIClient()
        client.force_authenticate(user=self.hr_user)

        start = self.today + timedelta(days=2)
        leave = LeaveRequest.objects.create(
            employee=self.employee,
            staff_user=self.staff_user,
            from_date=start,
            to_date=start,
            number_of_days=Decimal('1.0'),
            reason="Test",
            status='PENDING'
        )

        # Add internal HR note
        res_note = client.post(f'/api/hr/leave/{leave.id}/notes/', {'note': 'Reviewed employee attendance record: 98% this month.'}, format='json')
        self.assertEqual(res_note.status_code, 201)
        self.assertEqual(LeaveHRNote.objects.filter(leave_request=leave).count(), 1)

        # Send communication to staff
        res_comm = client.post(f'/api/hr/leave/{leave.id}/communicate/', {'message': 'Manager will review your request by tomorrow 5 PM.', 'is_decision_communicated': False}, format='json')
        self.assertEqual(res_comm.status_code, 201)
        self.assertEqual(LeaveHRCommunication.objects.filter(leave_request=leave).count(), 1)

        # Verify staff can read communication
        client.force_authenticate(user=self.staff_user)
        res_staff_read = client.get(f'/api/hr/leave/{leave.id}/communicate/')
        self.assertEqual(res_staff_read.status_code, 200)
        self.assertEqual(len(res_staff_read.json()), 1)

        # Verify staff CANNOT read internal HR note (must be 403)
        res_staff_note = client.get(f'/api/hr/leave/{leave.id}/notes/')
        self.assertEqual(res_staff_note.status_code, 403)
