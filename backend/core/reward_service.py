"""
Free Offers for Best Members Reward Service — Sree Lakshmi Charitable Trust
Evaluates verified member performance using exactly two metrics:
1. Subscription Amount during active 30-day reward cycle.
2. Self-Service Count during active 30-day reward cycle.

Mandatory Referral Exclusion: Strictly zero referral requirements or metrics.
"""

import logging
from datetime import timedelta
from decimal import Decimal
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from core.models import (
    User,
    MemberVerificationRequest,
    VerificationStatus,
    BestMemberBadgeTier,
    BestMemberOffer,
    MemberRewardCycle,
    MemberSelfServiceEvent,
    MemberOfferRedemption,
    RewardRedemptionStatus,
    RewardAuditLog,
)
from core.serializers import get_user_member

logger = logging.getLogger(__name__)


def is_member_verified(user):
    """
    Check if a member has a verified account.
    Only verified members are eligible for the reward program.
    """
    if not user or not user.is_authenticated:
        return False

    if getattr(user, 'is_verified', False):
        return True

    # Check approved verification request
    if MemberVerificationRequest.objects.filter(
        user=user,
        status=VerificationStatus.APPROVED
    ).exists():
        # Sync user.is_verified flag if not set
        if not user.is_verified:
            user.is_verified = True
            user.save(update_fields=['is_verified'])
        return True

    # Check linked HR Member verification status
    member = get_user_member(user)
    if member and getattr(member, 'is_verified', False):
        return True

    return False


def get_or_create_active_cycle(user):
    """
    Retrieves or establishes the active 30-day reward cycle for the member.
    Handles automatic cycle rollover when 30 days elapse, preserving historical cycles.
    """
    if not is_member_verified(user):
        return None

    today = timezone.localdate()
    member = get_user_member(user)

    active_cycle = MemberRewardCycle.objects.filter(
        user=user,
        is_active=True
    ).order_by('-start_date').first()

    if active_cycle:
        # Check if the cycle has elapsed (30-day period ended)
        if today > active_cycle.end_date:
            with transaction.atomic():
                # Finalize previous cycle
                active_cycle.is_active = False
                active_cycle.is_finalized = True
                active_cycle.finalized_at = timezone.now()
                active_cycle.save(update_fields=['is_active', 'is_finalized', 'finalized_at', 'updated_at'])

                RewardAuditLog.objects.create(
                    user=user,
                    action='CYCLE_ROLLOVER',
                    description=f"Reward cycle #{active_cycle.cycle_number} concluded on {active_cycle.end_date}. Final badge: {active_cycle.earned_badge.name if active_cycle.earned_badge else 'None'}.",
                    metadata={
                        'cycle_id': str(active_cycle.id),
                        'cycle_number': active_cycle.cycle_number,
                        'subscription_amount': str(active_cycle.subscription_amount),
                        'self_service_count': active_cycle.self_service_count,
                        'badge': active_cycle.earned_badge.tier_key if active_cycle.earned_badge else None
                    }
                )

                # Initialize next 30-day cycle
                next_start = today
                next_end = next_start + timedelta(days=30)
                new_cycle = MemberRewardCycle.objects.create(
                    user=user,
                    member=member,
                    cycle_number=active_cycle.cycle_number + 1,
                    start_date=next_start,
                    end_date=next_end,
                    subscription_amount=Decimal('0.00'),
                    self_service_count=0,
                    earned_badge=None,
                    is_active=True,
                    is_finalized=False
                )

                RewardAuditLog.objects.create(
                    user=user,
                    action='CYCLE_STARTED',
                    description=f"New 30-day reward cycle #{new_cycle.cycle_number} started ({next_start} to {next_end}).",
                    metadata={'cycle_id': str(new_cycle.id), 'cycle_number': new_cycle.cycle_number}
                )
                return new_cycle
        return active_cycle

    # No cycle exists yet: create cycle #1
    start_date = today
    end_date = start_date + timedelta(days=30)
    new_cycle = MemberRewardCycle.objects.create(
        user=user,
        member=member,
        cycle_number=1,
        start_date=start_date,
        end_date=end_date,
        subscription_amount=Decimal('0.00'),
        self_service_count=0,
        earned_badge=None,
        is_active=True,
        is_finalized=False
    )
    RewardAuditLog.objects.create(
        user=user,
        action='CYCLE_STARTED',
        description=f"Initial 30-day reward cycle #1 started ({start_date} to {end_date}).",
        metadata={'cycle_id': str(new_cycle.id), 'cycle_number': 1}
    )
    return new_cycle


def calculate_cycle_subscription_amount(user, cycle):
    """
    Derives total qualifying subscription payments made by the member
    during the active cycle date range [cycle.start_date, cycle.end_date].
    Derives exclusively from trusted backend payment records.
    """
    total = Decimal('0.00')
    try:
        from accounts_module.models import DonationPayment, Income

        # 1. Online donation & subscription payments
        online_sum = DonationPayment.objects.filter(
            donor_user=user,
            status__in=['SUCCESS', 'CAPTURED'],
            created_at__date__gte=cycle.start_date,
            created_at__date__lte=cycle.end_date
        ).aggregate(total=Sum('amount'))['total']

        if online_sum:
            total += Decimal(str(online_sum))

        # 2. Offline / receipt recorded income for this user/member
        member = get_user_member(user)
        offline_income_qs = Income.objects.filter(
            date__gte=cycle.start_date,
            date__lte=cycle.end_date,
            online_payment__isnull=True  # avoid double counting
        )

        filters = []
        if member and member.member_id:
            offline_income_qs = offline_income_qs.filter(
                purpose__icontains=member.member_id
            ) | offline_income_qs.filter(
                donor_name__iexact=user.full_name
            )
            offline_sum = offline_income_qs.aggregate(total=Sum('amount'))['total']
            if offline_sum:
                total += Decimal(str(offline_sum))

    except Exception as e:
        logger.error(f"Error calculating subscription amount for user {user.username}: {e}")

    return total


def record_self_service_activity(user, activity_type, reference_id, title=''):
    """
    Records a qualifying self-service activity for a verified member.
    Enforces idempotency to prevent duplicate counts on retries or refreshes.
    Automatically re-evaluates rewards when a new activity is registered.
    """
    if not is_member_verified(user):
        return None

    cycle = get_or_create_active_cycle(user)
    if not cycle:
        return None

    member = get_user_member(user)

    event, created = MemberSelfServiceEvent.objects.get_or_create(
        user=user,
        activity_type=activity_type,
        reference_id=str(reference_id),
        defaults={
            'member': member,
            'cycle': cycle,
            'title': title,
            'created_at': timezone.now()
        }
    )

    if created:
        RewardAuditLog.objects.create(
            user=user,
            action='SELF_SERVICE_RECORDED',
            description=f"Self-service activity '{activity_type}' recorded: {title} (Ref: {reference_id})",
            metadata={
                'event_id': str(event.id),
                'activity_type': activity_type,
                'reference_id': str(reference_id),
                'cycle_id': str(cycle.id)
            }
        )
        evaluate_member_rewards(user)

    return event


def evaluate_member_rewards(user):
    """
    Recalculates badge eligibility and updates active cycle metrics.
    Evaluates qualification against configured BestMemberBadgeTier thresholds.
    """
    if not is_member_verified(user):
        return None

    cycle = get_or_create_active_cycle(user)
    if not cycle:
        return None

    # Calculate trusted metrics
    subscription_total = calculate_cycle_subscription_amount(user, cycle)
    self_service_count = MemberSelfServiceEvent.objects.filter(cycle=cycle).count()

    cycle.subscription_amount = subscription_total
    cycle.self_service_count = self_service_count

    # Find highest qualifying tier
    active_tiers = BestMemberBadgeTier.objects.filter(is_active=True).order_by('-level_order')
    qualifying_tier = None

    for tier in active_tiers:
        if (subscription_total >= tier.min_subscription_amount and
                self_service_count >= tier.min_self_service_count):
            qualifying_tier = tier
            break

    # Update badge if changed
    old_badge = cycle.earned_badge
    if cycle.earned_badge != qualifying_tier:
        cycle.earned_badge = qualifying_tier
        RewardAuditLog.objects.create(
            user=user,
            action='BADGE_AWARDED' if qualifying_tier else 'BADGE_RESET',
            description=(
                f"Badge level updated to {qualifying_tier.name} for {user.username} (Cycle #{cycle.cycle_number})"
                if qualifying_tier else f"No badge tier reached for {user.username}"
            ),
            metadata={
                'old_badge': old_badge.tier_key if old_badge else None,
                'new_badge': qualifying_tier.tier_key if qualifying_tier else None,
                'subscription_amount': str(subscription_total),
                'self_service_count': self_service_count,
                'cycle_id': str(cycle.id)
            }
        )

    cycle.save(update_fields=['subscription_amount', 'self_service_count', 'earned_badge', 'updated_at'])
    return cycle


def get_member_reward_summary(user):
    """
    Generates a full summary of the member's reward status, metrics,
    cycle dates, badge qualification, and available free offers.
    """
    verified = is_member_verified(user)
    tiers = list(BestMemberBadgeTier.objects.filter(is_active=True).order_by('level_order'))
    offers = list(BestMemberOffer.objects.filter(is_active=True).select_related('min_badge_tier').order_by('reward_value'))

    if not verified:
        return {
            'is_verified': False,
            'message': 'Account verification required to unlock Best Member Badges & Free Offers.',
            'current_badge': None,
            'cycle': None,
            'metrics': None,
            'next_tier': None,
            'offers': [
                {
                    'id': str(o.id),
                    'offer_key': o.offer_key,
                    'title': o.title,
                    'reward_value': float(o.reward_value),
                    'cooldown_days': o.cooldown_days,
                    'cooldown_independent': o.cooldown_independent,
                    'min_badge_name': o.min_badge_tier.name if o.min_badge_tier else 'Verified',
                    'status': 'LOCKED',
                    'lock_reason': 'Verification Required',
                    'description': o.description,
                }
                for o in offers
            ],
            'available_tiers': [
                {
                    'tier_key': t.tier_key,
                    'name': t.name,
                    'icon': t.icon,
                    'color': t.color,
                    'min_subscription': float(t.min_subscription_amount),
                    'min_services': t.min_self_service_count,
                }
                for t in tiers
            ]
        }

    cycle = get_or_create_active_cycle(user)
    if cycle:
        evaluate_member_rewards(user)
        # Reload cycle
        cycle.refresh_from_db()

    current_tier = cycle.earned_badge if cycle else None
    current_order = current_tier.level_order if current_tier else 0

    # Determine next tier
    next_tier = None
    for t in tiers:
        if t.level_order > current_order:
            next_tier = t
            break

    # Calculate metrics & progress
    sub_amt = float(cycle.subscription_amount) if cycle else 0.0
    srv_cnt = cycle.self_service_count if cycle else 0

    sub_target = float(next_tier.min_subscription_amount) if next_tier else (float(current_tier.min_subscription_amount) if current_tier else 100.0)
    srv_target = next_tier.min_self_service_count if next_tier else (current_tier.min_self_service_count if current_tier else 2)

    sub_progress = min(100, int((sub_amt / sub_target) * 100)) if sub_target > 0 else 100
    srv_progress = min(100, int((srv_cnt / srv_target) * 100)) if srv_target > 0 else 100

    now = timezone.now()
    offers_data = []

    for offer in offers:
        tier_req_met = True
        if offer.min_badge_tier:
            if not current_tier or current_tier.level_order < offer.min_badge_tier.level_order:
                tier_req_met = False

        status = 'AVAILABLE'
        lock_reason = None
        cooldown_until = None
        days_to_cooldown = 0
        last_redemption = None

        if not tier_req_met:
            status = 'LOCKED'
            lock_reason = f"Requires {offer.min_badge_tier.name} Badge"
        else:
            # Check cooldown / redemption constraints
            if offer.cooldown_independent:
                # E.g. Petrol allowance: 20-day cooldown across ANY cycle
                recent_redemption = MemberOfferRedemption.objects.filter(
                    user=user,
                    offer=offer,
                    status__in=[
                        RewardRedemptionStatus.ACTIVATED,
                        RewardRedemptionStatus.PENDING_FULFILLMENT,
                        RewardRedemptionStatus.FULFILLED
                    ]
                ).order_by('-redeemed_at').first()

                if recent_redemption and recent_redemption.cooldown_until and recent_redemption.cooldown_until > now:
                    status = 'ON_COOLDOWN'
                    cooldown_until = recent_redemption.cooldown_until
                    diff = recent_redemption.cooldown_until - now
                    days_to_cooldown = max(1, diff.days + (1 if diff.seconds > 0 else 0))
                    lock_reason = f"Available in {days_to_cooldown} day{'s' if days_to_cooldown != 1 else ''}"
                    last_redemption = recent_redemption
            else:
                # Monthly cycle based offer: Mobile Recharge, Tour Allowance
                cycle_redemption = MemberOfferRedemption.objects.filter(
                    user=user,
                    offer=offer,
                    cycle=cycle,
                    status__in=[
                        RewardRedemptionStatus.ACTIVATED,
                        RewardRedemptionStatus.PENDING_FULFILLMENT,
                        RewardRedemptionStatus.FULFILLED
                    ]
                ).first()

                if cycle_redemption:
                    status = 'REDEEMED'
                    lock_reason = 'Claimed for this cycle'
                    last_redemption = cycle_redemption
                    cooldown_until = cycle.end_date

        offers_data.append({
            'id': str(offer.id),
            'offer_key': offer.offer_key,
            'title': offer.title,
            'reward_value': float(offer.reward_value),
            'cooldown_days': offer.cooldown_days,
            'cooldown_independent': offer.cooldown_independent,
            'min_badge_name': offer.min_badge_tier.name if offer.min_badge_tier else 'Verified',
            'status': status,
            'lock_reason': lock_reason,
            'cooldown_until': cooldown_until.isoformat() if hasattr(cooldown_until, 'isoformat') else str(cooldown_until) if cooldown_until else None,
            'days_to_cooldown': days_to_cooldown,
            'description': offer.description,
            'last_redemption_id': str(last_redemption.id) if last_redemption else None
        })

    today = timezone.localdate()
    days_left_in_cycle = max(0, (cycle.end_date - today).days) if cycle else 30

    return {
        'is_verified': True,
        'current_badge': {
            'id': str(current_tier.id) if current_tier else None,
            'tier_key': current_tier.tier_key if current_tier else 'NONE',
            'name': current_tier.name if current_tier else 'Member (Unranked)',
            'icon': current_tier.icon if current_tier else '⭐',
            'color': current_tier.color if current_tier else '#64748B',
            'level_order': current_tier.level_order if current_tier else 0,
            'description': current_tier.description if current_tier else 'Participate to earn badges.'
        },
        'next_tier': {
            'tier_key': next_tier.tier_key if next_tier else None,
            'name': next_tier.name if next_tier else 'Max Tier Reached',
            'icon': next_tier.icon if next_tier else '👑',
            'color': next_tier.color if next_tier else '#6366F1',
            'min_subscription': float(next_tier.min_subscription_amount) if next_tier else 0.0,
            'min_services': next_tier.min_self_service_count if next_tier else 0,
            'needed_subscription': max(0.0, float(next_tier.min_subscription_amount) - sub_amt) if next_tier else 0.0,
            'needed_services': max(0, next_tier.min_self_service_count - srv_cnt) if next_tier else 0,
        } if next_tier else None,
        'cycle': {
            'id': str(cycle.id) if cycle else None,
            'cycle_number': cycle.cycle_number if cycle else 1,
            'start_date': cycle.start_date.isoformat() if cycle else today.isoformat(),
            'end_date': cycle.end_date.isoformat() if cycle else (today + timedelta(days=30)).isoformat(),
            'days_remaining': days_left_in_cycle,
        },
        'metrics': {
            'subscription_amount': sub_amt,
            'subscription_target': sub_target,
            'subscription_progress': sub_progress,
            'self_service_count': srv_cnt,
            'self_service_target': srv_target,
            'self_service_progress': srv_progress,
        },
        'offers': offers_data,
        'available_tiers': [
            {
                'tier_key': t.tier_key,
                'name': t.name,
                'icon': t.icon,
                'color': t.color,
                'min_subscription': float(t.min_subscription_amount),
                'min_services': t.min_self_service_count,
            }
            for t in tiers
        ]
    }


def redeem_member_offer(user, offer_id, notes=''):
    """
    Executes reward redemption for a verified member with immediate revalidation:
    1. Revalidates account verification.
    2. Revalidates badge qualification.
    3. Revalidates offer cooldown constraints.
    4. Creates immutable redemption and audit records.
    """
    if not is_member_verified(user):
        raise ValueError("Only verified members can redeem reward offers.")

    cycle = get_or_create_active_cycle(user)
    if not cycle:
        raise ValueError("No active reward cycle found.")

    # Re-evaluate latest metrics
    evaluate_member_rewards(user)
    cycle.refresh_from_db()

    try:
        offer = BestMemberOffer.objects.select_related('min_badge_tier').get(id=offer_id, is_active=True)
    except BestMemberOffer.DoesNotExist:
        raise ValueError("Reward offer not found or inactive.")

    # Validate badge requirement
    current_tier = cycle.earned_badge
    if offer.min_badge_tier:
        if not current_tier or current_tier.level_order < offer.min_badge_tier.level_order:
            raise ValueError(f"This offer requires the {offer.min_badge_tier.name} badge.")

    now = timezone.now()

    # Enforce cooldown constraints
    if offer.cooldown_independent:
        # Check independent cooldown (Petrol: 20-day period)
        latest_redemption = MemberOfferRedemption.objects.filter(
            user=user,
            offer=offer,
            status__in=[
                RewardRedemptionStatus.ACTIVATED,
                RewardRedemptionStatus.PENDING_FULFILLMENT,
                RewardRedemptionStatus.FULFILLED
            ]
        ).order_by('-redeemed_at').first()

        if latest_redemption and latest_redemption.cooldown_until and latest_redemption.cooldown_until > now:
            diff = latest_redemption.cooldown_until - now
            days_left = max(1, diff.days + (1 if diff.seconds > 0 else 0))
            raise ValueError(f"Offer is on cooldown. Next available in {days_left} day{'s' if days_left != 1 else ''} ({latest_redemption.cooldown_until.strftime('%d %b %Y')}).")
    else:
        # Check cycle redemption (Mobile Recharge, Tour: once per monthly cycle)
        cycle_redemption = MemberOfferRedemption.objects.filter(
            user=user,
            offer=offer,
            cycle=cycle,
            status__in=[
                RewardRedemptionStatus.ACTIVATED,
                RewardRedemptionStatus.PENDING_FULFILLMENT,
                RewardRedemptionStatus.FULFILLED
            ]
        ).first()

        if cycle_redemption:
            raise ValueError("This offer has already been claimed for the current 30-day reward cycle.")

    # Create redemption safely
    with transaction.atomic():
        cooldown_until = now + timedelta(days=offer.cooldown_days)
        member = get_user_member(user)

        redemption = MemberOfferRedemption.objects.create(
            user=user,
            member=member,
            offer=offer,
            cycle=cycle,
            reward_value=offer.reward_value,
            status=RewardRedemptionStatus.PENDING_FULFILLMENT,
            cooldown_until=cooldown_until,
            redeemed_at=now,
            notes=notes
        )

        RewardAuditLog.objects.create(
            user=user,
            action='OFFER_REDEEMED',
            description=f"Member claimed {offer.title} (₹{offer.reward_value}). Cooldown set until {cooldown_until.strftime('%Y-%m-%d %H:%M')}.",
            metadata={
                'redemption_id': str(redemption.id),
                'offer_id': str(offer.id),
                'offer_key': offer.offer_key,
                'reward_value': str(offer.reward_value),
                'cooldown_days': offer.cooldown_days,
                'cooldown_until': cooldown_until.isoformat(),
                'cycle_id': str(cycle.id)
            }
        )

    return redemption

