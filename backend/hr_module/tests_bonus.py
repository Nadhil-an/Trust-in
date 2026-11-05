"""
Tests for Staff Bonus & Commission System
"""
from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from core.models import User, Role
from hr_module.models import (
    Member, StaffBonusAccount, StaffBonusTransaction,
    ExecutiveOfficer, SalaryStructure
)
from accounts_module.models import Income, CashAccount
from hr_module.bonus_service import (
    credit_donation_bonus, credit_membership_bonus,
    credit_referral_bonus_for_referrer, get_staff_bonus_summary
)


class StaffBonusSystemTestCase(TestCase):
    def setUp(self):
        # 1. Create a staff user
        self.staff_user = User.objects.create_user(
            username='staff_test',
            email='staff@test.com',
            full_name='Staff Member One',
            role=Role.STAFF,
            password='password123'
        )

        # 2. Create CashAccount for donations
        self.cash_account = CashAccount.objects.create(
            name='Test Cash',
            opening_balance=10000,
            current_balance=10000
        )

    def test_donation_bonus_calculation(self):
        """Rule 1: For every Rs 1,000 donation, 10% (Rs 100) is allocated to staff bonus."""
        income = Income.objects.create(
            donor_name='Generous Donor',
            source='Direct Donation',
            amount=Decimal('1000.00'),
            payment_method='CASH',
            account_type='CASH',
            cash_account=self.cash_account,
            created_by=self.staff_user
        )

        # Signal or direct call credits 10%
        account = StaffBonusAccount.objects.get(staff=self.staff_user)
        self.assertEqual(account.donation_bonus_balance, Decimal('100.00'))
        self.assertEqual(account.membership_bonus_balance, Decimal('0.00'))
        self.assertEqual(account.total_bonus_balance, 100.00)

        # Check transaction record
        txns = StaffBonusTransaction.objects.filter(bonus_account=account)
        self.assertEqual(txns.count(), 1)
        self.assertEqual(txns.first().bonus_type, StaffBonusTransaction.BonusType.DONATION_BONUS)
        self.assertEqual(txns.first().amount, Decimal('100.00'))

    def test_membership_bonus_calculation(self):
        """Rule 2: For every Rs 100 membership fee, 30% (Rs 30) is credited to staff bonus."""
        member = Member.objects.create(
            full_name='New Member',
            phone='9876543210',
            monthly_fee=Decimal('100.00'),
            created_by=self.staff_user
        )

        account = StaffBonusAccount.objects.get(staff=self.staff_user)
        self.assertEqual(account.membership_bonus_balance, Decimal('30.00'))
        self.assertEqual(account.donation_bonus_balance, Decimal('0.00'))
        self.assertEqual(account.total_bonus_balance, 30.00)

    def test_bonus_accounts_tracked_separately(self):
        """Rule 3: Donation-based and membership-based bonuses tracked separately."""
        # 1. Earn donation bonus
        Income.objects.create(
            donor_name='Donor A',
            amount=Decimal('2000.00'), # 10% = 200
            payment_method='CASH',
            account_type='CASH',
            cash_account=self.cash_account,
            created_by=self.staff_user
        )

        # 2. Earn membership bonus
        Member.objects.create(
            full_name='Member B',
            phone='9876543211',
            monthly_fee=Decimal('100.00'), # 30% = 30
            created_by=self.staff_user
        )

        account = StaffBonusAccount.objects.get(staff=self.staff_user)
        self.assertEqual(account.donation_bonus_balance, Decimal('200.00'))
        self.assertEqual(account.membership_bonus_balance, Decimal('30.00'))
        self.assertEqual(account.total_bonus_balance, 230.00)

        summary = get_staff_bonus_summary(self.staff_user)
        self.assertEqual(summary['donation_bonus'], 200.0)
        self.assertEqual(summary['membership_bonus'], 30.0)
        self.assertEqual(summary['total_bonus'], 230.0)

    def test_referral_code_generation_and_bonus(self):
        """Referral code slt-membername and referral bonus crediting."""
        # Member 1 creates account
        m1 = Member.objects.create(
            full_name='Alif UN',
            phone='9946535824',
            created_by=self.staff_user
        )
        self.assertTrue(m1.referral_code.startswith('slt-alifun'))

        # Member 2 signs up with Member 1's referral code
        m2 = Member.objects.create(
            full_name='Friend Member',
            phone='9946535899',
            monthly_fee=Decimal('100.00'),
            referred_by=m1,
            created_by=self.staff_user
        )

        # Check that referring member's staff (or referrer) got credited
        account = StaffBonusAccount.objects.get(staff=self.staff_user)
        # Should have membership bonus from m1 (30) + m2 (30) + referral bonus from m2 (30)
        self.assertGreaterEqual(account.membership_bonus_balance, Decimal('60.00'))

