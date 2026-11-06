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
        """One-time referral code slt-{digits} and referral bonus crediting."""
        import re
        # Member 1 creates account
        m1 = Member.objects.create(
            full_name='Swapna Member',
            phone='9946535824',
            created_by=self.staff_user
        )
        self.assertTrue(m1.referral_code.startswith('slt-'))
        self.assertRegex(m1.referral_code, r'^slt-\d+$')

        # Member 2 signs up with Member 1's referral code
        m2 = Member.objects.create(
            full_name='Friend Member',
            phone='9946535899',
            monthly_fee=Decimal('100.00'),
            referred_by=m1,
            created_by=self.staff_user
        )

        # Check that referring member's account or staff got credited
        account = StaffBonusAccount.objects.get(staff=self.staff_user)
        self.assertGreaterEqual(account.membership_bonus_balance, Decimal('30.00'))

    def test_one_time_referral_code_lifecycle(self):
        """One-time code is consumed and immediately refreshed with a new code."""
        swapna_user = User.objects.create_user(
            username='swapna_test',
            email='swapna@test.com',
            phone='9846012345',
            full_name='Swapna T',
            role=Role.MEMBER,
            password='password123'
        )
        swapna_member = Member.objects.create(
            full_name='Swapna T',
            phone='9846012345',
            created_by=swapna_user
        )
        first_code = swapna_member.referral_code
        self.assertTrue(first_code.startswith('slt-'))

        # Simulate a new member registering with swapna's referral code
        from hr_module.models import MemberReferralCode
        ref_record = MemberReferralCode.objects.get(code=first_code)
        self.assertFalse(ref_record.is_used)

        # New member signs up
        new_member = Member.objects.create(
            full_name='Rahul New',
            phone='9846099999',
            monthly_fee=Decimal('100.00'),
            referred_by=swapna_member
        )

        # Mark code consumed
        ref_record.is_used = True
        ref_record.used_by = new_member
        ref_record.save()

        # Swapna generates a new one-time code
        new_code = swapna_member.generate_one_time_referral_code()
        self.assertNotEqual(first_code, new_code)
        self.assertTrue(new_code.startswith('slt-'))

        # Swapna's bonus account gets the ₹30 membership bonus for registration + ₹30 referral bonus
        swapna_acc = StaffBonusAccount.objects.get(staff=swapna_user)
        self.assertEqual(swapna_acc.membership_bonus_balance, Decimal('60.00'))
        self.assertEqual(swapna_acc.transactions.filter(direction='CREDIT').count(), 2)

    def test_donation_deletion_reverses_bonus(self):
        """Deleting a donation automatically removes bonus and updates account balance."""
        income = Income.objects.create(
            donor_name='Swapna Donor',
            source='Direct Donation',
            amount=Decimal('1350.00'), # 10% = 135
            payment_method='CASH',
            account_type='CASH',
            cash_account=self.cash_account,
            created_by=self.staff_user
        )
        account = StaffBonusAccount.objects.get(staff=self.staff_user)
        self.assertEqual(account.donation_bonus_balance, Decimal('135.00'))

        # Delete the income (as happened with Swapna's donation)
        income.delete()

        account.refresh_from_db()
        self.assertEqual(account.donation_bonus_balance, Decimal('0.00'))
        self.assertEqual(account.total_bonus_balance, 0.00)
        self.assertEqual(StaffBonusTransaction.objects.filter(bonus_account=account).count(), 0)

    def test_sync_staff_bonus_account_cleans_orphans(self):
        """sync_staff_bonus_account purges orphan transactions and recalculates balances."""
        account = StaffBonusAccount.objects.get_or_create(staff=self.staff_user)[0]
        # Create an orphan transaction referencing a non-existent income
        StaffBonusTransaction.objects.create(
            bonus_account=account,
            bonus_type=StaffBonusTransaction.BonusType.DONATION_BONUS,
            direction=StaffBonusTransaction.TxnDirection.CREDIT,
            amount=Decimal('135.00'),
            income_id='NON_EXISTENT_RCP_123',
            description='Orphan transaction'
        )
        account.donation_bonus_balance = Decimal('135.00')
        account.save()

        from hr_module.bonus_service import sync_staff_bonus_account
        sync_staff_bonus_account(self.staff_user)

        account.refresh_from_db()
        self.assertEqual(account.donation_bonus_balance, Decimal('0.00'))
        self.assertEqual(StaffBonusTransaction.objects.filter(bonus_account=account).count(), 0)

    def test_staff_referral_code_parity_between_serializer_and_dashboard(self):
        """Staff referral code is strictly numeric (slt-{digits}) and 100% identical across mobile & web."""
        import re
        from core.serializers import get_user_referral_code, UserSerializer
        from hr_module.views import StaffBonusAllView
        from rest_framework.test import APIRequestFactory, force_authenticate

        # Staff user referral code from canonical function
        code1 = get_user_referral_code(self.staff_user)
        self.assertRegex(code1, r'^slt-\d+$')

        # Code from UserSerializer (used by mobile app profile)
        code2 = UserSerializer(self.staff_user).data['referral_code']
        self.assertEqual(code1, code2)

        # Code from StaffBonusAllView (used by web dashboard table)
        hr_user = User.objects.create_user(
            username='hr_admin_test',
            email='hr@test.com',
            full_name='HR Admin',
            role=Role.HR,
            password='password123'
        )
        factory = APIRequestFactory()
        request = factory.get('/api/hr/staff-bonus/all/')
        force_authenticate(request, user=hr_user)

        response = StaffBonusAllView.as_view()(request)
        self.assertEqual(response.status_code, 200)
        staff_row = next((s for s in response.data if s['staff_uid'] == self.staff_user.staff_uid), None)
        self.assertIsNotNone(staff_row)
        self.assertEqual(staff_row['referral_code'], code1)
        self.assertRegex(staff_row['referral_code'], r'^slt-\d+$')

        # Test Signup with this staff referral code
        from core.views import MemberSignupView
        req_signup = factory.post('/api/core/auth/signup/', {
            'username': 'mem_staff_ref',
            'phone': '9876543210',
            'email': 'newmem@test.com',
            'password': 'password123',
            'full_name': 'New Referred Member',
            'referral_code': code1
        }, format='json')
        res_signup = MemberSignupView.as_view()(req_signup)
        self.assertEqual(res_signup.status_code, 201)
        new_u = User.objects.get(username='9876543210')
        new_m = Member.objects.get(created_by=new_u)
        self.assertIsNotNone(new_m.referred_by)
        self.assertEqual(new_m.referred_by.created_by, self.staff_user)
        bonus_acc = StaffBonusAccount.objects.get(staff=self.staff_user)
        self.assertGreaterEqual(bonus_acc.membership_bonus_balance, Decimal('30.00'))

