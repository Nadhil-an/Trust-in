"""
Unit Tests — Form submission & database persistence
Covers: Auth, Members (HR), Assessment Requests (Manager), Accounts Income, Cashier

Run:   python manage.py test tests.test_form_submissions
"""
from decimal import Decimal
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status

from core.models import User
from hr_module.models import Member
from manager_module.models import AssessmentRequest
from accounts_module.models import Income


# ── Helpers ────────────────────────────────────────────────────────────────

def create_user(username, role, password='testpass123'):
    return User.objects.create_user(
        username=username,
        password=password,
        full_name=f'Test {username.title()}',
        role=role,
        email=f'{username}@test.com',
    )


class AuthenticatedTestCase(TestCase):
    """Base class that creates a client + authenticated user."""

    def setUp(self):
        self.client   = APIClient()
        self.admin    = create_user('admin_test',     'ADMIN')
        self.hr       = create_user('hr_test',        'HR')           # HR module access
        self.manager  = create_user('manager_test',   'MANAGER')      # Assessment requests
        self.accountant = create_user('acct_test',    'ACCOUNTANT')   # Income entries
        self.cashier  = create_user('cashier_test',   'CASHIER')

    def auth_as(self, user):
        """Force-authenticate the test client as `user`."""
        self.client.force_authenticate(user=user)


# ══════════════════════════════════════════════════════════════════════════════
# 1 ── Login Form
# ══════════════════════════════════════════════════════════════════════════════

class LoginFormTest(AuthenticatedTestCase):

    def test_login_success_returns_200_and_tokens(self):
        """Valid credentials → 200 with access + refresh tokens in JSON."""
        # Create user using create_user to ensure the password is properly hashed
        user = create_user('login_test_user', 'MANAGER', password='testpass123')
        res = self.client.post('/api/auth/login/', {
            'username': 'login_test_user',
            'password': 'testpass123',
        }, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertIn('access',  res.data)
        self.assertIn('refresh', res.data)
        self.assertIn('user',    res.data)

    def test_login_wrong_password_returns_401(self):
        res = self.client.post('/api/auth/login/', {
            'username': 'staff_test',
            'password': 'wrongpassword',
        }, format='json')
        self.assertEqual(res.status_code, 401)

    def test_login_nonexistent_user_returns_401(self):
        res = self.client.post('/api/auth/login/', {
            'username': 'nobody',
            'password': 'testpass123',
        }, format='json')
        self.assertEqual(res.status_code, 401)

    def test_login_missing_fields_returns_400(self):
        res = self.client.post('/api/auth/login/', {}, format='json')
        self.assertEqual(res.status_code, 400)


# ══════════════════════════════════════════════════════════════════════════════
# 2 ── Member Registration Form (HR Module)
# ══════════════════════════════════════════════════════════════════════════════

class MemberFormTest(AuthenticatedTestCase):

    VALID_PAYLOAD = {
        'full_name':      'Priya Nair',
        'phone':          '9876543210',
        'address':        '12 Gandhi Nagar, Thrissur',
        'gender':         'FEMALE',
        'date_of_birth':  '1990-05-15',
        'occupation':     'Teacher',
        'ward':           '5',
    }

    def test_create_member_succeeds_and_saves_to_db(self):
        """HR user can create a new member; record is persisted."""
        self.auth_as(self.hr)
        res = self.client.post('/api/hr/members/', self.VALID_PAYLOAD, format='json')
        self.assertIn(res.status_code, [200, 201], msg=f"Unexpected: {res.data}")
        # Verify it is actually in the database
        self.assertTrue(Member.objects.filter(full_name='Priya Nair').exists())

    def test_create_member_auto_assigns_member_id(self):
        """A unique member_id should be auto-generated."""
        self.auth_as(self.hr)
        res = self.client.post('/api/hr/members/', self.VALID_PAYLOAD, format='json')
        self.assertIn(res.status_code, [200, 201])
        member = Member.objects.filter(full_name='Priya Nair').first()
        self.assertIsNotNone(member)
        self.assertTrue(member.member_id.startswith('MEM-'), f"Got: {member.member_id}")

    def test_create_member_requires_authentication(self):
        """Unauthenticated request should be rejected."""
        res = self.client.post('/api/hr/members/', self.VALID_PAYLOAD, format='json')
        self.assertIn(res.status_code, [401, 403])

    def test_create_member_missing_required_fields(self):
        """Missing full_name should return 400."""
        self.auth_as(self.hr)
        payload = {k: v for k, v in self.VALID_PAYLOAD.items() if k != 'full_name'}
        res = self.client.post('/api/hr/members/', payload, format='json')
        self.assertEqual(res.status_code, 400)

    def test_member_list_is_paginated(self):
        """GET /api/hr/members/ returns results list."""
        self.auth_as(self.hr)
        res = self.client.get('/api/hr/members/')
        self.assertEqual(res.status_code, 200)
        self.assertIn('results', res.data)


# ══════════════════════════════════════════════════════════════════════════════
# 3 ── Assessment Request Form (Manager Module)
# ══════════════════════════════════════════════════════════════════════════════

class AssessmentRequestFormTest(AuthenticatedTestCase):

    VALID_PAYLOAD = {
        'request_type':    'Beneficiary Assessment',
        'category':        'MEDICAL',
        'priority':        'NORMAL',
        'purpose':         'Medical treatment for accident victim',
        'description':     'The beneficiary was injured in a road accident and requires surgery.',
        'amount_requested': '15000.00',
        'beneficiary_name': 'Rajan K',
        'beneficiary_contact': '8765432109',
    }

    def test_create_request_succeeds_and_saves_to_db(self):
        """Manager can submit an assessment request; record persisted."""
        self.auth_as(self.manager)
        res = self.client.post('/api/manager/requests/', self.VALID_PAYLOAD, format='json')
        self.assertIn(res.status_code, [200, 201], msg=f"Unexpected: {res.data}")
        self.assertTrue(AssessmentRequest.objects.filter(beneficiary_name='Rajan K').exists())

    def test_create_request_auto_generates_request_number(self):
        """request_number should be auto-assigned (MR-YYYY-NNNNN)."""
        self.auth_as(self.manager)
        res = self.client.post('/api/manager/requests/', self.VALID_PAYLOAD, format='json')
        self.assertIn(res.status_code, [200, 201])
        req = AssessmentRequest.objects.filter(beneficiary_name='Rajan K').first()
        self.assertIsNotNone(req)
        self.assertRegex(req.request_number, r'^MR-\d{4}-\d{5}$')

    def test_create_request_requires_authentication(self):
        res = self.client.post('/api/manager/requests/', self.VALID_PAYLOAD, format='json')
        self.assertIn(res.status_code, [401, 403])

    def test_create_request_missing_amount_returns_400(self):
        """amount_requested is required."""
        self.auth_as(self.manager)
        payload = {k: v for k, v in self.VALID_PAYLOAD.items() if k != 'amount_requested'}
        res = self.client.post('/api/manager/requests/', payload, format='json')
        self.assertEqual(res.status_code, 400)

    def test_fao_can_list_requests(self):
        """Manager/Admin should be able to see the request list."""
        self.auth_as(self.manager)
        res = self.client.get('/api/manager/requests/')
        self.assertEqual(res.status_code, 200)

    def test_request_default_status_is_draft_or_submitted(self):
        """New request should start in DRAFT or SUBMITTED status."""
        self.auth_as(self.manager)
        res = self.client.post('/api/manager/requests/', self.VALID_PAYLOAD, format='json')
        self.assertIn(res.status_code, [200, 201])
        req = AssessmentRequest.objects.filter(beneficiary_name='Rajan K').first()
        self.assertIn(req.status, ['DRAFT', 'SUBMITTED'])


# ══════════════════════════════════════════════════════════════════════════════
# 4 ── Income / Donation Form (Accounts Module)
# ══════════════════════════════════════════════════════════════════════════════

class IncomeFormTest(AuthenticatedTestCase):

    VALID_PAYLOAD = {
        'description':     'Annual membership donation',
        'amount':          '500.00',
        'source':          'DONATION',          # Required: DONATION | GRANT | SPONSORSHIP
        'payment_method':  'CASH',              # Required: CASH | CHEQUE | NEFT
        'donor_name':      'Test Donor',
        'purpose':         'General Fund',
        'account_type':    'CASH',
    }

    def test_create_income_entry_saves_to_db(self):
        """Accountant can create a donation/income entry."""
        self.auth_as(self.accountant)
        res = self.client.post('/api/accounts/income/', self.VALID_PAYLOAD, format='json')
        self.assertIn(res.status_code, [200, 201], msg=f"Unexpected: {res.data}")
        self.assertTrue(Income.objects.filter(donor_name='Test Donor').exists())

    def test_create_income_missing_amount_returns_400(self):
        self.auth_as(self.accountant)
        payload = {k: v for k, v in self.VALID_PAYLOAD.items() if k != 'amount'}
        res = self.client.post('/api/accounts/income/', payload, format='json')
        self.assertEqual(res.status_code, 400)

    def test_income_requires_authentication(self):
        res = self.client.post('/api/accounts/income/', self.VALID_PAYLOAD, format='json')
        self.assertIn(res.status_code, [401, 403])


# ══════════════════════════════════════════════════════════════════════════════
# 5 ── Profile Update Form
# ══════════════════════════════════════════════════════════════════════════════

class ProfileUpdateTest(AuthenticatedTestCase):

    def test_update_profile_saves_to_db(self):
        """PATCH /api/auth/profile/ updates the user record."""
        self.auth_as(self.manager)
        res = self.client.patch('/api/auth/profile/', {'full_name': 'Updated Name'}, format='json')
        self.assertEqual(res.status_code, 200)
        self.manager.refresh_from_db()
        self.assertEqual(self.manager.full_name, 'Updated Name')

    def test_profile_get_returns_user_data(self):
        self.auth_as(self.manager)
        res = self.client.get('/api/auth/profile/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['username'], 'manager_test')


# ══════════════════════════════════════════════════════════════════════════════
# 6 ── Change Password Form
# ══════════════════════════════════════════════════════════════════════════════

class ChangePasswordTest(AuthenticatedTestCase):

    def test_change_password_success(self):
        self.auth_as(self.manager)
        res = self.client.post('/api/auth/change-password/', {
            'old_password': 'testpass123',
            'new_password': 'NewSecure@456',
            'confirm_password': 'NewSecure@456',
        }, format='json')
        self.assertIn(res.status_code, [200, 204])
        # Verify old password no longer works
        self.manager.refresh_from_db()
        self.assertFalse(self.manager.check_password('testpass123'))
        self.assertTrue(self.manager.check_password('NewSecure@456'))

    def test_change_password_wrong_old_returns_400(self):
        self.auth_as(self.manager)
        res = self.client.post('/api/auth/change-password/', {
            'old_password': 'wrongpassword',
            'new_password': 'NewSecure@456',
        }, format='json')
        self.assertEqual(res.status_code, 400)
