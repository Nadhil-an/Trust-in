import logging
from decimal import Decimal
from datetime import date
from django.utils import timezone
from django.db import transaction
from django.db.models import Sum, Q, Count

from core.models import (
    MemberInteraction,
    MemberTask,
    BadgeDefinition,
    MemberBadge,
    MemberAchievement,
    VolunteerAllowanceRecord,
    MemberAppreciation,
    MemberPost,
    User,
    TaskStatus,
    AuditLog,
)
from hr_module.models import Member, Volunteer
from notify.service import push_notification

logger = logging.getLogger(__name__)


class BadgeEngine:
    """
    Evaluates Trust members for progressive badges according to established business logic:
    🟨 Yellow Badge: 10 referrals/mo, ₹1,000 daily collection, 5 services. Permanent after 2 consecutive months.
    🟩 Green Badge:  13 referrals/mo, ₹1,250 daily collection, 7 services. Permanent on 1st achievement.
    🍊 Orange Badge: 16 referrals/mo, ₹1,562.50 daily collection, 9 services. Permanent on 1st achievement.
    🟦 Blue Badge:   20 referrals/mo, ₹1,953.13 daily collection, 12 services. Permanent on 1st achievement.
    🟥 Maroon Volunteer Badge: Requires earned Green Badge + approved Volunteer application.
    """

    @staticmethod
    def get_current_period():
        today = timezone.localdate()
        return f"{today.year}-{today.month:02d}"

    @classmethod
    def calculate_member_metrics(cls, member, period_str=None):
        if not period_str:
            period_str = cls.get_current_period()
            
        try:
            year, month = map(int, period_str.split('-'))
        except Exception:
            today = timezone.localdate()
            year, month = today.year, today.month

        # 1. Referrals count: members created with remarks or created_by referencing this member
        user_match = None
        if hasattr(member, 'created_by') and member.created_by:
            user_match = member.created_by
        else:
            user_match = User.objects.filter(full_name__iexact=member.full_name).first()

        referrals_count = 0
        if user_match:
            referrals_count = Member.objects.filter(
                created_by=user_match,
                joining_date__year=year,
                joining_date__month=month
            ).count()

        # 2. Daily collection / donations
        from accounts_module.models import Income
        total_collections = Decimal('0.00')
        q_income = Q(created_at__year=year, created_at__month=month)
        if user_match:
            q_income &= (Q(created_by=user_match) | Q(donor_name__iexact=member.full_name))
        else:
            q_income &= Q(donor_name__iexact=member.full_name)

        income_agg = Income.objects.filter(q_income).aggregate(total=Sum('amount'))
        total_month_amount = Decimal(str(income_agg['total'] or '0.00'))
        # Approximate daily collection based on 30 days
        daily_collection = total_month_amount / Decimal('30.00')

        # 3. Verified Trust services (completed MemberTasks of category SERVICE or GENERAL)
        verified_services = MemberTask.objects.filter(
            member=member,
            status=TaskStatus.COMPLETED,
            reviewed_at__year=year,
            reviewed_at__month=month
        ).count()

        return {
            'period': period_str,
            'referrals_count': referrals_count,
            'daily_collection': daily_collection,
            'total_month_amount': total_month_amount,
            'verified_services': verified_services
        }

    @classmethod
    def evaluate_member(cls, member, period_str=None, awarded_by=None):
        if not period_str:
            period_str = cls.get_current_period()

        metrics = cls.calculate_member_metrics(member, period_str)
        awarded_badges = []

        definitions = BadgeDefinition.objects.filter(is_active=True).order_by('daily_collection_target')

        for badge in definitions:
            key = badge.badge_key.upper()

            # Safeguard: Do not award duplicate badge for the exact same qualifying period
            existing = MemberBadge.objects.filter(
                member=member,
                badge=badge,
                qualifying_period=period_str
            ).first()
            if existing:
                continue

            qualified = False
            is_permanent = badge.is_permanent_default

            if key == 'MAROON':
                # Maroon requires Green badge + Approved Volunteer application
                has_green = MemberBadge.objects.filter(member=member, badge__badge_key='GREEN').exists()
                is_vol_approved = Volunteer.objects.filter(
                    Q(full_name__iexact=member.full_name) | Q(phone=member.phone),
                    status='APPROVED'
                ).exists()
                if has_green and is_vol_approved:
                    qualified = True
                    is_permanent = True

            else:
                # Ordinary progressive badges
                meets_referrals = metrics['referrals_count'] >= badge.min_referrals_monthly
                meets_target = metrics['daily_collection'] >= badge.daily_collection_target
                meets_services = metrics['verified_services'] >= badge.min_services_monthly

                if meets_referrals and meets_target and meets_services:
                    if badge.consecutive_months_required > 1:
                        # Check previous month qualification
                        prev_period = cls._get_previous_period(period_str)
                        had_prev = MemberBadge.objects.filter(
                            member=member,
                            badge=badge,
                            qualifying_period=prev_period
                        ).exists()
                        if had_prev:
                            is_permanent = True
                    qualified = True

            if qualified:
                # Calculate times earned across all historical periods
                previous_awards = MemberBadge.objects.filter(member=member, badge=badge)
                times = previous_awards.count() + 1
                was_already_permanent = previous_awards.filter(is_permanent=True).exists()
                final_permanence = is_permanent or was_already_permanent

                new_award = MemberBadge.objects.create(
                    member=member,
                    badge=badge,
                    qualifying_period=period_str,
                    is_permanent=final_permanence,
                    times_earned=times,
                    award_source='AUTOMATIC',
                    reason=f"Achieved criteria for {period_str}: {metrics['referrals_count']} referrals, INR {metrics['daily_collection']:.2f}/day collection, {metrics['verified_services']} verified services.",
                    awarded_by=awarded_by
                )
                awarded_badges.append(new_award)

                # Create corresponding MemberAchievement record
                MemberAchievement.objects.create(
                    member=member,
                    category='SERVICE',
                    title=f"Earned {badge.name} ({period_str})",
                    description=new_award.reason,
                    qualifying_period=period_str,
                    award_source='AUTOMATIC',
                    awarded_by=awarded_by
                )

                # Send Notification if user is linked
                cls._notify_member_badge(member, badge)

        return awarded_badges

    @classmethod
    def award_badge_manually(cls, member, badge_key, awarded_by, reason, period_str=None, is_permanent=False):
        if not reason or not reason.strip():
            raise ValueError("A mandatory justification reason is required for manual badge awards.")

        if not period_str:
            period_str = cls.get_current_period()

        badge = BadgeDefinition.objects.get(badge_key=badge_key)

        existing = MemberBadge.objects.filter(
            member=member,
            badge=badge,
            qualifying_period=period_str
        ).first()

        if existing:
            # Update existing with audit log
            existing.times_earned += 1
            if is_permanent:
                existing.is_permanent = True
            existing.reason = f"{existing.reason} | Manual adjustment: {reason}"
            existing.save()
            award = existing
        else:
            previous_awards = MemberBadge.objects.filter(member=member, badge=badge)
            times = previous_awards.count() + 1
            final_permanence = is_permanent or badge.is_permanent_default or previous_awards.filter(is_permanent=True).exists()

            award = MemberBadge.objects.create(
                member=member,
                badge=badge,
                qualifying_period=period_str,
                is_permanent=final_permanence,
                times_earned=times,
                award_source='MANUAL',
                reason=reason,
                awarded_by=awarded_by
            )

        # Record Achievement
        MemberAchievement.objects.create(
            member=member,
            category='SPECIAL',
            title=f"Special Recognition: {badge.name}",
            description=reason,
            qualifying_period=period_str,
            award_source='MANUAL',
            awarded_by=awarded_by,
            evidence=f"Manually approved by {awarded_by.full_name if awarded_by else 'Admin'}"
        )

        # Audit Log
        if awarded_by:
            AuditLog.objects.create(
                user=awarded_by,
                action='MANUAL_BADGE_AWARD',
                module='MRM',
                description=f"Awarded {badge.name} to {member.full_name} for {period_str}. Reason: {reason}"
            )

        cls._notify_member_badge(member, badge)
        return award

    @staticmethod
    def _notify_member_badge(member, badge):
        user = None
        if hasattr(member, 'created_by') and member.created_by:
            user = member.created_by
        else:
            user = User.objects.filter(full_name__iexact=member.full_name).first()
        if user:
            try:
                push_notification(
                    recipient=user,
                    title=f"🎉 You earned the {badge.name}!",
                    message=f"Congratulations {member.full_name}! The Trust has recognized your dedication with the {badge.icon} {badge.name}.",
                    notification_type='SYSTEM'
                )
            except Exception as e:
                logger.warning(f"Failed to dispatch badge push notification: {e}")

    @staticmethod
    def _get_previous_period(period_str):
        try:
            year, month = map(int, period_str.split('-'))
            if month == 1:
                return f"{year - 1}-12"
            return f"{year}-{month - 1:02d}"
        except Exception:
            return period_str


class TaskWorkflowService:
    """
    Manages task assignments, evidence submission, and state-transitions with backend verification.
    """

    ALLOWED_TRANSITIONS = {
        TaskStatus.DRAFT: [TaskStatus.ASSIGNED, TaskStatus.CANCELLED],
        TaskStatus.ASSIGNED: [TaskStatus.IN_PROGRESS, TaskStatus.SUBMITTED, TaskStatus.CANCELLED, TaskStatus.OVERDUE],
        TaskStatus.IN_PROGRESS: [TaskStatus.SUBMITTED, TaskStatus.CANCELLED, TaskStatus.OVERDUE],
        TaskStatus.SUBMITTED: [TaskStatus.COMPLETED, TaskStatus.REJECTED, TaskStatus.IN_PROGRESS],
        TaskStatus.REJECTED: [TaskStatus.IN_PROGRESS, TaskStatus.CANCELLED],
        TaskStatus.OVERDUE: [TaskStatus.IN_PROGRESS, TaskStatus.SUBMITTED, TaskStatus.CANCELLED],
        TaskStatus.COMPLETED: [],
        TaskStatus.CANCELLED: [],
    }

    @classmethod
    def submit_task_progress(cls, task, achieved_value, evidence_notes=None, evidence_file=None):
        task.achieved_value = Decimal(str(achieved_value))
        if evidence_notes:
            task.evidence_notes = evidence_notes
        if evidence_file:
            task.evidence_file = evidence_file
        task.submitted_at = timezone.now()

        # If task does not require verification, direct completion can occur
        if not task.requires_verification and task.achieved_value >= task.target_value:
            task.status = TaskStatus.COMPLETED
        else:
            task.status = TaskStatus.SUBMITTED

        task.save()
        return task

    @classmethod
    def review_task(cls, task, reviewer, status, review_notes=None, achieved_value=None):
        if status not in [TaskStatus.COMPLETED, TaskStatus.REJECTED, TaskStatus.IN_PROGRESS]:
            raise ValueError(f"Invalid review target status: {status}")

        if achieved_value is not None:
            task.achieved_value = Decimal(str(achieved_value))

        task.status = status
        task.reviewed_by = reviewer
        task.reviewed_at = timezone.now()
        if review_notes:
            task.review_notes = review_notes

        task.save()

        # If completed, check for possible badge trigger
        if status == TaskStatus.COMPLETED:
            BadgeEngine.evaluate_member(task.member)

        return task


class VolunteerAllowanceService:
    """
    Validates established monthly volunteer allowances:
    Petrol: ₹2,000 | Recharge: ₹399 | Trip: ₹3,000 | Total Limit: ₹5,399
    """
    MAX_PETROL = Decimal('2000.00')
    MAX_RECHARGE = Decimal('399.00')
    MAX_TRIP = Decimal('3000.00')
    MAX_TOTAL = Decimal('5399.00')

    @classmethod
    def create_or_update_record(cls, volunteer, month, year, petrol, recharge, trip, notes='', requested_by=None):
        petrol_dec = min(Decimal(str(petrol)), cls.MAX_PETROL)
        recharge_dec = min(Decimal(str(recharge)), cls.MAX_RECHARGE)
        trip_dec = min(Decimal(str(trip)), cls.MAX_TRIP)
        total_dec = petrol_dec + recharge_dec + trip_dec

        record, created = VolunteerAllowanceRecord.objects.update_or_create(
            volunteer=volunteer,
            month=month,
            year=year,
            defaults={
                'petrol_allowance': petrol_dec,
                'recharge_allowance': recharge_dec,
                'trip_allowance': trip_dec,
                'total_approved': total_dec,
                'notes': notes,
            }
        )
        return record

    @classmethod
    def approve_allowance(cls, record_id, approved_by, status='APPROVED', notes=None):
        record = VolunteerAllowanceRecord.objects.get(id=record_id)
        record.status = status
        record.approved_by = approved_by
        record.approved_at = timezone.now()
        if notes:
            record.notes = f"{record.notes}\n[Review] {notes}".strip()
        record.save()
        return record
