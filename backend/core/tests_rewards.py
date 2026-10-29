"""
Unit and Integration Tests for Free Offers for Best Members Reward System
Sree Lakshmi Charitable Trust
"""

from decimal import Decimal
from datetime import timedelta
from django.test import TestCase
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
from core.reward_service import (
    is_member_verified,
    get_or_create_active_cycle,
    record_self_service_activity,
    evaluate_member_rewards,
    get_member_reward_summary,
    redeem_member_offer,
)
from accounts_module.models import DonationPayment


class BestMemberRewardSystemTests(TestCase):
    def setUp(self):
        # 1. Create Bronze, Silver, Gold, Yellow, Platinum badge tiers
        self.tier_bronze = BestMemberBadgeTier.objects.create(
            tier_key='BRONZE',
            name='Bronze',
            icon='🥉',
            color='#CD7F32',
            min_subscription_amount=Decimal('100.00'),
            min_self_service_count=2,
            level_order=1
        )
        self.tier_silver = BestMemberBadgeTier.objects.create(
            tier_key='SILVER',
            name='Silver',
            icon='🥈',
            color='#94A3B8',
            min_subscription_amount=Decimal('300.00'),
            min_self_service_count=4,
            level_order=2
        )
        self.tier_gold = BestMemberBadgeTier.objects.create(
            tier_key='GOLD',
            name='Gold',
            icon='🥇',
            color='#F59E0B',
            min_subscription_amount=Decimal('500.00'),
            min_self_service_count=6,
            level_order=3
        )
        self.tier_yellow = BestMemberBadgeTier.objects.create(
            tier_key='YELLOW',
            name='Yellow Badge',
            icon='🟡',
            color='#EAB308',
            min_subscription_amount=Decimal('1000.00'),
            min_self_service_count=8,
            level_order=4
        )
        self.tier_platinum = BestMemberBadgeTier.objects.create(
            tier_key='PLATINUM',
            name='Platinum',
            icon='💎',
            color='#6366F1',
            min_subscription_amount=Decimal('2000.00'),
            min_self_service_count=10,
            level_order=5
        )

        # 2. Create the 3 Offers
        # Offer A: Petrol Allowance (₹100, 20-day cooldown independent of monthly cycle)
        self.offer_petrol = BestMemberOffer.objects.create(
            offer_key='PETROL',
            title='Petrol Allowance',
            reward_value=Decimal('100.00'),
            cooldown_days=20,
            cooldown_independent=True,
            min_badge_tier=self.tier_bronze,
            description='₹100 fuel allowance'
        )
        # Offer B: Mobile Recharge (₹399, 30-day cycle)
        self.offer_recharge = BestMemberOffer.objects.create(
            offer_key='RECHARGE',
            title='Mobile Recharge',
            reward_value=Decimal('399.00'),
            cooldown_days=30,
            cooldown_independent=False,
            min_badge_tier=self.tier_silver,
            description='₹399 mobile recharge voucher'
        )
        # Offer C: Tour Allowance (₹3,000, 30-day cycle)
        self.offer_tour = BestMemberOffer.objects.create(
            offer_key='TOUR',
            title='Tour Allowance',
            reward_value=Decimal('3000.00'),
            cooldown_days=30,
            cooldown_independent=False,
            min_badge_tier=self.tier_gold,
            description='₹3,000 tour allowance contribution'
        )

        # 3. Create unverified user
        self.unverified_user = User.objects.create_user(
            username='unverified_user',
            email='unverified@test.com',
            full_name='Unverified User',
            role='MEMBER',
            is_verified=False
        )

        # 4. Create verified user
        self.verified_user = User.objects.create_user(
            username='verified_user',
            email='verified@test.com',
            full_name='Verified User',
            role='MEMBER',
            is_verified=True
        )

    def test_unverified_member_ineligibility(self):
        """Unverified members must not earn badges or activate offers."""
        self.assertFalse(is_member_verified(self.unverified_user))
        cycle = get_or_create_active_cycle(self.unverified_user)
        self.assertIsNone(cycle)

        summary = get_member_reward_summary(self.unverified_user)
        self.assertFalse(summary['is_verified'])
        self.assertIsNone(summary['current_badge'])
        for offer in summary['offers']:
            self.assertEqual(offer['status'], 'LOCKED')
            self.assertEqual(offer['lock_reason'], 'Verification Required')

        # Attempt to redeem must fail
        with self.assertRaises(ValueError) as ctx:
            redeem_member_offer(self.unverified_user, self.offer_petrol.id)
        self.assertIn("verified", str(ctx.exception).lower())

    def test_verified_member_cycle_initialization(self):
        """Verified member automatically gets a 30-day reward cycle."""
        self.assertTrue(is_member_verified(self.verified_user))
        cycle = get_or_create_active_cycle(self.verified_user)
        self.assertIsNotNone(cycle)
        self.assertTrue(cycle.is_active)
        self.assertEqual(cycle.cycle_number, 1)
        self.assertEqual(cycle.end_date - cycle.start_date, timedelta(days=30))

    def test_qualification_by_subscription_and_self_service(self):
        """
        Badge qualification requires BOTH:
        1. Subscription Amount
        2. Self-Service Count
        (Referrals are strictly excluded!)
        """
        cycle = get_or_create_active_cycle(self.verified_user)

        # Record 1 payment of ₹150 (meets Bronze subscription ₹100, but 0 services)
        DonationPayment.objects.create(
            donor_user=self.verified_user,
            donor_name='Verified User',
            amount=Decimal('150.00'),
            status='SUCCESS',
            created_at=timezone.now()
        )
        evaluate_member_rewards(self.verified_user)
        cycle.refresh_from_db()
        # Since self-service count is 0 (< 2 for Bronze), no badge should be awarded
        self.assertIsNone(cycle.earned_badge)

        # Record 1st self-service activity
        record_self_service_activity(self.verified_user, 'PROBLEM_REPORT', 'issue-101', 'Street Light broken')
        cycle.refresh_from_db()
        self.assertIsNone(cycle.earned_badge)  # still 1 < 2

        # Record 2nd self-service activity
        record_self_service_activity(self.verified_user, 'POLL_VOTE', 'poll-202', 'Voted on annual meet')
        cycle.refresh_from_db()
        # Now subscription=150 (>=100) and self-service=2 (>=2) => BRONZE awarded!
        self.assertIsNotNone(cycle.earned_badge)
        self.assertEqual(cycle.earned_badge.tier_key, 'BRONZE')

    def test_idempotent_self_service_duplicate_prevention(self):
        """Zero duplicate counting on retries, repeated requests, or page refreshes."""
        cycle = get_or_create_active_cycle(self.verified_user)

        # Record same activity 3 times
        record_self_service_activity(self.verified_user, 'POLL_VOTE', 'poll-999', 'Poll vote')
        record_self_service_activity(self.verified_user, 'POLL_VOTE', 'poll-999', 'Poll vote')
        record_self_service_activity(self.verified_user, 'POLL_VOTE', 'poll-999', 'Poll vote')

        event_count = MemberSelfServiceEvent.objects.filter(
            user=self.verified_user,
            activity_type='POLL_VOTE',
            reference_id='poll-999'
        ).count()
        self.assertEqual(event_count, 1)

    def test_offer_availability_and_redemption(self):
        """Bronze member qualifies for Petrol ₹100, but Mobile Recharge ₹399 remains locked until Silver."""
        cycle = get_or_create_active_cycle(self.verified_user)
        DonationPayment.objects.create(
            donor_user=self.verified_user,
            donor_name='Verified User',
            amount=Decimal('150.00'),
            status='SUCCESS'
        )
        record_self_service_activity(self.verified_user, 'PROBLEM_REPORT', 'prob-1', 'Road issue')
        record_self_service_activity(self.verified_user, 'POLL_VOTE', 'poll-1', 'Vote issue')
        evaluate_member_rewards(self.verified_user)

        summary = get_member_reward_summary(self.verified_user)
        self.assertEqual(summary['current_badge']['tier_key'], 'BRONZE')

        petrol_offer = next(o for o in summary['offers'] if o['offer_key'] == 'PETROL')
        recharge_offer = next(o for o in summary['offers'] if o['offer_key'] == 'RECHARGE')

        self.assertEqual(petrol_offer['status'], 'AVAILABLE')
        self.assertEqual(recharge_offer['status'], 'LOCKED')
        self.assertIn("Silver", recharge_offer['lock_reason'])

        # Redeem Petrol Allowance
        redemption = redeem_member_offer(self.verified_user, self.offer_petrol.id, notes="Nearby BPCL pump")
        self.assertEqual(redemption.status, RewardRedemptionStatus.PENDING_FULFILLMENT)
        self.assertEqual(redemption.reward_value, Decimal('100.00'))

    def test_independent_20_day_cooldown_for_petrol(self):
        """Petrol allowance enforces a 20-day cooldown independently of 30-day monthly cycles."""
        cycle = get_or_create_active_cycle(self.verified_user)
        DonationPayment.objects.create(
            donor_user=self.verified_user,
            donor_name='Verified User',
            amount=Decimal('150.00'),
            status='SUCCESS'
        )
        record_self_service_activity(self.verified_user, 'PROBLEM_REPORT', 'prob-1', 'Road issue')
        record_self_service_activity(self.verified_user, 'POLL_VOTE', 'poll-1', 'Vote issue')
        evaluate_member_rewards(self.verified_user)

        # Redeem Petrol
        redeem_member_offer(self.verified_user, self.offer_petrol.id)

        # Immediate second redemption attempt must fail due to 20-day cooldown
        with self.assertRaises(ValueError) as ctx:
            redeem_member_offer(self.verified_user, self.offer_petrol.id)
        self.assertIn("cooldown", str(ctx.exception).lower())

        # Check summary reflects cooldown
        summary = get_member_reward_summary(self.verified_user)
        petrol_offer = next(o for o in summary['offers'] if o['offer_key'] == 'PETROL')
        self.assertEqual(petrol_offer['status'], 'ON_COOLDOWN')
        self.assertGreaterEqual(petrol_offer['days_to_cooldown'], 19)

    def test_cycle_rollover_preserves_historical_records(self):
        """When 30 days elapse, old cycle is finalized and a new cycle begins; history is never deleted."""
        cycle1 = get_or_create_active_cycle(self.verified_user)
        # Fast forward cycle1 end_date into the past
        past_date = timezone.localdate() - timedelta(days=5)
        cycle1.start_date = past_date - timedelta(days=30)
        cycle1.end_date = past_date
        cycle1.subscription_amount = Decimal('100.00')
        cycle1.self_service_count = 2
        cycle1.earned_badge = self.tier_bronze
        cycle1.save()

        # Calling get_or_create_active_cycle triggers rollover
        cycle2 = get_or_create_active_cycle(self.verified_user)
        self.assertEqual(cycle2.cycle_number, 2)
        self.assertTrue(cycle2.is_active)
        self.assertEqual(cycle2.subscription_amount, Decimal('0.00'))
        self.assertEqual(cycle2.self_service_count, 0)

        # Verify cycle 1 was preserved as finalized
        cycle1.refresh_from_db()
        self.assertFalse(cycle1.is_active)
        self.assertTrue(cycle1.is_finalized)
        self.assertEqual(cycle1.earned_badge, self.tier_bronze)

        # Total cycles for member is 2
        self.assertEqual(MemberRewardCycle.objects.filter(user=self.verified_user).count(), 2)

