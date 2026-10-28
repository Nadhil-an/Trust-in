import calendar
from datetime import date, timedelta
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError
from hr_module.models import (
    LeaveRequest,
    LeaveAuditLog,
    Attendance,
    AttendanceStatus,
    ExecutiveOfficer,
)
from notify.service import push_notification, push_to_role, push_dashboard_refresh

MONTHLY_STANDARD_LIMIT = Decimal('2.0')
ADVANCE_NOTICE_DAYS_REQUIRED = 15


def calculate_leave_days_breakdown(from_date: date, to_date: date, is_half_day: bool = False):
    """
    Splits the requested date range into calendar month buckets and calculates total days.
    Handles half-day (0.5) when from_date == to_date.
    Returns: (days_by_month: dict {(year, month): Decimal}, total_days: Decimal)
    """
    if from_date > to_date:
        raise ValidationError("From date cannot be after to date.")

    if is_half_day:
        if from_date != to_date:
            raise ValidationError("Half-day leave must start and end on the same date.")
        return {(from_date.year, from_date.month): Decimal('0.5')}, Decimal('0.5')

    days_by_month = {}
    current = from_date
    total_days = Decimal('0.0')

    while current <= to_date:
        key = (current.year, current.month)
        days_by_month[key] = days_by_month.get(key, Decimal('0.0')) + Decimal('1.0')
        total_days += Decimal('1.0')
        current += timedelta(days=1)

    return days_by_month, total_days


def get_approved_leave_days_in_month(employee: ExecutiveOfficer, year: int, month: int, exclude_request_id=None) -> Decimal:
    """
    Calculates total manager-approved leave days for an employee in a specific calendar month.
    Excludes pending, rejected, and cancelled applications.
    """
    _, last_day = calendar.monthrange(year, month)
    month_start = date(year, month, 1)
    month_end = date(year, month, last_day)

    qs = LeaveRequest.objects.filter(
        employee=employee,
        status='APPROVED',
        from_date__lte=month_end,
        to_date__gte=month_start
    )
    if exclude_request_id:
        qs = qs.exclude(id=exclude_request_id)

    total = Decimal('0.0')
    for lr in qs:
        if lr.is_half_day:
            if month_start <= lr.from_date <= month_end:
                total += Decimal('0.5')
        else:
            # Overlap between [lr.from_date, lr.to_date] and [month_start, month_end]
            overlap_start = max(lr.from_date, month_start)
            overlap_end = min(lr.to_date, month_end)
            if overlap_start <= overlap_end:
                total += Decimal(str((overlap_end - overlap_start).days + 1))

    return total


def validate_leave_application(
    employee: ExecutiveOfficer,
    from_date: date,
    to_date: date,
    is_half_day: bool = False,
    exclude_request_id=None,
    application_date: date = None
):
    """
    Validates:
    1. Dates validity (from <= to, no past dates)
    2. Overlapping active applications (PENDING or APPROVED)
    3. Monthly limit (2 approved days per month)
    4. If limit exceeded in any month, 15 calendar days advance notice requirement
    Returns: (days_by_month, total_days, exceeds_monthly_limit, notice_days)
    """
    if application_date is None:
        application_date = timezone.localtime(timezone.now()).date()

    if from_date < application_date:
        raise ValidationError("Leave cannot be applied for past dates.")

    days_by_month, total_days = calculate_leave_days_breakdown(from_date, to_date, is_half_day)

    # 1. Overlapping check against PENDING or APPROVED
    overlap_qs = LeaveRequest.objects.filter(
        employee=employee,
        status__in=['PENDING', 'APPROVED'],
        from_date__lte=to_date,
        to_date__gte=from_date
    )
    if exclude_request_id:
        overlap_qs = overlap_qs.exclude(id=exclude_request_id)

    overlapping = overlap_qs.first()
    if overlapping:
        raise ValidationError(
            f"You already have a {overlapping.status.lower()} leave application for overlapping dates "
            f"({overlapping.from_date.strftime('%d %b %Y')} to {overlapping.to_date.strftime('%d %b %Y')})."
        )

    # 2. Check Monthly limit across all affected months
    notice_days = (from_date - application_date).days
    exceeds_monthly_limit = False

    for (y, m), requested_days in days_by_month.items():
        approved_in_month = get_approved_leave_days_in_month(employee, y, m, exclude_request_id)
        projected = approved_in_month + requested_days

        if projected > MONTHLY_STANDARD_LIMIT:
            exceeds_monthly_limit = True
            month_name = calendar.month_name[m]
            if notice_days < ADVANCE_NOTICE_DAYS_REQUIRED:
                raise ValidationError(
                    f"Leave in {month_name} {y} exceeds the monthly allowance of {MONTHLY_STANDARD_LIMIT} days "
                    f"(Approved: {approved_in_month}d, Requesting: {requested_days}d, Projected: {projected}d). "
                    f"Applications exceeding the monthly allowance must be submitted at least {ADVANCE_NOTICE_DAYS_REQUIRED} "
                    f"calendar days in advance (submitted with {notice_days} days notice)."
                )

    return days_by_month, total_days, exceeds_monthly_limit, notice_days


def get_leave_balance_summary(employee: ExecutiveOfficer, target_date: date = None):
    """
    Returns the staff member's leave balance breakdown for the target month.
    """
    if target_date is None:
        target_date = timezone.localtime(timezone.now()).date()

    year = target_date.year
    month = target_date.month
    month_name = calendar.month_name[month]

    approved_days = get_approved_leave_days_in_month(employee, year, month)
    remaining_standard = max(Decimal('0.0'), MONTHLY_STANDARD_LIMIT - approved_days)

    # Pending days in current month
    _, last_day = calendar.monthrange(year, month)
    month_start = date(year, month, 1)
    month_end = date(year, month, last_day)

    pending_qs = LeaveRequest.objects.filter(
        employee=employee,
        status='PENDING',
        from_date__lte=month_end,
        to_date__gte=month_start
    )
    pending_days = Decimal('0.0')
    for lr in pending_qs:
        if lr.is_half_day:
            if month_start <= lr.from_date <= month_end:
                pending_days += Decimal('0.5')
        else:
            o_start = max(lr.from_date, month_start)
            o_end = min(lr.to_date, month_end)
            if o_start <= o_end:
                pending_days += Decimal(str((o_end - o_start).days + 1))

    return {
        'year': year,
        'month': month,
        'month_name': month_name,
        'monthly_limit': float(MONTHLY_STANDARD_LIMIT),
        'approved_days': float(approved_days),
        'pending_days': float(pending_days),
        'remaining_standard_days': float(remaining_standard),
        'policy_rule': (
            f"Staff are allowed up to {MONTHLY_STANDARD_LIMIT} approved leave days per calendar month. "
            f"Leave exceeding this allowance requires at least {ADVANCE_NOTICE_DAYS_REQUIRED} days advance notice "
            "and Manager approval."
        )
    }


def approve_leave_request(leave_request: LeaveRequest, manager_user, ip_address=None):
    """
    Approves a leave request with transaction safety, concurrency checks, attendance syncing, and notifications.
    """
    with transaction.atomic():
        # Lock record to prevent concurrent double-approvals
        leave = LeaveRequest.objects.select_for_update().get(id=leave_request.id)

        if leave.status != 'PENDING':
            raise ValidationError(f"Cannot approve leave request with status '{leave.status}'. Must be PENDING.")

        # Revalidate that concurrent approvals haven't caused a violation
        application_date = leave.applied_at.date() if leave.applied_at else leave.created_at.date()
        validate_leave_application(
            employee=leave.employee,
            from_date=leave.from_date,
            to_date=leave.to_date,
            is_half_day=leave.is_half_day,
            exclude_request_id=leave.id,
            application_date=application_date
        )

        leave.status = 'APPROVED'
        leave.approved_by = manager_user
        leave.approved_at = timezone.now()
        leave.save(update_fields=['status', 'approved_by', 'approved_at'])

        # Update Attendance for the approved days
        curr = leave.from_date
        while curr <= leave.to_date:
            att_status = AttendanceStatus.HALF_DAY if leave.is_half_day else AttendanceStatus.LEAVE
            Attendance.objects.update_or_create(
                employee=leave.employee,
                date=curr,
                defaults={
                    'status': att_status,
                    'marked_by': manager_user,
                    'remarks': f"Leave Approved: {leave.leave_type}" + (f" ({leave.half_day_session})" if leave.is_half_day else "")
                }
            )
            curr += timedelta(days=1)

        # Audit log
        LeaveAuditLog.objects.create(
            leave_request=leave,
            actor=manager_user,
            action='APPROVED',
            details=f"Leave application approved by Manager {manager_user.full_name or manager_user.username}",
            ip_address=ip_address
        )

    # Notifications outside atomic transaction
    target_user = leave.staff_user or getattr(leave.employee, 'created_by', None)
    dates_str = (
        f"{leave.from_date.strftime('%d %b %Y')}" if leave.from_date == leave.to_date
        else f"{leave.from_date.strftime('%d %b %Y')} to {leave.to_date.strftime('%d %b %Y')}"
    )

    if target_user:
        push_notification(
            recipient=target_user,
            title="Leave Request Approved ✅",
            message=f"Your {leave.leave_type} request for {dates_str} ({leave.number_of_days} days) has been approved by Manager {manager_user.full_name or manager_user.username}.",
            notification_type='LEAVE_APPROVED',
            reference_id=str(leave.id),
            reference_type='LEAVE'
        )

    push_to_role(
        role='HR',
        title="Leave Approved by Manager",
        message=f"Manager {manager_user.full_name or manager_user.username} approved leave for {leave.employee.full_name} ({dates_str}).",
        notification_type='LEAVE_APPROVED',
        reference_id=str(leave.id),
        reference_type='LEAVE'
    )

    push_dashboard_refresh(roles=['HR', 'MANAGER', 'STAFF'])
    return leave


def reject_leave_request(leave_request: LeaveRequest, manager_user, rejection_reason: str, ip_address=None):
    """
    Rejects a leave request with mandatory rejection reason, audit log, and notifications.
    """
    reason = (rejection_reason or '').strip()
    if not reason:
        raise ValidationError("Rejection reason is mandatory when rejecting a leave application.")

    with transaction.atomic():
        leave = LeaveRequest.objects.select_for_update().get(id=leave_request.id)

        if leave.status != 'PENDING':
            raise ValidationError(f"Cannot reject leave request with status '{leave.status}'. Must be PENDING.")

        leave.status = 'REJECTED'
        leave.approved_by = manager_user  # decider
        leave.approved_at = timezone.now()
        leave.rejection_reason = reason
        leave.save(update_fields=['status', 'approved_by', 'approved_at', 'rejection_reason'])

        LeaveAuditLog.objects.create(
            leave_request=leave,
            actor=manager_user,
            action='REJECTED',
            details=f"Leave application rejected by Manager {manager_user.full_name or manager_user.username}. Reason: {reason}",
            ip_address=ip_address
        )

    # Notifications
    target_user = leave.staff_user or getattr(leave.employee, 'created_by', None)
    dates_str = (
        f"{leave.from_date.strftime('%d %b %Y')}" if leave.from_date == leave.to_date
        else f"{leave.from_date.strftime('%d %b %Y')} to {leave.to_date.strftime('%d %b %Y')}"
    )

    if target_user:
        push_notification(
            recipient=target_user,
            title="Leave Request Rejected ❌",
            message=f"Your {leave.leave_type} request for {dates_str} was rejected by Manager. Reason: {reason}",
            notification_type='LEAVE_REJECTED',
            reference_id=str(leave.id),
            reference_type='LEAVE'
        )

    push_to_role(
        role='HR',
        title="Leave Rejected by Manager",
        message=f"Manager {manager_user.full_name or manager_user.username} rejected leave for {leave.employee.full_name}. Reason: {reason}",
        notification_type='LEAVE_REJECTED',
        reference_id=str(leave.id),
        reference_type='LEAVE'
    )

    push_dashboard_refresh(roles=['HR', 'MANAGER', 'STAFF'])
    return leave


def cancel_leave_request(leave_request: LeaveRequest, staff_user, ip_address=None):
    """
    Cancels a leave request by staff. Only allowed if status is PENDING.
    """
    with transaction.atomic():
        leave = LeaveRequest.objects.select_for_update().get(id=leave_request.id)

        if leave.status != 'PENDING':
            raise ValidationError(f"Only PENDING leave applications can be cancelled. Current status: '{leave.status}'.")

        leave.status = 'CANCELLED'
        leave.save(update_fields=['status'])

        LeaveAuditLog.objects.create(
            leave_request=leave,
            actor=staff_user,
            action='CANCELLED',
            details=f"Leave application cancelled by staff member {staff_user.full_name or staff_user.username}",
            ip_address=ip_address
        )

    push_dashboard_refresh(roles=['HR', 'MANAGER', 'STAFF'])
    return leave
