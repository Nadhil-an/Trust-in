from django.test import TestCase
from django.contrib.auth import get_user_model
from .models import Role

User = get_user_model()

class UserModelTests(TestCase):
    def test_create_user(self):
        """Test creating a regular user (MANAGER by default)."""
        user = User.objects.create_user(
            username="testmanager",
            email="manager@example.com",
            full_name="Test Manager",
            password="testpassword123"
        )
        self.assertEqual(user.username, "testmanager")
        self.assertEqual(user.email, "manager@example.com")
        self.assertEqual(user.full_name, "Test Manager")
        self.assertEqual(user.role, Role.MANAGER)
        self.assertTrue(user.check_password("testpassword123"))
        self.assertTrue(user.is_active)
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)

    def test_create_superuser(self):
        """Test creating a superuser."""
        admin_user = User.objects.create_superuser(
            username="adminuser",
            email="admin@example.com",
            full_name="Admin User",
            password="adminpassword123"
        )
        self.assertEqual(admin_user.role, Role.ADMIN)
        self.assertTrue(admin_user.is_staff)
        self.assertTrue(admin_user.is_superuser)

    def test_staff_uid_auto_generation(self):
        """Test that non-member users automatically get an SLT-XXXX ID."""
        user1 = User.objects.create_user(
            username="staff1",
            email="staff1@example.com",
            full_name="Staff One",
            role=Role.HR
        )
        self.assertEqual(user1.staff_uid, "SLT-0001")

        user2 = User.objects.create_user(
            username="staff2",
            email="staff2@example.com",
            full_name="Staff Two",
            role=Role.ACCOUNTANT
        )
        self.assertEqual(user2.staff_uid, "SLT-0002")

    def test_member_role_no_staff_uid(self):
        """Test that MEMBER roles do not get an SLT-XXXX ID automatically."""
        member = User.objects.create_user(
            username="member1",
            email="member1@example.com",
            full_name="Member One",
            role=Role.MEMBER
        )
        self.assertIsNone(member.staff_uid)

class UserAPIIDORTests(TestCase):
    def setUp(self):
        self.hr_user = User.objects.create_user(
            username="hr", email="hr@test.com", password="pwd", role=Role.HR
        )
        self.manager = User.objects.create_user(
            username="mgr", email="mgr@test.com", password="pwd", role=Role.MANAGER
        )
        
    def test_idor_user_detail_access(self):
        """Test IDOR: A regular MANAGER should not be able to access another user's details via UserDetailView."""
        from rest_framework.test import APIClient
        from django.urls import reverse
        
        client = APIClient()
        client.force_authenticate(user=self.manager)
        
        # Try to access HR's user detail page
        url = reverse('user_detail', kwargs={'pk': self.hr_user.id})
        response = client.get(url)
        
        # Manager should be forbidden (403) by the IsHR permission class
        self.assertEqual(response.status_code, 403)

    def test_hr_user_detail_access(self):
        """Test that an HR user CAN access another user's details."""
        from rest_framework.test import APIClient
        from django.urls import reverse
        
        client = APIClient()
        client.force_authenticate(user=self.hr_user)
        
        # Try to access Manager's user detail page
        url = reverse('user_detail', kwargs={'pk': self.manager.id})
        response = client.get(url)
        
        # HR should be allowed (200)
        self.assertEqual(response.status_code, 200)
